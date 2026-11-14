-- 0090 — The moderation console becomes a dashboard (FR-MOD-06 Overview, FR-MOD-07 Users, D-132). Additive:
-- new functions and one trigger; nothing is dropped, renamed or rewritten.
--
-- Read side (security definer, owned by the migration owner because two of them read auth.users for the
-- email): mod_overview(), mod_user_search(), mod_user() and mod_user_moments(). Each refuses anyone without
-- app_metadata.role = 'moderator' in the JWT, like mod_queue() (0042), and returns text and ids only; photos
-- still go through fn:photo-urls.
--
-- Write side (owned by pickld_moderation, like mod_decide() in 0041): mod_suspend() and mod_lift_suspension().
-- A moderator may suspend an active account for 7 days, or lift a 7-day suspension early, with a required
-- note; both write an audit row. Nobody acts on their own account. A child-safety suspension (no end date,
-- D-41) can't be lifted here.
--
-- A manual suspension lasts its 7 days: an overturned appeal (mod_decide) only lifts strike suspensions. The
-- profiles_keep_manual_suspension trigger skips that lift (so mod_decide writes no audit row for it); the
-- expiry job and mod_lift_suspension() still lift it.

-- ---------------------------------------------------------------- helpers
create or replace function public.mod_day_start() returns timestamptz
language sql stable as $$
  -- Today starts at midnight in Manila, where the team works.
  select date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
$$;

