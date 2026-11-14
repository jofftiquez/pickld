-- 0132 (INV-03, #374): invite codes, the personal link and redeeming a code. Additive: one enum, five tables,
-- functions and triggers; nothing is dropped or renamed.
--
-- Codes are 6 characters from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0/O, 1/I/L), one use each unless an admin
-- code says otherwise. Three kinds:
--   personal  8 per set, one per moment slot. A new profile gets set 1, locked until its first live moment;
--             profiles that exist when this ships get sets 1 and 2, unlocked. Moderators can add sets.
--   waitlist  made for the email waitlist (INV-09); single use, may expire.
--   admin     made in the console (INV-10); any number of uses, optional end date and off switch.
-- Everyone also has one personal link id (10 characters, so it never looks like a code). Opening the link
-- uses the owner's next unused personal code, set 1 before set 2, in slot order.
--
-- A used code never comes back: invite_codes.uses only goes up, even if the friend later deletes their account.
--
-- invite_redeem(token) is how a code is used. It works for an account that is waiting (INV-02), or one that
-- became active less than a day ago and hasn't used a code (after the invite period new accounts start
-- active, and a code still makes them readers). Everyone else gets already_member. A personal code or link
-- makes inviter and invitee read each other, except that a 13 to 17 year old invitee only reads the inviter;
-- these follows send no new-reader notification. Waitlist and admin codes make no follows.
--
-- A personal code or link stops working while its owner isn't active (suspended, deleted, still waiting), is
-- locked, or has invites frozen. Moderators freeze and unfreeze with a note (audit rows, like mod_suspend in
-- 0090); invites freeze on their own when 3 of the owner's invitees have been suspended within 90 days.
--
-- No client reads or writes the tables. The app uses my_invites(), invite_link_set(), invite_link_reset() and
-- invite_redeem(); the console uses invite_grant_set(), invite_freeze() and invite_unfreeze().

create type public.invite_kind as enum ('personal', 'waitlist', 'admin');

-- ---------------------------------------------------------------- tables
create table public.invite_codes (
  code text primary key check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  kind invite_kind not null,
  owner_id uuid references public.profiles(id) on delete cascade,
  set_no smallint check (set_no >= 1),
  slot slot,
  max_uses int not null default 1 check (max_uses >= 1),
  uses int not null default 0,
  expires_at timestamptz,
  disabled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (uses between 0 and max_uses),
  check (kind = 'admin' or max_uses = 1),
  check (case when kind = 'personal' then owner_id is not null and set_no is not null and slot is not null
              else owner_id is null and set_no is null and slot is null end)
);
create unique index invite_codes_personal_key on public.invite_codes (owner_id, set_no, slot) where kind = 'personal';
comment on table public.invite_codes is
  'Invite codes (INV-03, 0132): personal (8 per set, one per slot), waitlist and admin. Functions only.';
comment on column public.invite_codes.uses is 'Times used. Only goes up: a used code never comes back.';

