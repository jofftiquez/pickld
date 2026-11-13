-- 0067 — Moments timeline (QA round 1, piece 5; D-48, D-50, D-53, D-67; FR-SOC-01, FR-SOC-02, FR-SOC-04).
-- Additive only: one index and two functions. Nothing is dropped or renamed.
--
-- moments_feed_page(cursor_at, cursor_id): the Moments tab. Live moments from the authors the caller reads
-- plus the caller's own (D-53), newest added_at first (server clock, rule 6), 20 per page.
--   * Who sees what is can_view_moment (0066), called on every row: the owner sees their own moments of any
--     visibility, Only me included; anyone else a live, not hidden moment of an active owner with no block
--     either way, whose visibility is everyone, or readers and the caller reads the owner. On top of that the
--     timeline takes only the caller and the authors they read (an Everyone moment of a stranger is Explore's
--     business, not this timeline's), only live moments (a checking or removed one, even the caller's own,
--     isn't in a timeline), and no hidden moments (a report under review), as feed_page does for jars.
--   * It runs as the definer, like moment_photo_paths (0007): an invoker function can't pass a whole moments
--     row to can_view_moment, because pending_* aren't granted to clients (0004). It returns only the
--     columns below, never pending_*, and refuses callers who aren't signed in.
--   * Order: added_at desc, then moment id desc. The cursor is the (added_at, moment_id) of the last row of the
--     previous page and the next page is the rows strictly below it, so a moment that goes live after the
--     first page sorts above the cursor and later pages never repeat or skip one (pull to refresh shows it).
--   * Each author's newest 20 below the cursor come off moments_user_live_added_idx, then the merge keeps 20.
--   * liked: the caller's own like on the moment (FR-SOC-05). comment_count: the jar's thread for now, and
--     only when the caller may open that jar (can_view_jar), else 0; jar_visible says whether they may.
--     Moment threads (piece 6, 0068) will give each moment its own count.
--
-- moment_jar(p_jar): Moment detail for a moment whose jar the caller can't open. Since 0066 a moment is
-- visible once it is live, before its jar is published (D-48), but the jar row still waits for Publish jar
-- (jars_select, can_view_jar). Moment detail swipes through the jar's moments and formats times in the
-- jar's zone, so it reads the jar's id, owner, date and zone here, only when the caller may see at least one
-- live moment in it (can_view_moment). The jar's counts are returned only when the caller may open the jar,
-- else 0: an unpublished jar's numbers stay the owner's (D-67).

-- ---------------------------------------------------------------- index
create index if not exists moments_user_live_added_idx
  on public.moments (user_id, added_at desc, id desc) where status = 'live';

-- ---------------------------------------------------------------- moments_feed_page
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
         case when jv.ok then j.comment_count else 0 end,
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
revoke execute on function public.moments_feed_page(timestamptz, uuid) from public, anon;
grant execute on function public.moments_feed_page(timestamptz, uuid) to authenticated;
comment on function public.moments_feed_page(timestamptz, uuid) is
  'Moments timeline: live moments the caller may see (can_view_moment) from authors they read and their own, newest added_at first, 20 per page, cursor (added_at, moment_id) (0067).';

-- ---------------------------------------------------------------- moment_jar
create or replace function public.moment_jar(p_jar uuid)
returns table (
  id uuid,
  user_id uuid,
  local_date date,
  tz text,
  moment_count int,
  visible_count int,
  like_count int,
  comment_count int
)
language sql stable security definer set search_path = public as $$
  select j.id, j.user_id, j.local_date, j.tz,
         (case when v.ok then j.moment_count else 0 end)::int,
         (case when v.ok then j.visible_count else 0 end)::int,
         (case when v.ok then j.like_count else 0 end)::int,
         (case when v.ok then j.comment_count else 0 end)::int
  from jars j
  cross join lateral (select can_view_jar(auth.uid(), j) as ok) v
  where j.id = p_jar
    and auth.uid() is not null
    and exists (select 1 from moments m
                where m.jar_id = j.id and m.status = 'live' and can_view_moment(auth.uid(), m))
$$;
revoke execute on function public.moment_jar(uuid) from public, anon;
grant execute on function public.moment_jar(uuid) to authenticated;
comment on function public.moment_jar(uuid) is
  'Moment detail: a jar''s id, owner, date and zone when the caller may see a live moment in it; its counts only when they may open the jar, else 0 (0067).';
