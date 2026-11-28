-- 0182: member numbers. Every account gets a number in the order it was let in (#000000001, #000000002, …),
-- shown on profiles, pickld.me and share cards unless the owner hides it.
--
-- * When: the moment a profile becomes active. With no invite period that is the About you insert; during the
--   period it is when the account is let in (invite code, admit_waiting, admit_all_waiting). Waiting accounts
--   have none yet. A batch of admissions is numbered in queue order.
-- * No gaps from failures: numbers come from one counter row updated in the same transaction, so a sign-up that
--   fails (username taken, under 13) or an admission that rolls back gives its number back. Concurrent sign-ups
--   wait on that row for the moment it takes to commit.
-- * Never reused: the counter only goes up. A deleted account's number stays retired.
-- * #1 to #100 are kept for the founders to hand out: the counter starts at #101, and
--   give_member_number(username, number) (SQL only, docs/runbooks/member-numbers.md) moves an account onto one.
-- * Visibility: member_number itself is not readable by clients. public_member_number is the same number, or
--   null while the owner has hide_member_number on; that is what other people and pickld.me see. The owner reads
--   both through my_profile().
--
-- Additive: new columns, one new table and functions; existing accounts that were let in are numbered by when
-- they came in (their admitted notification, else when their profile was made). No data is dropped or rewritten.

-- ---------------------------------------------------------------- the counter
create table public.member_number_counter (
  id boolean primary key default true check (id),
  last_number int not null check (last_number >= 100)
);
comment on table public.member_number_counter is
  'The last member number given out (0182). One row; #1 to #100 are handed out by the founders, so it starts at 100. '
  'No client grants.';
insert into public.member_number_counter (last_number) values (100);
alter table public.member_number_counter enable row level security;
revoke all on public.member_number_counter from public, anon, authenticated;

create function public.next_member_number() returns int
language sql security definer set search_path = public as $$
  update member_number_counter set last_number = last_number + 1 where id returning last_number
$$;
revoke execute on function public.next_member_number() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- columns
alter table public.profiles
  add column member_number int unique check (member_number >= 1),
  add column hide_member_number boolean not null default false;
comment on column public.profiles.member_number is
  'Order the account was let in (0182). Set by the server only; never changes or comes back after a delete.';
comment on column public.profiles.hide_member_number is
  'Owner-editable (0182): keep my member number off my profile, pickld.me and share cards.';

-- ---------------------------------------------------------------- numbering existing accounts
-- Everyone already let in (anything but waiting), in the order they came in, from #101.
with ranked as (
  select p.id,
         row_number() over (
           order by coalesce((select min(n.created_at) from notifications n
                              where n.user_id = p.id and n.type = 'admitted'), p.created_at), p.created_at, p.id
         ) + 100 as n
  from profiles p
  where p.status <> 'waiting'
)
update profiles p set member_number = r.n from ranked r where r.id = p.id;
update member_number_counter set last_number = greatest(100, (select coalesce(max(member_number), 100) from profiles));

alter table public.profiles
  add column public_member_number int
    generated always as (case when hide_member_number then null else member_number end) stored;
comment on column public.profiles.public_member_number is
  'member_number unless the owner hides it (0182). What other people and pickld.me read.';

grant select (public_member_number) on public.profiles to authenticated;

-- ---------------------------------------------------------------- giving a number when an account comes in
-- Runs after profiles_guard (triggers fire in name order), so a client insert has already been reset.
create function public.profiles_member_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and new.member_number is null then
    new.member_number := next_member_number();
  end if;
  return new;
end $$;
revoke execute on function public.profiles_member_number() from public, anon, authenticated;
create trigger profiles_member_number before insert or update of status on public.profiles
  for each row execute function public.profiles_member_number();

-- 0131's guard, plus: clients never choose or change a member number.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- A new profile starts active (waiting during the invite period, 0131) with empty counters, the
    -- server's clock and no member number yet (0182).
    new.status := case when public.invite_period_active() then 'waiting' else 'active' end;
    new.reader_count := 0;
    new.author_count := 0;
    new.jar_count := 0;
    new.created_at := now();
    new.member_number := null;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.status is distinct from old.status
     or new.birthday is distinct from old.birthday
     or new.reader_count is distinct from old.reader_count
     or new.author_count is distinct from old.author_count
     or new.jar_count is distinct from old.jar_count
     or new.created_at is distinct from old.created_at
     or new.member_number is distinct from old.member_number then
    raise exception 'only profile fields can be changed'
      using errcode = '42501',
            hint = 'Editable: username, display_name, bio, avatar_path, cover_path, lid_color, home_tz, default_visibility.';
  end if;
  return new;
end $$;

-- 0131's shared admit step, letting people in one at a time in the order given, so a batch gets its member
-- numbers in queue order. Everything else is unchanged.
create or replace function public.admit_profiles(p_ids uuid[], p_actor uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v uuid;
  admitted uuid[] := '{}';
begin
  foreach v in array coalesce(p_ids, '{}') loop
    update profiles set status = 'active' where id = v and status = 'waiting';
    if found then
      admitted := admitted || v;
    end if;
  end loop;
  insert into notifications (user_id, type) select unnest(admitted), 'admitted';
  update waitlist set admitted_at = now() where user_id = any(admitted) and admitted_at is null;
  insert into audit_log (actor_id, action, target, target_id, data)
  select p_actor, 'admit', 'profile', a, jsonb_build_object('reason', p_reason) from unnest(admitted) a;
  return cardinality(admitted);
end $$;
revoke execute on function public.admit_profiles(uuid[], uuid, text) from public, anon, authenticated, service_role;

-- 0131's admit_all_waiting, now passing the queue in order (first come, first served, as admit_waiting).
create or replace function public.admit_all_waiting() returns int
language plpgsql security definer set search_path = public as $$
begin
  if invite_period_active() then
    return 0;
  end if;
  return admit_profiles(array(
    select p.id
    from profiles p
    left join waitlist w on w.user_id = p.id
    where p.status = 'waiting'
    order by coalesce(w.created_at, p.created_at), p.id
    for update of p skip locked
  ), null, 'period_ended');
end $$;

-- ---------------------------------------------------------------- #1 to #100
-- SQL only (the founders, docs/runbooks/member-numbers.md): moves an account onto a free number from 1 to 100.
-- Its old number: one from 1 to 100 is free to give again; one from 101 up stays retired, unless it was the
-- newest given out, in which case the counter steps back so it isn't skipped.
create function public.give_member_number(p_username text, p_number int) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_old int;
begin
  if p_number is null or p_number < 1 or p_number > 100 then
    raise exception 'hand out numbers from 1 to 100' using errcode = '22023';
  end if;
  select id, member_number into v_id, v_old from profiles where username = p_username::citext for update;
  if v_id is null then
    raise exception 'no profile with username %', p_username using errcode = 'P0002';
  end if;
  if v_old = p_number then
    return p_number;
  end if;
  if exists (select 1 from profiles where member_number = p_number) then
    raise exception '#% is already taken', p_number using errcode = '23505';
  end if;
  update profiles set member_number = p_number where id = v_id;
  update member_number_counter set last_number = last_number - 1 where id and last_number = v_old and v_old > 100;
  return p_number;
end $$;
comment on function public.give_member_number(text, int) is
  'Founders, by SQL: gives this username a free member number from 1 to 100 (0182).';
revoke execute on function public.give_member_number(text, int) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- pickld.me
-- 0176's public_profile with the public member number.
create or replace function public.public_profile(p_username text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
      'reader_count', p.reader_count, 'author_count', p.author_count,
      'created_at', p.created_at, 'member_number', p.public_member_number),
    'jars', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.id, 'local_date', j.local_date, 'published_at', j.published_at,
               'visible_count', j.n, 'moments', j.moments)
             order by j.local_date desc, j.id desc)
      from (
        select jar.id, jar.local_date, jar.published_at, e.n, e.moments
        from jars jar
        cross join lateral (
          select count(*)::int as n,
                 coalesce(jsonb_agg(jsonb_build_object(
                            'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                            'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                            'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                          order by m.slot), '[]'::jsonb) as moments
          from moments m
          where m.jar_id = jar.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
        ) e
        where jar.user_id = p.id and jar.published_at is not null and jar.visibility = 'everyone' and e.n > 0
          and not p.is_private
        order by jar.local_date desc, jar.id desc
        limit 30
      ) j
    ), '[]'::jsonb))
  from profiles p
  where p.username = p_username::citext
    and p.status = 'active'
$$;
