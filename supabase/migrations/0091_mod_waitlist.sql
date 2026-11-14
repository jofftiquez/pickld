-- 0091 — The console's Waitlist page (FR-MOD-08). Additive: new functions only; nothing is dropped, renamed or
-- rewritten. The waitlist itself (0071, 0072) keeps no client grants: moderators reach it only through these
-- functions, which refuse anyone without app_metadata.role = 'moderator' in the JWT, like mod_overview() (0090).
-- They are owned by the migration owner (the table has RLS and no policies, and pickld_moderation has no
-- rights on it).
--
--   mod_waitlist_summary()  totals, joins per Manila day for the last 30 days, and joins per source.
--   mod_waitlist()          one page of the list, searchable by email and filterable by state.
--   mod_waitlist_export()   the whole list for a CSV download; writes a waitlist_export audit row (count only).
--   mod_waitlist_remove()   removes one email on that person's request, with a required note. The audit row
--                           keeps no email, only the source, the join day and whether it had an account. It
--                           removes the waitlist row only; an auth account made by the pickld.me form stays
--                           (deleting accounts is not a console action).
--
-- A row's state: email_only (the first, unverified form), waiting (a verified account, not admitted, no
-- profile), admitted (admitted_at set, no profile yet), member (the account has a profile).
-- Admitting people (INV-08) stays out of the console.

create or replace function public.mod_waitlist_state(p_user uuid, p_admitted timestamptz)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_user is null then 'email_only'
    when exists (select 1 from profiles where id = p_user) then 'member'
    when p_admitted is not null then 'admitted'
    else 'waiting'
  end
$$;

create or replace function public.mod_require_moderator() returns uuid
language plpgsql stable as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return (claims ->> 'sub')::uuid;
end $$;

-- ---------------------------------------------------------------- summary
create or replace function public.mod_waitlist_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  day_start timestamptz;
  out jsonb;
begin
  perform mod_require_moderator();
  day_start := mod_day_start();
  with w as (select *, mod_waitlist_state(user_id, admitted_at) as state from waitlist)
  select jsonb_build_object(
    'total', (select count(*) from w),
    'email_only', (select count(*) from w where state = 'email_only'),
    'waiting', (select count(*) from w where state = 'waiting'),
    'admitted', (select count(*) from w where state = 'admitted'),
    'members', (select count(*) from w where state = 'member'),
    'today', (select count(*) from w where created_at >= day_start),
    'last_7_days', (select count(*) from w where created_at >= day_start - interval '6 days'),
    'per_day', (
      select jsonb_agg(jsonb_build_object('day', (d.day at time zone 'Asia/Manila')::date, 'count', (
               select count(*) from w
               where w.created_at >= d.day and w.created_at < d.day + interval '1 day')) order by d.day)
      from generate_series(day_start - interval '29 days', day_start, interval '1 day') as d(day)),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', s.source, 'count', s.n) order by s.n desc, s.source)
      from (select source, count(*) as n from w group by source) s), '[]'::jsonb))
  into out;
  return out;
end $$;

-- ---------------------------------------------------------------- list
-- p_state: all | email_only | waiting | admitted | member. total is the number of matching rows.
create or replace function public.mod_waitlist(
  p_query text default '', p_state text default 'all', p_limit int default 100, p_offset int default 0)
returns table (email text, source text, created_at timestamptz, state text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform mod_require_moderator();
  if p_state not in ('all', 'email_only', 'waiting', 'admitted', 'member') then
    raise exception 'unknown state %', p_state using errcode = '22023';
  end if;
  return query
    select w.email::text, w.source, w.created_at, w.state, count(*) over ()
    from (select *, mod_waitlist_state(waitlist.user_id, waitlist.admitted_at) as state from waitlist) w
    where (coalesce(btrim(p_query), '') = '' or strpos(lower(w.email::text), lower(btrim(p_query))) > 0)
      and (p_state = 'all' or w.state = p_state)
    order by w.created_at desc, w.email
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------------------------------------------------------------- export
create or replace function public.mod_waitlist_export()
returns table (email text, source text, created_at timestamptz, state text)
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := mod_require_moderator();
  n bigint;
begin
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  select count(*) into n from waitlist;
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'waitlist_export', null, null, jsonb_build_object('count', n));
  return query
    select w.email::text, w.source, w.created_at, mod_waitlist_state(w.user_id, w.admitted_at)
    from waitlist w
    order by w.created_at, w.email;
end $$;

-- ---------------------------------------------------------------- remove
-- Results: removed | not_found.
create or replace function public.mod_waitlist_remove(p_email text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := mod_require_moderator();
  row_ waitlist;
begin
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) = 0 or char_length(p_note) > 500 then
    raise exception 'a note of 1 to 500 characters is required' using errcode = '22023';
  end if;
  delete from waitlist where email = btrim(coalesce(p_email, ''))::citext returning * into row_;
  if row_.email is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'waitlist_remove', null, null, jsonb_build_object(
    'source', row_.source,
    'joined_on', (row_.created_at at time zone 'Asia/Manila')::date,
    'had_account', row_.user_id is not null,
    'note', btrim(p_note)));
  return jsonb_build_object('result', 'removed');
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.mod_waitlist_state(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.mod_require_moderator() from public, anon, authenticated;
revoke all on function public.mod_waitlist_summary() from public, anon;
revoke all on function public.mod_waitlist(text, text, int, int) from public, anon;
revoke all on function public.mod_waitlist_export() from public, anon;
revoke all on function public.mod_waitlist_remove(text, text) from public, anon;
grant execute on function public.mod_waitlist_summary() to authenticated;
grant execute on function public.mod_waitlist(text, text, int, int) to authenticated;
grant execute on function public.mod_waitlist_export() to authenticated;
grant execute on function public.mod_waitlist_remove(text, text) to authenticated;
