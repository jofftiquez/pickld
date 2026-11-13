-- 0066 — Moment visibility (QA round 1, piece 4; D-48, D-49, D-50, D-53; FR-PUB-01, FR-PUB-02, FR-PUB-04,
-- FR-PUB-05, FR-SOC-01). Additive: one column, three functions and two triggers; functions and one policy
-- are replaced and the moments_count trigger is re-created with one more column. Nothing is dropped or
-- renamed: moments.is_private stays, derived from the new column.
--
-- Before: visibility belonged to the jar, and nobody but the owner saw a moment before its jar was
-- published (FR-PUB-02). Now each moment has its own visibility (D-48):
--   * moments.visibility: readers, everyone or only_me (the jar_visibility type). A new moment starts at
--     the owner's profiles.default_visibility when the app doesn't send one. The column default does this
--     (moment_default_visibility(): the inserting user's default, else readers), because a trigger can't
--     tell an omitted column from one sent as readers. Clients insert only their own moments (RLS
--     moments_owner), so the inserting user is the owner.
--   * A live moment is visible to whoever its visibility allows as soon as it is live (moderation still
--     decides live, rule 4), published jar or not. Publishing only puts the jar in the Jars timeline.
--   * is_private is kept for old readers and is always visibility = only_me: the moments_visibility trigger
--     sets it, and refuses an insert with is_private true unless visibility is only_me, and any update that
--     changes is_private. Writers set visibility.
--   * A replacement (0013) keeps the visibility of the moment it replaces, and a visibility change on either
--     of the two follows to the other, so a photo waiting for fn:moderate never goes live wider than the one
--     it replaces.
--
-- can_view_moment(viewer, m): the owner; or a live, not hidden moment of an active owner who hasn't blocked
-- the viewer (or been blocked by them), whose visibility is everyone, or readers and the viewer reads the
-- owner. The published-jar condition is gone. The moments_others_select policy now uses it, so every
-- direct read of moments (Today, the jar page, profiles, Moment detail) follows the rule, and so do
-- fn:photo-urls (moment_photo_paths), likes (can_view_target) and reports.
--
-- Places that filtered "not is_private" for what others see now check the moment's own visibility:
--   * feed_page, feed_authors (0014): per viewer, as can_view_moment decides. A published jar shows each viewer
--     only the moments they may see (D-50), and its count is theirs. feed_page also returns the caller's
--     own published jars (D-53, QA item 9), never marked new.
--   * public_jar, public_profile (0025, the shared web page, D-32): only everyone moments of a published
--     everyone jar, and visible_count is how many of those there are. A readers jar's teaser keeps
--     jars.visible_count. public_profile lists everyone jars with at least one everyone moment.
--   * full_jars_today (0031, Explore, D-18): everyone jars whose 8 slots hold live everyone moments, with an
--     everyone moment as the cover.
--   * notify (0019): the only_me rule reads visibility.
-- jars.visible_count (D-9) still counts live, not hidden moments that aren't only_me (moments_count_sync,
-- unchanged: is_private is exactly visibility = only_me). It's what readers can see; the RPCs above give
-- everyone else their own counts.
--
-- Existing moments (D-49; nothing hidden before this migration becomes visible):
--   * private (is_private) → only_me
--   * in a jar that isn't published → only_me
--   * in a published jar → the jar's visibility

-- ---------------------------------------------------------------- column and backfill
alter table public.moments add column visibility public.jar_visibility not null default 'readers';
-- Signed-in users read moments through a column list (0004); insert and update are table grants.
grant select (visibility) on public.moments to authenticated;

-- Rows that would stay readers keep the default; is_private is set here because the trigger below comes after.
with target as (
  select m.id,
         case when m.is_private or j.published_at is null then 'only_me'::public.jar_visibility
              else j.visibility end as visibility
  from public.moments m
  join public.jars j on j.id = m.jar_id
)
update public.moments m
set visibility = t.visibility, is_private = (t.visibility = 'only_me')
from target t
where t.id = m.id and m.visibility is distinct from t.visibility;

