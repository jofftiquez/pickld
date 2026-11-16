-- 0151 — Mute (AGENTS.md "Product principles": people control what they see). Additive: one table, one trigger;
-- seven feed functions are re-created with the same signatures (create or replace keeps grants and comments).
--
-- Muting an author keeps you their reader but takes their posts out of your Moments and Jars timelines, the date
-- scrubber's days and the avatar row. Nothing else changes: you still see them on their profile and jar pages,
-- and they are never told. Mutes are private to the person who made them (RLS: muter only), unlike follows,
-- which are public. Stopping reading someone ends the mute, so reading them again starts unmuted. Posts by
-- authors never push to readers (full_jar is in-app only, 0020), so there is no push to silence.

-- ---------------------------------------------------------------- mutes
create table public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
comment on table public.mutes is
  'Authors a reader muted (0151): still read, but out of that reader''s timelines. Private to the muter.';
alter table public.mutes enable row level security;
revoke all on public.mutes from anon, authenticated;
grant select, insert, delete on public.mutes to authenticated;
create policy mutes_owner on public.mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());
create policy mutes_active_insert on public.mutes as restrictive for insert to authenticated
  with check (public.is_active_user());

-- Stopping reading someone ends the mute.
create or replace function public.follows_clear_mute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from mutes where muter_id = old.reader_id and muted_id = old.author_id;
  return old;
end $$;
create trigger follows_clear_mute after delete on public.follows
  for each row execute function public.follows_clear_mute();

-- ---------------------------------------------------------------- moments_feed_page
-- As 0068, plus the mute filter.
create or replace function public.moments_feed_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
  if (moments_feed_page.cursor_at is null) <> (moments_feed_page.cursor_id is null) then
    raise exception 'cursor_at and cursor_id go together' using errcode = '22023';
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
    select fo.author_id from follows fo where fo.reader_id = uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
  ) a
  cross join lateral (
    select mm.*
    from moments mm
    where mm.user_id = a.author_id
      and mm.status = 'live'
      and mm.hidden_at is null
      and (moments_feed_page.cursor_at is null
           or (mm.added_at, mm.id) < (moments_feed_page.cursor_at, moments_feed_page.cursor_id))
      and can_view_moment(uid, mm)
    order by mm.added_at desc, mm.id desc
    limit 20
  ) m
  join profiles p on p.id = m.user_id
  join jars j on j.id = m.jar_id
  cross join lateral (select can_view_jar(uid, j) as ok) jv
  order by m.added_at desc, m.id desc
  limit 20;
end $$;

-- ---------------------------------------------------------------- moments_feed_page_newer
-- As 0140, plus the mute filter.
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
    select fo.author_id from follows fo where fo.reader_id = uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
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

-- ---------------------------------------------------------------- moments_feed_days
-- As 0140, plus the mute filter.
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
    select fo.author_id from follows fo where fo.reader_id = uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
  ) a
  join moments m on m.user_id = a.author_id
  where m.status = 'live'
    and m.hidden_at is null
    and can_view_moment(uid, m)
  group by d
  order by d desc;
end $$;

-- ---------------------------------------------------------------- feed_page
-- As 0144, plus the mute filter.
create or replace function public.feed_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
  cover_moment_id uuid,
  added_later boolean
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
  if (feed_page.cursor_at is null) <> (feed_page.cursor_id is null) then
    raise exception 'cursor_at and cursor_id go together' using errcode = '22023';
  end if;
  select p.feed_seen_at into seen from my_profile() p;

  return query
  select j.id, j.user_id, p.username::text, p.display_name, p.avatar_path, j.local_date, j.visibility,
         j.published_at, f.feed_at, v.n, j.like_count, j.comment_count,
         pv.preview_ids, pv.preview_paths, v.last_caption,
         j.user_id <> uid and f.feed_at > coalesce(seen, '-infinity'::timestamptz),
         v.cover_id, v.added_later
  from (
    select uid as author_id
    union all
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
  ) a
  join jars j on j.user_id = a.author_id
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           max(m.added_at) as last_added,
           (array_agg(m.caption order by m.added_at desc, m.slot desc) filter (where nullif(btrim(m.caption), '') is not null))[1] as last_caption,
           -- The resolved cover (0069): the owner's pick if this viewer sees it, else the newest caption,
           -- else the first slot, among the moments with a thumbnail the card can show.
           coalesce(
             (array_agg(m.id) filter (where m.id = j.cover_moment_id and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.added_at desc, m.slot desc)
                filter (where nullif(btrim(m.caption), '') is not null and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1]
           ) as cover_id,
           -- "Added later" (0144): a moment this viewer sees went in after the jar's day ended.
           coalesce(bool_or(m.is_backfilled), false) as added_later
    from moments m
    -- can_view_moment for this jar: every other author here is one the caller reads and can_view_jar has
    -- checked blocks and status, so readers and everyone moments are both theirs to see. (Written out, not
    -- called: an invoker function can't pass a whole moments row, pending_* aren't granted, 0004.)
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or m.visibility <> 'only_me')
  ) v
  cross join lateral (
    -- The mosaic: the cover first, then slot order.
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
    and (feed_page.cursor_at is null or (f.feed_at, j.id) < (feed_page.cursor_at, feed_page.cursor_id))
  order by f.feed_at desc, j.id desc
  limit 20;
end $$;

-- ---------------------------------------------------------------- feed_page_newer
-- As 0144, plus the mute filter.
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
  cover_moment_id uuid,
  added_later boolean
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
         v.cover_id, v.added_later
  from (
    select uid as author_id
    union all
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
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
           ) as cover_id,
           -- "Added later" (0144): a moment this viewer sees went in after the jar's day ended.
           coalesce(bool_or(m.is_backfilled), false) as added_later
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

-- ---------------------------------------------------------------- feed_days
-- As 0140, plus the mute filter.
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
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
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

-- ---------------------------------------------------------------- feed_authors
-- As 0066, plus the mute filter.
create or replace function public.feed_authors()
returns table (
  author_id uuid,
  username text,
  display_name text,
  avatar_path text,
  latest_at timestamptz,
  has_new boolean
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
  select p.feed_seen_at into seen from my_profile() p;

  return query
  select p.id, p.username::text, p.display_name, p.avatar_path, l.latest_at,
         coalesce(l.latest_at > coalesce(seen, '-infinity'::timestamptz), false) as has_new
  from follows fo
  join profiles p on p.id = fo.author_id
  cross join lateral (
    select max(greatest(j.published_at, m.added_at)) as latest_at
    from jars j
    -- Followed authors only, checked by can_view_jar: readers and everyone moments are visible (as feed_page).
    join moments m on m.jar_id = j.id and m.status = 'live' and m.hidden_at is null and m.visibility <> 'only_me'
    where j.user_id = p.id
      and j.published_at is not null
      and j.visibility in ('readers', 'everyone')
      and can_view_jar(uid, j)
  ) l
  where fo.reader_id = uid
    and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
    and p.id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, p.id)
  order by has_new desc, l.latest_at desc nulls last, p.username;
end $$;

