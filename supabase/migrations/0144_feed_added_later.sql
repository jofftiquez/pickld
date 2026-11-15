-- 0144 — "Added later" on the Jars timeline card (FR-SOC-01, FR-SOC-03; D-48 kept).
-- Three functions are dropped and re-created with one more column, as 0069 did for feed_page (a function,
-- not a schema drop; grants and comments are restored). No table changes; nothing else is dropped or renamed.
--
-- The timelines stay ordered by when things were added in Pickld (server clock, rule 6), not by the photo's
-- day: a moment backfilled today sits with today's posts, and a jar rises when a moment is added to it. So a
-- reader can tell a backfill from a fresh day, the Jars card now says when a jar holds moments added after its
-- day ended, and which day the jar is (local_date, already returned).
--
-- feed_page (0069), feed_page_newer (0140), discover_jars_page (0070): added_later, true when at least one of
-- the moments that viewer sees in the jar (the same per-viewer set as the count, previews and cover) has
-- is_backfilled. An Only me backfill never marks a reader's card (rule 9). Everything else is unchanged.

-- ---------------------------------------------------------------- feed_page
drop function public.feed_page(timestamptz, uuid);
create function public.feed_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
    select fo.author_id from follows fo where fo.reader_id = uid and fo.author_id <> uid
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
revoke execute on function public.feed_page(timestamptz, uuid) from public, anon;
grant execute on function public.feed_page(timestamptz, uuid) to authenticated;
comment on function public.feed_page(timestamptz, uuid) is
  'Jars timeline: published jars of the authors the caller reads and their own, with each viewer''s own moments, count and resolved cover (first in the previews), 20 per page (0014, 0066, 0069).';

-- ---------------------------------------------------------------- feed_page_newer
drop function public.feed_page_newer(timestamptz, uuid);
create function public.feed_page_newer(cursor_at timestamptz, cursor_id uuid)
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
revoke execute on function public.feed_page_newer(timestamptz, uuid) from public, anon;
grant execute on function public.feed_page_newer(timestamptz, uuid) to authenticated;
comment on function public.feed_page_newer(timestamptz, uuid) is
  'Jars timeline, the other way: the 20 rows of feed_page directly above the cursor, oldest first (0140; added_later, 0144).';

-- ---------------------------------------------------------------- discover_jars_page
drop function public.discover_jars_page(timestamptz, uuid);
create function public.discover_jars_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in to use Discover' using errcode = '42501';
  end if;
  if (discover_jars_page.cursor_at is null) <> (discover_jars_page.cursor_id is null) then
    raise exception 'cursor_at and cursor_id go together' using errcode = '22023';
  end if;

  return query
  select j.id, j.user_id, p.username::text, p.display_name, p.avatar_path, j.local_date, j.visibility,
         j.published_at, j.published_at, v.n, j.like_count, j.comment_count,
         pv.preview_ids, pv.preview_paths, v.last_caption, false, v.cover_id, v.added_later
  from jars j
  join profiles p on p.id = j.user_id
  cross join lateral (
    -- Everyone moments only (as public_jar, 0069): the count, the last caption and the resolved cover.
    select count(*)::int as n,
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
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
  ) v
  cross join lateral (
    -- The mosaic: the cover first, then slot order, Everyone moments only.
    select coalesce((array_agg(m.id order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
  ) pv
  where j.published_at is not null
    and j.visibility = 'everyone'
    and j.user_id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, j.user_id)
    and not exists (select 1 from follows fo where fo.reader_id = uid and fo.author_id = j.user_id)
    and v.n > 0
    and (discover_jars_page.cursor_at is null
         or (j.published_at, j.id) < (discover_jars_page.cursor_at, discover_jars_page.cursor_id))
    and can_view_jar(uid, j)
  order by j.published_at desc, j.id desc
  limit 20;
end $$;
revoke execute on function public.discover_jars_page(timestamptz, uuid) from public, anon;
grant execute on function public.discover_jars_page(timestamptz, uuid) to authenticated;
comment on function public.discover_jars_page(timestamptz, uuid) is
  'Discover jars: published Everyone jars with at least one live, not hidden Everyone moment, of active people the caller doesn''t read, with no block either way and never the caller''s own; count, caption, previews and cover from those Everyone moments only; newest published_at first, 20 per page, cursor (feed_at = published_at, jar_id); feed_page''s columns (0070, D-102; added_later, 0144).';
