-- 0140 — The date scrubber on the Moments and Jars timelines (FR-SOC-01, NFR-PERF-02).
-- Additive only: four functions. Nothing is dropped or renamed.
--
-- The rail on the right edge maps a drag to a day and jumps there, so the app needs to know which days hold
-- rows, and, after a jump, how to scroll up again to the newer rows above the day it landed on.
--
-- moments_feed_days(p_tz) and feed_days(p_tz): one row per day that holds rows of that timeline for the caller,
-- newest day first, with how many rows the day holds. A day is a calendar day in p_tz (the phone's IANA zone,
-- rule 7) of the value the timeline sorts by: added_at for Moments, feed_at for Jars. Who sees what is exactly
-- moments_feed_page (0068) and feed_page (0069): the same authors, statuses, hidden flags and visibility checks,
-- written out the same way. Private moments of other people never reach a count (rule 9).
--
-- moments_feed_page_newer(cursor_at, cursor_id) and feed_page_newer(cursor_at, cursor_id): the 20 rows directly
-- above a cursor, the mirror of the existing pages (which return the rows below it). They come back oldest first,
-- nearest the cursor first, so the app prepends them reversed. Same columns and checks as the older-direction
-- pages; a cursor is required.

-- ---------------------------------------------------------------- zone check
create or replace function public.check_iana_zone(p_tz text)
returns void
language plpgsql stable set search_path = public as $$
begin
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.check_iana_zone(text) from public, anon;
grant execute on function public.check_iana_zone(text) to authenticated;
comment on function public.check_iana_zone(text) is
  'Raises 22023 unless p_tz is an IANA zone name Postgres knows (rule 7) (0140).';

-- ---------------------------------------------------------------- Moments: days
create or replace function public.moments_feed_days(p_tz text)
returns table (day date, n int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in to use the feed' using errcode = '42501';
  end if;
  perform check_iana_zone(p_tz);

  return query
  select (m.added_at at time zone p_tz)::date as d, count(*)::int
  from (
    select uid as author_id
    union
    select fo.author_id from follows fo where fo.reader_id = uid
  ) a
  join moments m on m.user_id = a.author_id
  where m.status = 'live'
    and m.hidden_at is null
    and can_view_moment(uid, m)
  group by d
  order by d desc;
end $$;
revoke execute on function public.moments_feed_days(text) from public, anon;
grant execute on function public.moments_feed_days(text) to authenticated;
comment on function public.moments_feed_days(text) is
  'Moments timeline days for the scrubber: the days (added_at in p_tz) holding moments moments_feed_page would show the caller, newest first, with counts (0140).';

-- ---------------------------------------------------------------- Moments: newer page
create or replace function public.moments_feed_page_newer(cursor_at timestamptz, cursor_id uuid)
returns table (
  moment_id uuid,
  jar_id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  slot slot,
  caption text,
  captured_at timestamptz,
  added_at timestamptz,
  is_backfilled boolean,
  visibility jar_visibility,
  edits jsonb,
  like_count int,
  liked boolean,
  comment_count int,
  jar_tz text,
  jar_local_date date,
  jar_visible boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in to use the feed' using errcode = '42501';
  end if;
  if moments_feed_page_newer.cursor_at is null or moments_feed_page_newer.cursor_id is null then
    raise exception 'a cursor is required' using errcode = '22023';
  end if;

  return query
  select m.id, m.jar_id, m.user_id, p.username::text, p.display_name, p.avatar_path, m.slot, m.caption,
         m.captured_at, m.added_at, m.is_backfilled, m.visibility, m.edits, m.like_count,
         exists (select 1 from reactions r
                 where r.user_id = uid and r.target = 'moment' and r.target_id = m.id),
         m.comment_count,
         j.tz, j.local_date, jv.ok
  from (
    select uid as author_id
    union
    select fo.author_id from follows fo where fo.reader_id = uid
  ) a
  cross join lateral (
    select mm.*
    from moments mm
    where mm.user_id = a.author_id
      and mm.status = 'live'
      and mm.hidden_at is null
      and (mm.added_at, mm.id) > (moments_feed_page_newer.cursor_at, moments_feed_page_newer.cursor_id)
      and can_view_moment(uid, mm)
    order by mm.added_at asc, mm.id asc
    limit 20
  ) m
  join profiles p on p.id = m.user_id
  join jars j on j.id = m.jar_id
  cross join lateral (select can_view_jar(uid, j) as ok) jv
  order by m.added_at asc, m.id asc
  limit 20;
end $$;
revoke execute on function public.moments_feed_page_newer(timestamptz, uuid) from public, anon;
grant execute on function public.moments_feed_page_newer(timestamptz, uuid) to authenticated;
comment on function public.moments_feed_page_newer(timestamptz, uuid) is
  'Moments timeline, the other way: the 20 rows of moments_feed_page directly above the cursor, oldest first (0140).';

-- ---------------------------------------------------------------- Jars: days
create or replace function public.feed_days(p_tz text)
returns table (day date, n int)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in to use the feed' using errcode = '42501';
  end if;
  perform check_iana_zone(p_tz);

  return query
  select (f.feed_at at time zone p_tz)::date as d, count(*)::int
  from (
    select uid as author_id
    union all
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid
  ) a
  join jars j on j.user_id = a.author_id
  cross join lateral (
    -- feed_page's count and newest moment (0069), with the same per-viewer moment filter.
    select count(*)::int as n, max(m.added_at) as last_added
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or m.visibility <> 'only_me')
  ) v
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility in ('readers', 'everyone') and can_view_jar(uid, j)))
    and v.n > 0
  group by d
  order by d desc;