create or replace function public.moment_default_visibility() returns public.jar_visibility
language sql stable security definer set search_path = public as $$
  select coalesce((select default_visibility from profiles where id = auth.uid()), 'readers'::jar_visibility)
$$;
revoke execute on function public.moment_default_visibility() from public, anon;
grant execute on function public.moment_default_visibility() to authenticated, service_role;
comment on function public.moment_default_visibility() is
  'Default of moments.visibility: the inserting user''s profiles.default_visibility, else readers (0066).';

alter table public.moments alter column visibility set default public.moment_default_visibility();

-- ---------------------------------------------------------------- is_private follows visibility
create or replace function public.moments_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.is_private and new.visibility is distinct from 'only_me' then
      raise exception 'is_private follows visibility: set visibility to only_me instead' using errcode = '42501';
    end if;
    if new.replaces is not null then
      -- moments_bi_replaces (0013) already checked it is the owner's moment in the same jar and slot.
      select r.visibility into new.visibility from moments r where r.id = new.replaces;
    end if;
  elsif new.is_private is distinct from old.is_private then
    raise exception 'is_private follows visibility: update visibility instead' using errcode = '42501';
  end if;
  new.is_private := new.visibility = 'only_me';
  return new;
end $$;
-- Named to run after the other before triggers (alphabetical), so it sees their final row.
create trigger moments_visibility before insert or update on public.moments
  for each row execute function public.moments_visibility();

create or replace function public.moments_visibility_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update moments set visibility = new.visibility
  where (replaces = new.id or id = new.replaces) and visibility is distinct from new.visibility;
  return null;
end $$;
create trigger moments_visibility_follow after update of visibility on public.moments
  for each row when (old.visibility is distinct from new.visibility)
  execute function public.moments_visibility_follow();

-- A visibility change sets is_private in a before trigger, which doesn't fire an "update of is_private"
-- trigger, so the counts trigger also watches visibility (otherwise as in 0021).
drop trigger moments_count on public.moments;
create trigger moments_count
  after insert or delete or update of status, is_private, visibility, jar_id, replaces, hidden_at on public.moments
  for each row execute function public.moments_count_sync();

-- ---------------------------------------------------------------- who sees a moment
create or replace function public.can_view_moment(viewer uuid, m public.moments) returns boolean
language sql stable security definer set search_path = public as $$
  select m.user_id = viewer
      or (m.status = 'live'
          and m.hidden_at is null
          and m.visibility <> 'only_me'
          and viewer is not null
          and not is_blocked_between(viewer, m.user_id)
          and exists (select 1 from profiles where id = m.user_id and status = 'active')
          and (m.visibility = 'everyone'
               or exists (select 1 from follows where reader_id = viewer and author_id = m.user_id)))
$$;

alter policy moments_others_select on public.moments using (public.can_view_moment(auth.uid(), moments.*));

-- ---------------------------------------------------------------- notifications (0019)
create or replace function public.notify(
  p_user uuid,
  p_type text,
  p_actor uuid default null,
  p_jar uuid default null,
  p_moment uuid default null,
  p_comment uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  m_owner uuid;
  m_only_me boolean;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null then
    if is_blocked_between(p_user, p_actor) then return; end if;
    if not exists (select 1 from profiles where id = p_actor and status = 'active') then return; end if;
  end if;
  if p_moment is not null then
    select user_id, visibility = 'only_me' into m_owner, m_only_me from moments where id = p_moment;
    if m_only_me and (p_user <> m_owner or p_type in ('like', 'comment', 'reply', 'friend_joined')) then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, actor_id, jar_id, moment_id, comment_id)
  values (p_user, p_type, p_actor, p_jar, p_moment, p_comment);
end $$;