-- The latest suspend audit row for a profile, if a moderator wrote it (data.manual).
create or replace function public.mod_manual_suspension(p_user uuid)
returns table (actor_id uuid, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.actor_id, a.data ->> 'note', a.created_at
  from audit_log a
  where a.action = 'suspend' and a.target = 'profile' and a.target_id = p_user
  order by a.id desc
  limit 1
$$;
revoke execute on function public.mod_manual_suspension(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- Overview
create or replace function public.mod_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  day_start timestamptz := mod_day_start();
  week_start timestamptz := mod_day_start() - interval '6 days';
  out jsonb;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'queue', (
      select jsonb_build_object(
        'open', count(*),
        'pending', count(*) filter (where status = 'pending'),
        'escalated', count(*) filter (where status = 'escalated'),
        'oldest_seconds', coalesce(extract(epoch from now() - min(created_at)), 0)::int,
        'median_wait_seconds',
          coalesce(extract(epoch from percentile_cont(0.5) within group (order by now() - created_at)), 0)::int,
        'over_two_hours', count(*) filter (where created_at < now() - interval '2 hours'))
      from moderation_items where status in ('pending', 'escalated')),
    'today', jsonb_build_object(
      'reports', (select count(*) from reports where created_at >= day_start),
      'appeals_opened', (select count(*) from appeals where created_at >= day_start),
      'appeals_decided', (select count(*) from audit_log where created_at >= day_start
                            and data ->> 'result' in ('overturned', 'upheld')),
      'removed_auto', (select count(*) from moderation_items
                       where status = 'removed' and decided_by is null and source = 'auto_check'
                         and coalesce(decided_at, created_at) >= day_start),
      'removed_by_moderators', (select count(*) from audit_log where created_at >= day_start
                                  and action in ('remove', 'remove_warn') and data ->> 'result' = 'removed'),
      'kept', (select count(*) from audit_log where created_at >= day_start
                 and action = 'keep' and data ->> 'result' = 'kept'),
      'suspensions', (select count(*) from audit_log where created_at >= day_start and action = 'suspend'),
      'decisions', coalesce((
        select jsonb_agg(jsonb_build_object('username', d.username, 'count', d.n) order by d.n desc, d.username)
        from (select coalesce(p.username::text, left(a.actor_id::text, 8)) as username, count(*) as n
              from audit_log a left join profiles p on p.id = a.actor_id
              where a.created_at >= day_start and a.actor_id is not null
                and a.action in ('keep', 'remove', 'remove_warn', 'escalate')
              group by 1) d), '[]'::jsonb)),
    'suspended', (
      select jsonb_build_object(
        'total', count(*),
        'child_safety', count(*) filter (where suspended_until is null))
      from profiles where status = 'suspended'),
    'people', jsonb_build_object(
      'signups_today', (select count(*) from profiles where created_at >= day_start),
      'signups_week', (select count(*) from profiles where created_at >= week_start),
      'posted_today', (select count(distinct user_id) from moments where added_at >= day_start),
      'posted_week', (select count(distinct user_id) from moments where added_at >= week_start),
      'moments_today', (select count(*) from moments where added_at >= day_start)),
    -- Uploaded but never finished: still Uploading or Checking after 30 minutes with nothing in the queue
    -- for it (a queued moment is waiting for a moderator, not stuck).
    'stuck_uploads', (
      select count(*) from moments m
      where m.status in ('uploading', 'checking') and m.added_at < now() - interval '30 minutes'
        and not exists (select 1 from moderation_items mi
                        where mi.moment_id = m.id and mi.status in ('pending', 'escalated')))
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------- Users: search
-- Matches a username or name (part of it), an exact email, or a user id. Exact username first, then newest.
create or replace function public.mod_user_search(p_query text, p_limit int default 50)
returns table (
  id uuid,
  username text,
  display_name text,
  status profile_status,
  suspended_until timestamptz,
  created_at timestamptz,
  strikes int,
  moment_count int,
  open_reports int
)
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  q text := btrim(coalesce(p_query, ''));
  pattern text;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if char_length(q) > 254 then
    raise exception 'query is at most 254 characters' using errcode = '22023';
  end if;
  pattern := '%' || replace(replace(replace(ltrim(q, '@'), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  select p.id, p.username::text, p.display_name, p.status, p.suspended_until, p.created_at,
         strike_count(p.id),
         (select count(*)::int from moments m where m.user_id = p.id),
         (select count(*)::int from reports r
          where r.status = 'open'
            and (r.target_id = p.id
                 or r.target_id in (select m.id from moments m where m.user_id = p.id)
                 or r.target_id in (select c.id from comments c where c.user_id = p.id)
                 or r.target_id in (select j.id from jars j where j.user_id = p.id)))
  from profiles p
  where q = ''
     or (q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and p.id = q::uuid)
     or (position('@' in ltrim(q, '@')) > 0
         and p.id in (select u.id from auth.users u where lower(u.email) = lower(q)))
     or p.username ilike pattern
     or p.display_name ilike pattern
  order by (lower(p.username::text) = lower(ltrim(q, '@'))) desc, p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

-- ---------------------------------------------------------------- Users: one person
-- Profile, suspension, strikes, reports against and by them, and the audit history about them or their
-- content. Null for an unknown id.
create or replace function public.mod_user(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  p profiles;
  manual record;
  kind text;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  select * into p from profiles where id = p_user;
  if p.id is null then
    return null;
  end if;
  select * into manual from mod_manual_suspension(p.id);
  kind := case
    when p.status <> 'suspended' then null
    when p.suspended_until is null then 'child_safety'
    when manual.actor_id is not null then 'manual'
    else 'strikes' end;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'status', p.status, 'suspended_until', p.suspended_until, 'created_at', p.created_at,
      'home_tz', p.home_tz, 'reader_count', p.reader_count, 'author_count', p.author_count,
      'jar_count', p.jar_count,
      'email', (select u.email from auth.users u where u.id = p.id)),
    'suspension', case when kind is null then null else jsonb_build_object(
      'kind', kind, 'until', p.suspended_until,
      'note', case when kind = 'manual' then manual.note end,
      'by', case when kind = 'manual' then (select username from profiles where id = manual.actor_id) end)
    end,
    'moments', (
      select jsonb_build_object(
        'total', count(*),
        'live', count(*) filter (where status = 'live'),
        'checking', count(*) filter (where status in ('uploading', 'checking')),
        'removed', count(*) filter (where status = 'removed'))
      from moments where user_id = p.id),
    'strikes', jsonb_build_object(
      'count', strike_count(p.id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'item_id', s.id, 'kind', s.kind, 'target_id', s.target_id, 'source', s.source,
                 'guideline', s.decision_reason, 'decided_at', s.decided_at, 'appeal', s.appeal)
               order by s.decided_at desc)
        from (
          select mi.id, case when mi.moment_id is not null then 'moment' else 'comment' end as kind,
                 coalesce(mi.moment_id, mi.comment_id) as target_id, mi.source, mi.decision_reason,
                 mi.decided_at, a.status as appeal
          from moderation_items mi
          left join moments m on m.id = mi.moment_id
          left join comments c on c.id = mi.comment_id
          left join appeals a on a.moderation_item_id = mi.id
          where mi.source in ('auto_check', 'report') and mi.status = 'removed'
            and mi.decided_at > now() - interval '90 days'
            and coalesce(m.user_id, c.user_id) = p.id
            and (a.status is null or a.status <> 'overturned')) s), '[]'::jsonb)),
    'reports_against', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'created_at', r.created_at, 'reason', r.reason, 'target', r.target,
               'target_id', r.target_id, 'note', r.note, 'status', r.status,
               'reporter', (select username from profiles where id = r.reporter_id))
             order by r.created_at desc)
      from (select * from reports r
            where r.target_id = p.id
               or r.target_id in (select id from moments where user_id = p.id)
               or r.target_id in (select id from comments where user_id = p.id)
               or r.target_id in (select id from jars where user_id = p.id)
            order by r.created_at desc limit 50) r), '[]'::jsonb),
    'reports_filed', jsonb_build_object(
      'total', (select count(*) from reports where reporter_id = p.id),
      'week', (select count(*) from reports where reporter_id = p.id and created_at > now() - interval '7 days')),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'created_at', a.created_at, 'action', a.action, 'target', a.target,
               'target_id', a.target_id, 'data', a.data,
               'actor', (select username from profiles where id = a.actor_id))
             order by a.id desc)
      from (select * from audit_log a
            where a.target_id = p.id
               or a.target_id in (select id from moments where user_id = p.id)
               or a.target_id in (select id from comments where user_id = p.id)
               or a.target_id in (select id from jars where user_id = p.id)
            order by a.id desc limit 50) a), '[]'::jsonb),
    'can_suspend', p.status = 'active' and p.id <> (claims ->> 'sub')::uuid,
    'can_lift', coalesce(kind in ('strikes', 'manual'), false) and p.id <> (claims ->> 'sub')::uuid
  );
