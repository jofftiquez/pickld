-- 0131 (INV-02, #373): waiting accounts during the invite period.
--
-- While app_settings.invite_period_ends_at is in the future, a new profile starts as `waiting` instead of
-- `active`. Everything that checks is_active_user() (0002, 0005: jars, moments, comments, reactions, follows,
-- reports, contact matching) already refuses a waiting account, and search, suggestions and other people's
-- reads already show active profiles only. A waiting account can still read and edit its own profile and
-- delete itself (account_delete_request, any status). The 13+ birthday check on profiles is unchanged.
--
-- A waiting account becomes active when:
--   * it redeems an invite code (INV-03);
--   * the founders let the next n in from the console: admit_waiting(n);
--   * the period ends: fn:account-jobs calls admit_all_waiting() on every run, which lets everyone in.
-- Each admitted account gets one `admitted` notification ("You're in. Fill your first jar.").
--
-- The queue is first come, first served: a pickld.me waitlist sign-up counts from when it joined the waitlist
-- (0072), anyone else from their profile's created_at.
--
-- With no date set (the default) there is no invite period and nothing changes. The founders set the date at
-- launch (docs/runbooks/invite-period.md).

-- ---------------------------------------------------------------- app_settings
create table public.app_settings (
  id boolean primary key default true check (id),
  invite_period_ends_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is
  'One row of app-wide settings (0131). Service role and founders (SQL) only; clients read them through functions.';
comment on column public.app_settings.invite_period_ends_at is
  'While this is in the future, new accounts wait for an invite code (INV-02). Null: no invite period.';
insert into public.app_settings default values;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;

create or replace function public.invite_period_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select invite_period_ends_at > now() from app_settings where id), false)
$$;
comment on function public.invite_period_active() is
  'Whether new accounts wait for an invite code right now (INV-02). Anyone may ask.';
revoke execute on function public.invite_period_active() from public;
grant execute on function public.invite_period_active() to anon, authenticated, service_role;

-- ---------------------------------------------------------------- new profiles wait during the period
-- 0002's guard, unchanged except for the status a client insert gets.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- A new profile starts active (waiting during the invite period, 0131) with empty counters and the
    -- server's clock.
    new.status := case when public.invite_period_active() then 'waiting' else 'active' end;
    new.reader_count := 0;
    new.author_count := 0;
    new.jar_count := 0;
    new.created_at := now();
    return new;
  end if;
  if new.id is distinct from old.id
     or new.status is distinct from old.status
     or new.birthday is distinct from old.birthday
     or new.reader_count is distinct from old.reader_count
     or new.author_count is distinct from old.author_count
     or new.jar_count is distinct from old.jar_count
     or new.created_at is distinct from old.created_at then
    raise exception 'only profile fields can be changed'
      using errcode = '42501',
            hint = 'Editable: username, display_name, bio, avatar_path, cover_path, lid_color, home_tz, default_visibility.';
  end if;
  return new;
end $$;

-- A waitlist account (0072) that finishes About you is marked joined.
create or replace function public.profiles_mark_waitlist_joined() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update waitlist set joined_at = now() where user_id = new.id and joined_at is null;
  return null;
end $$;
revoke execute on function public.profiles_mark_waitlist_joined() from public, anon, authenticated;
create trigger profiles_mark_waitlist_joined after insert on public.profiles
  for each row execute function public.profiles_mark_waitlist_joined();

create index profiles_waiting_idx on public.profiles (created_at, id) where status = 'waiting';

-- ---------------------------------------------------------------- the admitted notification
alter table public.notifications drop constraint notifications_type_known;
alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined', 'admitted'
  ));

-- ---------------------------------------------------------------- the queue
-- 1 for the first in line; null when the caller isn't waiting.
create or replace function public.waiting_position() returns int
language sql stable security definer set search_path = public as $$
  with q as (
    select p.id, coalesce(w.created_at, p.created_at) as since
    from profiles p
    left join waitlist w on w.user_id = p.id
    where p.status = 'waiting'
  )
  select (select count(*)::int + 1 from q o where (o.since, o.id) < (me.since, me.id))
  from q me
  where me.id = auth.uid()
$$;
comment on function public.waiting_position() is
  'The signed-in caller''s place in the waiting line (1 is next), or null when they aren''t waiting (INV-02).';
revoke execute on function public.waiting_position() from public, anon;
grant execute on function public.waiting_position() to authenticated;

-- Lets the given waiting accounts in: active, the `admitted` notification, the waitlist row marked admitted,
-- and one audit row each. Accounts that aren't waiting (any more) are skipped. Internal only.
create or replace function public.admit_profiles(p_ids uuid[], p_actor uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with admitted as (
    update profiles set status = 'active' where id = any(p_ids) and status = 'waiting' returning id
  ),
  notified as (
    insert into notifications (user_id, type) select id, 'admitted' from admitted returning id
  ),
  listed as (
    update waitlist w set admitted_at = now() from admitted a
    where w.user_id = a.id and w.admitted_at is null
    returning w.user_id
  )
  insert into audit_log (actor_id, action, target, target_id, data)
  select p_actor, 'admit', 'profile', id, jsonb_build_object('reason', p_reason) from admitted;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.admit_profiles(uuid[], uuid, text) from public, anon, authenticated, service_role;

-- The founders let the next p_count people in (console, INV-10). Founders are moderators whose auth
-- app_metadata has founder: true. Returns how many were let in.
create or replace function public.admit_waiting(p_count int) returns int
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
begin
  if actor is null
     or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator'
     or coalesce(claims -> 'app_metadata' ->> 'founder', '') <> 'true' then
    raise exception 'founders only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the founder has no profile' using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 1000 then
    raise exception 'let in 1 to 1000 people at a time' using errcode = '22023';
  end if;
  return admit_profiles(array(
    select p.id
    from profiles p
    left join waitlist w on w.user_id = p.id
    where p.status = 'waiting'
    order by coalesce(w.created_at, p.created_at), p.id
    limit p_count
    for update of p skip locked
  ), actor, 'founders');
end $$;
comment on function public.admit_waiting(int) is
  'Founders only: lets the first p_count waiting accounts in, first come first served (INV-02). Returns the count.';
revoke execute on function public.admit_waiting(int) from public, anon;
grant execute on function public.admit_waiting(int) to authenticated;

-- fn:account-jobs, every run: once the invite period is over (or no date is set), everyone still waiting
-- comes in. Returns how many.
create or replace function public.admit_all_waiting() returns int
language plpgsql security definer set search_path = public as $$
begin
  if invite_period_active() then
    return 0;
  end if;
  return admit_profiles(array(
    select id from profiles where status = 'waiting' for update skip locked
  ), null, 'period_ended');
end $$;
comment on function public.admit_all_waiting() is
  'Service role (fn:account-jobs): when the invite period is over, lets every waiting account in (INV-02).';
revoke execute on function public.admit_all_waiting() from public, anon, authenticated;
grant execute on function public.admit_all_waiting() to service_role;
