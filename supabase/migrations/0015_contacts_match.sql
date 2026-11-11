-- 0015 — Contact matching for fn:contacts-match (FR-ONB-06, FR-SOC-02; D-4; M3-05).
-- Additive only: two new tables and four functions. Nothing existing is dropped, renamed or changed.
--
-- D-4: the app sends address-book emails and phone numbers to fn:contacts-match; the function hashes
-- them in memory with a keyed HMAC-SHA256 (secret CONTACT_HASH_SECRET, held only by the Edge Function)
-- and looks the hashes up here. Raw contacts are never stored, and the caller's address book is never
-- stored either, not even hashed.
--
--   * contact_hashes holds one keyed hash per user: the hash of their own sign-up email (the only
--     contact detail Pickld has; no phone numbers are collected, D-4). Phone hashes from address books
--     are accepted by the function but match nothing, because nothing here is a phone hash.
--   * Who fills it: the Edge Function, as the service role. The HMAC key must never reach Postgres, so
--     Postgres can't compute hashes itself (no trigger on auth.users). Instead, on every call the
--     function (1) saves the caller's own email hash and (2) asks contact_hashes_pending() for up to 500
--     users whose row is missing or older than their auth record (new users, changed emails), hashes
--     their emails in memory and saves them with contact_hashes_save(). Every call backfills, so new
--     users become matchable as soon as anyone uses Find friends. Rotating the key means truncating
--     the table and letting calls refill it.
--   * contacts_match_find() returns active users with a matching hash, never the caller, never anyone
--     blocked either way, with whether the caller already reads them.
--   * contact_match_calls is the rate limit: contact_match_take() allows 10 calls per user per rolling
--     hour, database-backed so it holds across Edge Function instances.
--   * No client access at all: RLS is on with no policies, and anon/authenticated hold no privileges on
--     the tables or functions. Only the service role (the Edge Function) touches them.

-- ---------------------------------------------------------------- tables
create table public.contact_hashes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);
create index contact_hashes_email_hash_idx on public.contact_hashes (email_hash);
comment on table public.contact_hashes is
  'Keyed HMAC-SHA256 hash of each user''s own sign-up email (D-4). Written only by fn:contacts-match (0015).';

create table public.contact_match_calls (
  user_id uuid not null references public.profiles(id) on delete cascade,
  called_at timestamptz not null default now()
);
create index contact_match_calls_user_idx on public.contact_match_calls (user_id, called_at);
comment on table public.contact_match_calls is
  'Recent fn:contacts-match calls per user, for its rate limit (contact_match_take, 0015).';

alter table public.contact_hashes enable row level security;
alter table public.contact_match_calls enable row level security;
revoke all on public.contact_hashes, public.contact_match_calls from public, anon, authenticated;
grant select, insert, update, delete on public.contact_hashes, public.contact_match_calls to service_role;

-- ---------------------------------------------------------------- rate limit
-- 'ok' records the call; 'limited' when the user made 10 calls in the last hour; 'inactive' for users
-- without an active profile (suspended and deleted accounts can't use Find friends, D-11).
create or replace function public.contact_match_take(p_user uuid) returns text
language plpgsql set search_path = public as $$
begin
  if not is_active_user(p_user) then
    return 'inactive';
  end if;
  -- One caller at a time per user, so parallel calls can't all slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('contact_match:' || p_user::text, 0));
  delete from contact_match_calls where user_id = p_user and called_at <= now() - interval '1 hour';
  if (select count(*) from contact_match_calls where user_id = p_user) >= 10 then
    return 'limited';
  end if;
  insert into contact_match_calls (user_id) values (p_user);
  return 'ok';
end $$;

-- ---------------------------------------------------------------- filling contact_hashes
-- Users whose hash row is missing or older than their auth record, newest sign-ups first. Returns
-- their sign-up emails to the service role only (which can read them through the auth admin API anyway).
create or replace function public.contact_hashes_pending(p_limit int default 500)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text
  from profiles p
  join auth.users u on u.id = p.id
  left join contact_hashes ch on ch.user_id = p.id
  where p.status = 'active'
    and u.email is not null
    and (ch.user_id is null or u.updated_at > ch.updated_at)
  order by (ch.user_id is null) desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 0), 0), 1000)
$$;

-- Saves hashes (same order as the ids) with the server clock. Ids without a profile are skipped.
create or replace function public.contact_hashes_save(p_user_ids uuid[], p_hashes text[]) returns int
language plpgsql set search_path = public as $$
declare
  n int;
begin
  if cardinality(p_user_ids) is distinct from cardinality(p_hashes) then
    raise exception 'ids and hashes go together' using errcode = '22023';
  end if;
  insert into contact_hashes (user_id, email_hash, updated_at)
  select distinct on (r.user_id) r.user_id, r.email_hash, now()
  from unnest(p_user_ids, p_hashes) as r(user_id, email_hash)
  join profiles p on p.id = r.user_id
  order by r.user_id
  on conflict (user_id) do update set email_hash = excluded.email_hash, updated_at = excluded.updated_at;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- matching
create or replace function public.contacts_match_find(p_user uuid, p_hashes text[])
returns table (id uuid, username text, display_name text, avatar_path text, is_following boolean)
language sql stable set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_path,
         exists (select 1 from follows f where f.reader_id = p_user and f.author_id = p.id)
  from contact_hashes ch
  join profiles p on p.id = ch.user_id
  where ch.email_hash = any (p_hashes)
    and p.id <> p_user
    and p.status = 'active'
    and not is_blocked_between(p_user, p.id)
  order by p.username
  limit 2000
$$;

revoke execute on function public.contact_match_take(uuid) from public, anon, authenticated;
revoke execute on function public.contact_hashes_pending(int) from public, anon, authenticated;
revoke execute on function public.contact_hashes_save(uuid[], text[]) from public, anon, authenticated;
revoke execute on function public.contacts_match_find(uuid, text[]) from public, anon, authenticated;
grant execute on function public.contact_match_take(uuid) to service_role;
grant execute on function public.contact_hashes_pending(int) to service_role;
grant execute on function public.contact_hashes_save(uuid[], text[]) to service_role;
grant execute on function public.contacts_match_find(uuid, text[]) to service_role;
