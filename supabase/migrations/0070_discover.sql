-- 0070 — Discover (QA round 3, piece K; D-100, D-101, D-102; FR-EXP-03, FR-EXP-04).
-- Additive only: two indexes and two functions. Nothing is dropped or renamed.
--
-- Explore becomes Discover (D-100): under people search and Suggested people, a Moments | Jars switch lists
-- public content from people the caller doesn't read yet. Two pages, 20 rows each, newest first:
--
-- discover_moments_page(cursor_at, cursor_id): the Moments list. The same columns as moments_feed_page
-- (0067, 0068), so the app reuses its card and model. A row is a moment that is (D-102):
--   * visibility everyone, status live, hidden_at null (a report under review hides it);
--   * of an owner whose profile is active, with no block either way (is_blocked_between);
--   * not the caller's own, and of an owner the caller doesn't read (reading them, it is in their Moments
--     timeline already);
--   * and, on top of those rules, one can_view_moment (0066) allows, so Discover never shows more than RLS.
--   A moment of a jar that isn't published yet is listed, as on the timeline (a moment is visible once live,
--   D-48); jar_visible (can_view_jar) says whether the caller may open its jar.
--   Order: added_at desc, then moment id desc; the cursor is the last row's (added_at, moment_id).
--
-- discover_jars_page(cursor_at, cursor_id): the Jars list. The same columns as feed_page (0069), so the app
-- reuses its card and model. A row is a jar that is (D-102):
--   * published, with jar visibility everyone, holding at least one moment that would be listed above
--     (live, everyone, not hidden);
--   * of an active owner with no block either way, not the caller, whom the caller doesn't read;
--   * and one can_view_jar (0001) allows.
--   Its count, last caption, previews and cover come from those everyone moments only, like public_jar and
--   full_jars_today (0066, 0069): a readers or only_me moment never adds to the count, the mosaic or the
--   caption, and an owner's pick that isn't one of them falls back to the newest caption, else the first slot.
--   feed_at is published_at (jars are ordered by when they were published, D-102), is_new is false.
--   Order: published_at desc, then jar id desc; the cursor is the last row's (feed_at, jar_id).
--
-- Both run as the definer, like moments_feed_page: can_view_moment takes a whole moments row and pending_*
-- aren't granted to clients (0004). They return only the columns below, never pending_*, refuse callers who
-- aren't signed in, and are revoked from public and anon.

-- ---------------------------------------------------------------- indexes
-- Discover moments: everyone's live public moments, newest first, without a per-author fan-out.
create index if not exists moments_everyone_live_added_idx
  on public.moments (added_at desc, id desc) where status = 'live' and visibility = 'everyone';
-- Discover jars: published Everyone jars, newest published first.
create index if not exists jars_everyone_published_idx
  on public.jars (published_at desc, id desc) where visibility = 'everyone' and published_at is not null;

-- ---------------------------------------------------------------- discover_moments_page
create or replace function public.discover_moments_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
    raise exception 'sign in to use Discover' using errcode = '42501';
  end if;
  if (discover_moments_page.cursor_at is null) <> (discover_moments_page.cursor_id is null) then
    raise exception 'cursor_at and cursor_id go together' using errcode = '22023';
  end if;

  return query
  select m.id, m.jar_id, m.user_id, p.username::text, p.display_name, p.avatar_path, m.slot, m.caption,
         m.captured_at, m.added_at, m.is_backfilled, m.visibility, m.edits, m.like_count,
         exists (select 1 from reactions r
                 where r.user_id = uid and r.target = 'moment' and r.target_id = m.id),
         m.comment_count,
         j.tz, j.local_date, jv.ok
  from moments m
  join profiles p on p.id = m.user_id
  join jars j on j.id = m.jar_id
  cross join lateral (select can_view_jar(uid, j) as ok) jv
  where m.status = 'live'
    and m.visibility = 'everyone'
    and m.hidden_at is null
    and m.user_id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, m.user_id)
    and not exists (select 1 from follows fo where fo.reader_id = uid and fo.author_id = m.user_id)
    and (discover_moments_page.cursor_at is null
         or (m.added_at, m.id) < (discover_moments_page.cursor_at, discover_moments_page.cursor_id))
    and can_view_moment(uid, m)
  order by m.added_at desc, m.id desc
  limit 20;
end $$;
revoke execute on function public.discover_moments_page(timestamptz, uuid) from public, anon;
grant execute on function public.discover_moments_page(timestamptz, uuid) to authenticated;
comment on function public.discover_moments_page(timestamptz, uuid) is
  'Discover moments: live, not hidden Everyone moments of active people the caller doesn''t read, with no block either way and never the caller''s own, newest added_at first, 20 per page, cursor (added_at, moment_id); moments_feed_page''s columns (0070, D-102).';

-- ---------------------------------------------------------------- discover_jars_page
create or replace function public.discover_jars_page(cursor_at timestamptz default null, cursor_id uuid default null)
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
         pv.preview_ids, pv.preview_paths, v.last_caption, false, v.cover_id
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
           ) as cover_id
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
  'Discover jars: published Everyone jars with at least one live, not hidden Everyone moment, of active people the caller doesn''t read, with no block either way and never the caller''s own; count, caption, previews and cover from those Everyone moments only; newest published_at first, 20 per page, cursor (feed_at = published_at, jar_id); feed_page''s columns (0070, D-102).';