-- ---------------------------------------------------------------- Jars feed (0014)
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
         v.preview_ids, v.preview_paths, v.last_caption,
         j.user_id <> uid and f.feed_at > coalesce(seen, '-infinity'::timestamptz)
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
           coalesce((array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.slot) filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths,
           (array_agg(m.caption order by m.added_at desc, m.slot desc) filter (where nullif(btrim(m.caption), '') is not null))[1] as last_caption
    from moments m
    -- can_view_moment for this jar: every other author here is one the caller reads and can_view_jar has
    -- checked blocks and status, so readers and everyone moments are both theirs to see. (Written out, not
    -- called: an invoker function can't pass a whole moments row, pending_* aren't granted, 0004.)
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or m.visibility <> 'only_me')
  ) v
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility in ('readers', 'everyone') and can_view_jar(uid, j)))
    and v.n > 0
    and (feed_page.cursor_at is null or (f.feed_at, j.id) < (feed_page.cursor_at, feed_page.cursor_id))
  order by f.feed_at desc, j.id desc
  limit 20;
end $$;

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
    and p.id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, p.id)
  order by has_new desc, l.latest_at desc nulls last, p.username;
end $$;

-- ---------------------------------------------------------------- shared web page (0025)
create or replace function public.public_profile(p_username text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
      'reader_count', p.reader_count, 'author_count', p.author_count,
      'created_at', p.created_at),
    'jars', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.id, 'local_date', j.local_date, 'published_at', j.published_at,
               'visible_count', j.n, 'moments', j.moments)
             order by j.local_date desc, j.id desc)
      from (
        select jar.id, jar.local_date, jar.published_at, e.n, e.moments
        from jars jar
        cross join lateral (
          select count(*)::int as n,
                 coalesce(jsonb_agg(jsonb_build_object(
                            'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                            'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                            'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                          order by m.slot), '[]'::jsonb) as moments
          from moments m
          where m.jar_id = jar.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
        ) e
        where jar.user_id = p.id and jar.published_at is not null and jar.visibility = 'everyone' and e.n > 0
        order by jar.local_date desc, jar.id desc
        limit 30
      ) j
    ), '[]'::jsonb))
  from profiles p
  where p.username = p_username::citext
    and p.status = 'active'
$$;
comment on function public.public_profile(text) is
  'Anon shared-link profile: public fields of an active profile and its 30 newest Everyone jars with live Everyone moments; null otherwise (0025, 0066).';

create or replace function public.public_jar(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
      'id', j.id, 'local_date', j.local_date, 'visibility', j.visibility,
      'readers_only', j.visibility = 'readers', 'published_at', j.published_at,
      'visible_count', case when j.visibility = 'everyone' then e.n else j.visible_count end,
      'author', jsonb_build_object(
        'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
        'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
        'reader_count', p.reader_count, 'author_count', p.author_count,
        'created_at', p.created_at))
    || case when j.visibility = 'everyone' then jsonb_build_object('moments', e.moments) else '{}'::jsonb end
  from jars j
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           coalesce(jsonb_agg(jsonb_build_object(
                      'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                      'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                      'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                    order by m.slot), '[]'::jsonb) as moments
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
  ) e
  where j.id = p_id
    and j.published_at is not null
    and j.visibility in ('everyone', 'readers')
    and p.status = 'active'
$$;
comment on function public.public_jar(uuid) is
  'Anon shared-link jar: a published Everyone jar with its live Everyone moments, or a Readers teaser without moments; null otherwise (0025, 0066).';

-- ---------------------------------------------------------------- Explore (0031)
create or replace function public.full_jars_today(max_count int default 12)
returns table (
  jar_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  local_date date,
  published_at timestamptz,
  cover_moment_id uuid,
  cover_slot slot
)
language sql stable set search_path = public as $$
  select j.id, p.id, p.username::text, p.display_name, p.avatar_path, j.local_date, j.published_at, c.id, c.slot
  from jars j
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           (array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1] as id,
           (array_agg(m.slot order by m.slot) filter (where m.thumb_path is not null))[1] as slot
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
      and m.replaces is null
  ) c
  where j.visibility = 'everyone'
    and j.published_at is not null
    and j.visible_count >= 8
    and c.n >= 8
    and j.ends_at > now()
    and j.user_id <> auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), j.user_id)
  order by j.published_at desc
  limit least(greatest(coalesce(full_jars_today.max_count, 12), 1), 50)
$$;
