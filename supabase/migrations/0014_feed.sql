-- 0014 — Jars feed: feed_page, feed_authors and feed_seen_at (FR-SOC-01; D-9; M3-03).
-- Additive only: one new column, a guard trigger and three functions. No column is dropped or renamed.
--
-- The feed is the published jars of the authors the caller reads (follows), newest update first.
--   * Visibility is not re-implemented. feed_page and feed_authors run as the caller (security invoker),
--     so the jars_select and moments_others_select policies (can_view_jar, 0001) still decide what
--     comes back, and the queries also call can_view_jar explicitly. On top of that the feed takes only:
--     authors the caller follows, never the caller's own jars, published jars, and jars with at least
--     one live, non-private moment. Blocked users (either way) are out through can_view_jar.
--   * feed_at, the jar's "latest update": the later of published_at and the newest added_at (server
--     clock, rule 6) of the jar's live, non-private moments. jars.updated_at is not used: it also moves
--     for private, unchecked and removed moments and for owner edits, which would leak activity
--     readers can't see (rule 9).
--   * Order: feed_at desc, then jar id desc. Pages hold 20 jars. The cursor is the (feed_at, jar_id) of
--     the last row of the previous page; the next page is the rows strictly below it. A jar published
--     or updated after the first page has a newer feed_at, so it sorts above the cursor: later pages
--     never repeat or skip a row because of it (pull to refresh shows it at the top).
--   * Previews: up to 4 live, non-private moments with a thumbnail, in the fixed slot order (like the
--     month_jars cover, 0009). preview_moment_ids go to fn:photo-urls; preview_thumb_paths are the keys
--     it will sign. visible_count is the count readers see (D-9), for the mosaic's "+n".
--   * New: a jar is new when feed_at is later than the caller's feed_seen_at (or the caller never opened
--     the feed). mark_feed_seen() sets feed_seen_at to the server clock; feed_authors() gives the avatar
--     row with a has_new flag per author (the "new jar" ring).

-- ---------------------------------------------------------------- feed_seen_at
alter table public.profiles add column feed_seen_at timestamptz;
comment on column public.profiles.feed_seen_at is
  'When the owner last opened the Jars feed, server clock. Set only by mark_feed_seen() (0014).';
-- Not added to the authenticated column grants (0002): when someone last opened their feed is the
-- owner's own business. The owner reads it through my_profile() and the feed functions.

-- Clients can't set it (insert or update); mark_feed_seen() runs as the definer and uses now().
create or replace function public.profiles_guard_feed_seen() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.feed_seen_at := null;
  elsif new.feed_seen_at is distinct from old.feed_seen_at then
    raise exception 'feed_seen_at is set by mark_feed_seen()' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_feed_seen before insert or update on public.profiles
  for each row execute function public.profiles_guard_feed_seen();

create or replace function public.mark_feed_seen() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  seen timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in to use the feed' using errcode = '42501';
  end if;
  update profiles set feed_seen_at = now() where id = auth.uid() returning feed_seen_at into seen;
  return seen;
end $$;
revoke execute on function public.mark_feed_seen() from public, anon;
grant execute on function public.mark_feed_seen() to authenticated;

-- ---------------------------------------------------------------- feed_page
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
  is_new boolean
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
         v.preview_ids, v.preview_paths, f.feed_at > coalesce(seen, '-infinity'::timestamptz)
  from follows fo
  join jars j on j.user_id = fo.author_id
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           max(m.added_at) as last_added,
           coalesce((array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.slot) filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths
    from moments m
    where m.jar_id = j.id and m.status = 'live' and not m.is_private
  ) v
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where fo.reader_id = uid
    and j.user_id <> uid
    and j.published_at is not null
    and j.visibility in ('readers', 'everyone')
    and can_view_jar(uid, j)
    and v.n > 0
    and (feed_page.cursor_at is null or (f.feed_at, j.id) < (feed_page.cursor_at, feed_page.cursor_id))
  order by f.feed_at desc, j.id desc
  limit 20;
end $$;
revoke execute on function public.feed_page(timestamptz, uuid) from public, anon;
grant execute on function public.feed_page(timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------- feed_authors
-- The avatar row: every author the caller reads whose profile the caller can see (active, not blocked
-- either way), with their latest feed jar and whether it is new. Authors with a new jar first, then by
-- latest_at, then username; authors with no visible jar are included (latest_at null).
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
    join moments m on m.jar_id = j.id and m.status = 'live' and not m.is_private
    where j.user_id = p.id
      and j.published_at is not null
      and j.visibility in ('readers', 'everyone')
      and can_view_jar(uid, j)
  ) l
  where fo.reader_id = uid
    and p.id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, p.id)
  order by has_new desc, l.latest_at desc nulls last, p.username;
end $$;
revoke execute on function public.feed_authors() from public, anon;
grant execute on function public.feed_authors() to authenticated;