end $$;

-- ---------------------------------------------------------------- Users: their moments
-- Newest first. Only-me moments stay out unless they were ever queued (rule 9: private moments never leave
-- their owner, except to moderators when something flagged them).
create or replace function public.mod_user_moments(p_user uuid, p_limit int default 60)
returns table (
  id uuid,
  local_date date,
  slot slot,
  status moment_status,
  visibility jar_visibility,
  caption text,
  added_at timestamptz,
  hidden boolean,
  moderation text      -- the latest item's status (pending, escalated, kept, removed), null if never queued
)
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return query
  select m.id, j.local_date, m.slot, m.status, m.visibility, m.caption, m.added_at, m.hidden_at is not null,
         (select mi.status::text from moderation_items mi where mi.moment_id = m.id
          order by mi.created_at desc limit 1)
  from moments m
  join jars j on j.id = m.jar_id
  where m.user_id = p_user
    and (m.visibility <> 'only_me' or exists (select 1 from moderation_items mi where mi.moment_id = m.id))
  order by m.added_at desc, m.id
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
end $$;

-- ---------------------------------------------------------------- suspend and lift (D-132)
-- Results: suspended | lifted, or not_found | own_account | not_active | not_suspended | child_safety.
create or replace function public.mod_suspend(p_user uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
  p profiles;
  until timestamptz := now() + interval '7 days';
begin
  if actor is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) = 0 or char_length(p_note) > 500 then
    raise exception 'a note of 1 to 500 characters is required' using errcode = '22023';
  end if;
  select * into p from profiles where id = p_user for update;
  if p.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if p.id = actor then
    return jsonb_build_object('result', 'own_account');
  end if;
  if p.status <> 'active' then
    return jsonb_build_object('result', 'not_active', 'status', p.status);
  end if;
  update profiles set status = 'suspended', suspended_until = until where id = p.id;
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'suspend', 'profile', p.id,
          jsonb_build_object('manual', true, 'until', until, 'note', btrim(p_note)));
  return jsonb_build_object('result', 'suspended', 'until', until);
end $$;

create or replace function public.mod_lift_suspension(p_user uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
  p profiles;
begin
  if actor is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) = 0 or char_length(p_note) > 500 then
    raise exception 'a note of 1 to 500 characters is required' using errcode = '22023';
  end if;
  select * into p from profiles where id = p_user for update;
  if p.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if p.id = actor then
    return jsonb_build_object('result', 'own_account');
  end if;
  if p.status <> 'suspended' then
    return jsonb_build_object('result', 'not_suspended');
  end if;
  if p.suspended_until is null then
    return jsonb_build_object('result', 'child_safety');
  end if;
  perform set_config('pickld.lift_manual', 'on', true);
  update profiles set status = 'active', suspended_until = null where id = p.id;
  perform set_config('pickld.lift_manual', '', true);
  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, 'lift_suspension', 'profile', p.id,
          jsonb_build_object('reason', 'moderator', 'note', btrim(p_note)));
  return jsonb_build_object('result', 'lifted');
end $$;

-- An overturned appeal lifts strike suspensions only (mod_decide, 0041). Returning null skips the update, so
-- mod_decide sees no row and writes no lift row. Expired suspensions and mod_lift_suspension() go through.
create or replace function public.profiles_keep_manual_suspension() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'suspended' and new.status = 'active' and old.suspended_until > now()
     and coalesce(current_setting('pickld.lift_manual', true), '') <> 'on'
     and exists (select 1 from mod_manual_suspension(old.id) s where s.actor_id is not null) then
    return null;
  end if;
  return new;
end $$;
create trigger profiles_keep_manual_suspension before update of status on public.profiles
  for each row execute function public.profiles_keep_manual_suspension();

-- ---------------------------------------------------------------- ownership and grants
grant create on schema public to pickld_moderation;
alter function public.mod_suspend(uuid, text) owner to pickld_moderation;
alter function public.mod_lift_suspension(uuid, text) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;

revoke all on function public.mod_day_start() from public, anon;
revoke all on function public.profiles_keep_manual_suspension() from public, anon, authenticated;
revoke all on function public.mod_overview() from public, anon;
revoke all on function public.mod_user_search(text, int) from public, anon;
revoke all on function public.mod_user(uuid) from public, anon;
revoke all on function public.mod_user_moments(uuid, int) from public, anon;
revoke all on function public.mod_suspend(uuid, text) from public, anon;
revoke all on function public.mod_lift_suspension(uuid, text) from public, anon;
grant execute on function public.mod_overview() to authenticated;
grant execute on function public.mod_user_search(text, int) to authenticated;
grant execute on function public.mod_user(uuid) to authenticated;
grant execute on function public.mod_user_moments(uuid, int) to authenticated;
grant execute on function public.mod_suspend(uuid, text) to authenticated;
grant execute on function public.mod_lift_suspension(uuid, text) to authenticated;