end $$;
revoke execute on function public.feed_days(text) from public, anon;
grant execute on function public.feed_days(text) to authenticated;
comment on function public.feed_days(text) is
  'Jars timeline days for the scrubber: the days (feed_at in p_tz) holding jars feed_page would show the caller, newest first, with counts (0140).';

-- ---------------------------------------------------------------- Jars: newer page
create or replace function public.feed_page_newer(cursor_at timestamptz, cursor_id uuid)
returns table (
  jar_id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  local_date date,
  visibility jar_visibility,
  published_at timestamptz,
  feed_at timestamptz,
  visible_count int,
  like_count int,
  comment_count int,
  preview_moment_ids uuid[],
  preview_thumb_paths text[],
  last_caption text,
  is_new boolean,
  cover_moment_id uuid
)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  seen timestamptz;
begin
  if uid is null then
    raise exception 'sign in to use the feed' using errcode = '42501';
  end if;
  if feed_page_newer.cursor_at is null or feed_page_newer.cursor_id is null then
    raise exception 'a cursor is required' using errcode = '22023';
  end if;
  select p.feed_seen_at into seen from my_profile() p;

  return query
  select j.id, j.user_id, p.username::text, p.display_name, p.avatar_path, j.local_date, j.visibility,
         j.published_at, f.feed_at, v.n, j.like_count, j.comment_count,
         pv.preview_ids, pv.preview_paths, v.last_caption,
         j.user_id <> uid and f.feed_at > coalesce(seen, '-infinity'::timestamptz),
         v.cover_id
  from (
    select uid as author_id
    union all
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid
  ) a
  join jars j on j.user_id = a.author_id
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           max(m.added_at) as last_added,
           (array_agg(m.caption order by m.added_at desc, m.slot desc) filter (where nullif(btrim(m.caption), '') is not null))[1] as last_caption,
           coalesce(
             (array_agg(m.id) filter (where m.id = j.cover_moment_id and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.added_at desc, m.slot desc)
                filter (where nullif(btrim(m.caption), '') is not null and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1]
           ) as cover_id
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or m.visibility <> 'only_me')
  ) v
  cross join lateral (
    select coalesce((array_agg(m.id order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or m.visibility <> 'only_me')
  ) pv
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility in ('readers', 'everyone') and can_view_jar(uid, j)))
    and v.n > 0
    and (f.feed_at, j.id) > (feed_page_newer.cursor_at, feed_page_newer.cursor_id)
  order by f.feed_at asc, j.id asc
  limit 20;
end $$;
revoke execute on function public.feed_page_newer(timestamptz, uuid) from public, anon;
grant execute on function public.feed_page_newer(timestamptz, uuid) to authenticated;
comment on function public.feed_page_newer(timestamptz, uuid) is
  'Jars timeline, the other way: the 20 rows of feed_page directly above the cursor, oldest first (0140).';