create table public.invite_links (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  link_id text not null unique check (link_id ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.invite_links is
  'Each person''s invite link, pickld.me/i/<link_id> (INV-03, 0132). Reset gives a new id. Functions only.';

create table public.invite_holders (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  unlocked_at timestamptz,
  frozen_at timestamptz,
  frozen_reason text check (char_length(frozen_reason) <= 500),
  frozen_by uuid references public.profiles(id) on delete set null
);
comment on table public.invite_holders is
  'Whether a person''s personal codes and link work: unlocked after their first live moment, or frozen (0132).';

create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.invite_codes(code) on delete cascade,
  via_link boolean not null default false,
  invitee_id uuid unique references public.profiles(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  invitee_suspended_at timestamptz
);
create index invite_redemptions_code_idx on public.invite_redemptions (code);
comment on table public.invite_redemptions is
  'Who joined with which code (INV-03, 0132): the invite tree moderators see. One per account.';
comment on column public.invite_redemptions.invitee_suspended_at is
  'When the invitee was last suspended; 3 within 90 days freeze the inviter''s invites.';

create table public.invite_attempts (
  key text not null,
  created_at timestamptz not null default now()
);
create index invite_attempts_key_idx on public.invite_attempts (key, created_at);
comment on table public.invite_attempts is
  'Recent invite redeem attempts per key (user:<id>), for the rate limit (0132, like contact_match_calls).';

alter table public.invite_codes enable row level security;
alter table public.invite_links enable row level security;
alter table public.invite_holders enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.invite_attempts enable row level security;
revoke all on public.invite_codes, public.invite_links, public.invite_holders, public.invite_redemptions,
  public.invite_attempts from public, anon, authenticated;

insert into public.reserved_usernames (name) values ('i'), ('invite') on conflict do nothing;

-- ---------------------------------------------------------------- making codes and links
-- A random token of up to 14 characters. Each character comes from one random byte of a v4 UUID (the bytes
-- without version or variant bits).
create or replace function public.invite_token(p_len int) returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', get_byte(r.b, p.pos) % 31 + 1, 1), '' order by p.n)
  from (select uuid_send(gen_random_uuid()) as b) r,
       unnest(array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15]) with ordinality as p(pos, n)
  where p.n <= p_len
$$;

-- Adds set p_set_no of 8 personal codes (one per slot) for p_owner, drawing again on the rare clash.
create or replace function public.invite_add_set(p_owner uuid, p_set_no int) returns void
language plpgsql security definer set search_path = public as $$
declare
  s slot;
  clash text;
begin
  foreach s in array enum_range(null::slot) loop
    loop
      begin
        insert into invite_codes (code, kind, owner_id, set_no, slot)
        values (invite_token(6), 'personal', p_owner, p_set_no, s);
        exit;
      exception when unique_violation then
        get stacked diagnostics clash = constraint_name;
        if clash <> 'invite_codes_pkey' then
          raise;
        end if;
      end;
    end loop;
  end loop;
end $$;

-- Gives p_owner a new link id (a first one, or a reset).
create or replace function public.invite_new_link(p_owner uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  id text;
begin
  loop
    id := invite_token(10);
    begin
      insert into invite_links (owner_id, link_id) values (p_owner, id)
      on conflict (owner_id) do update set link_id = excluded.link_id;
      return id;
    exception when unique_violation then
      -- the id is taken: draw again
    end;
  end loop;
end $$;

-- The holder row, p_sets sets of codes and the link.
create or replace function public.invite_setup(p_owner uuid, p_sets int, p_unlocked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into invite_holders (user_id, unlocked_at)
  values (p_owner, case when p_unlocked then now() end)
  on conflict (user_id) do nothing;
  for i in 1 .. p_sets loop
    perform invite_add_set(p_owner, i);
  end loop;
  perform invite_new_link(p_owner);
end $$;

-- Accounts that exist now get two sets, unlocked at once.
select public.invite_setup(id, 2, true) from public.profiles where status <> 'deleted';

-- A new profile gets one set, locked until its first live moment.
create or replace function public.profiles_invite_setup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform invite_setup(new.id, 1, false);
  return null;
end $$;
create trigger profiles_invite_setup after insert on public.profiles
  for each row execute function public.profiles_invite_setup();

create or replace function public.moments_unlock_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update invite_holders set unlocked_at = now() where user_id = new.user_id and unlocked_at is null;
  return null;
end $$;
create trigger moments_unlock_invites after insert or update of status on public.moments
  for each row when (new.status = 'live') execute function public.moments_unlock_invites();

-- ---------------------------------------------------------------- automatic freeze
-- When an invitee is suspended, their redemption is stamped; the third invitee of one person suspended within
-- 90 days freezes that person's invites.
create or replace function public.profiles_invite_suspended() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inviter uuid;
begin
  update invite_redemptions r set invitee_suspended_at = now()
  where r.invitee_id = new.id
  returning (select c.owner_id from invite_codes c where c.code = r.code) into inviter;
  if inviter is null then
    return null;
  end if;
  if (select count(*) from invite_redemptions r join invite_codes c on c.code = r.code
      where c.owner_id = inviter and r.invitee_suspended_at > now() - interval '90 days') >= 3 then
    update invite_holders set frozen_at = now(), frozen_reason = 'suspended_invitees', frozen_by = null
    where user_id = inviter and frozen_at is null;
    if found then
      insert into audit_log (actor_id, action, target, target_id, data)
      values (null, 'invite_freeze', 'profile', inviter,
              jsonb_build_object('reason', 'suspended_invitees', 'invitee_id', new.id));
    end if;
  end if;
  return null;
end $$;
create trigger profiles_invite_suspended after update of status on public.profiles
  for each row when (new.status = 'suspended' and old.status is distinct from 'suspended')
  execute function public.profiles_invite_suspended();

-- ---------------------------------------------------------------- finding a usable code
-- Whether p_owner's personal codes and link work now.
create or replace function public.invite_owner_can_invite(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join invite_holders h on h.user_id = p.id
    where p.id = p_owner and p.status = 'active' and h.unlocked_at is not null and h.frozen_at is null
  )
$$;

-- The code a token would use right now, or no row when it can't be used (unknown, used, expired, switched
-- off, frozen, locked, or the owner isn't active). A 6-character token is a code; a 10-character one is a
-- link, which picks the owner's next unused code. With p_lock (redeeming), callers for one owner or code go
-- one at a time, so two people can't take the same code. Case and surrounding spaces don't matter.
create or replace function public.invite_usable_code(p_token text, p_lock boolean default false)
returns table (code text, kind invite_kind, owner_id uuid, via_link boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  t text := upper(btrim(coalesce(p_token, '')));
  link_owner uuid;
  c invite_codes;
begin
  if t ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$' then
    select l.owner_id into link_owner from invite_links l where l.link_id = t and l.enabled;
    if link_owner is null or not invite_owner_can_invite(link_owner) then
      return;
    end if;
    if p_lock then
      perform pg_advisory_xact_lock(hashtextextended('invite_owner:' || link_owner::text, 0));
    end if;
    select * into c from invite_codes ic
    where ic.owner_id = link_owner and ic.kind = 'personal' and ic.uses < ic.max_uses
    order by ic.set_no, ic.slot
    limit 1;
    if c.code is null then
      return;
    end if;
    return query select c.code, c.kind, c.owner_id, true;
  elsif t ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    select * into c from invite_codes ic where ic.code = t;
    if c.code is null then
      return;
    end if;
    if p_lock then
      if c.owner_id is not null then
        perform pg_advisory_xact_lock(hashtextextended('invite_owner:' || c.owner_id::text, 0));
      end if;
      select * into c from invite_codes ic where ic.code = t for update;
    end if;
    if c.uses >= c.max_uses or c.disabled_at is not null or c.expires_at <= now()
       or (c.kind = 'personal' and not invite_owner_can_invite(c.owner_id)) then
      return;
    end if;
    return query select c.code, c.kind, c.owner_id, false;
  end if;
end $$;

-- ---------------------------------------------------------------- redeeming
-- Returns { result } where result is:
--   joined          the code is used; kind says which, inviter is the inviter's username (personal only)
--   unavailable     the code or link can't be used (one answer for every reason)
--   limited         10 tries in the last hour
--   already_member  the caller is already in (and didn't just sign up)
create or replace function public.invite_redeem(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p profiles;
  v_code text;
  v_kind invite_kind;
  v_owner uuid;
  v_via_link boolean;
  attempt_key text := 'user:' || auth.uid()::text;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into p from profiles where id = me for update;
  if p.id is null or p.status not in ('waiting', 'active') then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if p.status = 'active' and (p.created_at <= now() - interval '1 day'
                              or exists (select 1 from invite_redemptions where invitee_id = me)) then
    return jsonb_build_object('result', 'already_member');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invite_attempt:' || attempt_key, 0));
  delete from invite_attempts where key = attempt_key and created_at <= now() - interval '1 hour';
  if (select count(*) from invite_attempts where key = attempt_key) >= 10 then
    return jsonb_build_object('result', 'limited');
  end if;
  insert into invite_attempts (key) values (attempt_key);

  select u.code, u.kind, u.owner_id, u.via_link into v_code, v_kind, v_owner, v_via_link
  from invite_usable_code(p_token, true) u;
  if v_code is null or v_owner = me then
    return jsonb_build_object('result', 'unavailable');
  end if;

  update invite_codes set uses = uses + 1 where code = v_code;
  insert into invite_redemptions (code, via_link, invitee_id) values (v_code, v_via_link, me);
  if p.status = 'waiting' then
    update profiles set status = 'active' where id = me;
    update waitlist set admitted_at = now() where user_id = me and admitted_at is null;
  end if;

  if v_kind = 'personal' and not is_blocked_between(me, v_owner) then
    insert into follows (reader_id, author_id) values (me, v_owner) on conflict do nothing;
    if p.birthday <= current_date - interval '18 years' then
      insert into follows (reader_id, author_id) values (v_owner, me) on conflict do nothing;
    end if;
    -- push_take() (0020) only sends rows older than a minute, so these never go out.
    delete from notifications
    where type = 'new_reader' and pushed_at is null
      and ((user_id = v_owner and actor_id = me) or (user_id = me and actor_id = v_owner));
  end if;

  return jsonb_build_object('result', 'joined', 'kind', v_kind,
                            'inviter', (select username::text from profiles where id = v_owner));
end $$;
comment on function public.invite_redeem(text) is
  'Uses an invite code or link for the signed-in caller (INV-03): joined, unavailable, limited or already_member.';

-- ---------------------------------------------------------------- the owner's Invite page
-- The caller's codes (sets in slot order), link and state. A used code shows who joined and when; the name is
-- left out when that person isn't active or there is a block either way. Null without a holder row.
create or replace function public.my_invites() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'unlocked', h.unlocked_at is not null,
    'frozen', h.frozen_at is not null,
    'link', (select jsonb_build_object('id', l.link_id, 'enabled', l.enabled)
             from invite_links l where l.owner_id = h.user_id),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code, 'set_no', c.set_no, 'slot', c.slot, 'used', c.uses >= c.max_uses,
        'invitee', case when r.id is not null then jsonb_build_object(
          'joined_at', r.redeemed_at,
          'profile', case when f.id is not null and f.status = 'active' and not is_blocked_between(h.user_id, f.id)
                          then jsonb_build_object('id', f.id, 'username', f.username, 'display_name', f.display_name,
                                                  'avatar_path', f.avatar_path) end) end)
        order by c.set_no, c.slot)
      from invite_codes c
      left join invite_redemptions r on r.code = c.code
      left join profiles f on f.id = r.invitee_id
      where c.owner_id = h.user_id and c.kind = 'personal'), '[]'::jsonb))
  from invite_holders h
  where h.user_id = auth.uid()
$$;
comment on function public.my_invites() is
  'The signed-in caller''s invite codes, link and state, for the Invite page (INV-03).';

create or replace function public.invite_link_set(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_enabled is null then
    raise exception 'enabled is true or false' using errcode = '22023';
  end if;
  update invite_links set enabled = p_enabled where owner_id = auth.uid();
  return found;
end $$;
comment on function public.invite_link_set(boolean) is 'Switches the caller''s invite link on or off (INV-03).';

create or replace function public.invite_link_reset() returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from invite_links where owner_id = auth.uid()) then
    return null;
  end if;
  return invite_new_link(auth.uid());
end $$;
comment on function public.invite_link_reset() is
  'Gives the caller a new invite link id; the old link stops working (INV-03).';

-- ---------------------------------------------------------------- console
-- Shared check for the console functions below: the caller is a moderator with a profile (founders are
-- moderators too). Returns their id.
create or replace function public.invite_moderator() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
begin
  if actor is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  return actor;
end $$;

-- Another set of 8 codes for p_user. Returns { result: granted, set_no } or not_found.
create or replace function public.invite_grant_set(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_moderator();
  n int;
begin
  perform 1 from invite_holders h join profiles p on p.id = h.user_id
  where h.user_id = p_user and p.status <> 'deleted'
  for update of h;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  select coalesce(max(set_no), 0) + 1 into n from invite_codes where owner_id = p_user and kind = 'personal';
  perform invite_add_set(p_user, n);
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'invite_grant_set', 'profile', p_user, jsonb_build_object('set_no', n));
  return jsonb_build_object('result', 'granted', 'set_no', n);
end $$;
comment on function public.invite_grant_set(uuid) is 'Moderators: gives a person another set of 8 invite codes (INV-03).';

-- Pauses a person's invites (unused codes and link). Returns frozen, already_frozen, own_account or not_found.
create or replace function public.invite_freeze(p_user uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_moderator();
begin
  if p_note is null or char_length(btrim(p_note)) = 0 or char_length(p_note) > 500 then
    raise exception 'a note of 1 to 500 characters is required' using errcode = '22023';
  end if;
  if p_user = actor then
    return jsonb_build_object('result', 'own_account');
  end if;
  if not exists (select 1 from invite_holders where user_id = p_user) then
    return jsonb_build_object('result', 'not_found');
  end if;
  update invite_holders set frozen_at = now(), frozen_reason = btrim(p_note), frozen_by = actor
  where user_id = p_user and frozen_at is null;
  if not found then
    return jsonb_build_object('result', 'already_frozen');
  end if;
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'invite_freeze', 'profile', p_user, jsonb_build_object('note', btrim(p_note)));
  return jsonb_build_object('result', 'frozen');
end $$;
comment on function public.invite_freeze(uuid, text) is 'Moderators: pauses a person''s invites, with a note (INV-03).';

-- Lets a person's invites work again. Returns unfrozen, not_frozen, own_account or not_found.
create or replace function public.invite_unfreeze(p_user uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_moderator();
begin
  if p_note is null or char_length(btrim(p_note)) = 0 or char_length(p_note) > 500 then
    raise exception 'a note of 1 to 500 characters is required' using errcode = '22023';
  end if;
  if p_user = actor then
    return jsonb_build_object('result', 'own_account');
  end if;
  if not exists (select 1 from invite_holders where user_id = p_user) then
    return jsonb_build_object('result', 'not_found');
  end if;
  update invite_holders set frozen_at = null, frozen_reason = null, frozen_by = null
  where user_id = p_user and frozen_at is not null;
  if not found then
    return jsonb_build_object('result', 'not_frozen');
  end if;
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'invite_unfreeze', 'profile', p_user, jsonb_build_object('note', btrim(p_note)));
  return jsonb_build_object('result', 'unfrozen');
end $$;
comment on function public.invite_unfreeze(uuid, text) is 'Moderators: lets a person''s invites work again (INV-03).';

-- ---------------------------------------------------------------- rights
revoke execute on function public.invite_token(int) from public, anon, authenticated, service_role;
revoke execute on function public.invite_add_set(uuid, int) from public, anon, authenticated, service_role;
revoke execute on function public.invite_new_link(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.invite_setup(uuid, int, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.profiles_invite_setup() from public, anon, authenticated, service_role;
revoke execute on function public.moments_unlock_invites() from public, anon, authenticated, service_role;
revoke execute on function public.profiles_invite_suspended() from public, anon, authenticated, service_role;
revoke execute on function public.invite_owner_can_invite(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.invite_usable_code(text, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.invite_moderator() from public, anon, authenticated, service_role;

revoke execute on function public.invite_redeem(text) from public, anon;
revoke execute on function public.my_invites() from public, anon;
revoke execute on function public.invite_link_set(boolean) from public, anon;
revoke execute on function public.invite_link_reset() from public, anon;
revoke execute on function public.invite_grant_set(uuid) from public, anon;
revoke execute on function public.invite_freeze(uuid, text) from public, anon;
revoke execute on function public.invite_unfreeze(uuid, text) from public, anon;
grant execute on function public.invite_redeem(text) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.invite_link_set(boolean) to authenticated;
grant execute on function public.invite_link_reset() to authenticated;
grant execute on function public.invite_grant_set(uuid) to authenticated;
grant execute on function public.invite_freeze(uuid, text) to authenticated;
grant execute on function public.invite_unfreeze(uuid, text) to authenticated;
