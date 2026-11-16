-- 0150 — People-first Discover (AGENTS.md "Product principles", rule 15). Additive: one profiles column, two
-- helper functions; discover_moments_page and discover_jars_page are dropped and re-created with a third cursor
-- argument and two more columns (a function, not a schema drop; grants and comments are restored);
-- search_people and suggested_authors are re-created with the same signatures. No table data changes.
--
-- * Discover goes through your network first. Both lists now show, newest first, the posts of people your
--   authors read ("Read by @name", via_username) before everyone else's ("Beyond your network"). Rows carry
--   in_network and via_username; the order is (in_network desc, time desc, id desc) and the cursor is the last
--   row's (time, id, in_network). An older app that sends no cursor_network pages by (time, id) alone, as before.
-- * No popularity in ranking: search_people and suggested_authors no longer break ties by reader_count. Search
--   is exact username, then username prefix, then similarity, then username; suggestions are most mutual
--   authors first, then username.
-- * Who appears: in_discover(person) is true for an active profile that has Show me in Discover on
--   (profiles.discoverable, default true) and is 18 or older. Only those people's posts are listed in
--   Discover and only they are suggested. Under-18 accounts stay out whatever the switch says; they still
--   start on Readers (profiles.default_visibility default, 0001). Search still finds anyone active by name:
--   looking someone up is a deliberate act, not a recommendation.
-- * "Read by @name" names one of the caller's own authors (active, no block with the caller or the poster)
--   who reads the poster: the first by username, so the label is stable. Who reads whom is already public on
--   profiles (readers lists, 0017), so the label discloses nothing new.

-- ---------------------------------------------------------------- profiles.discoverable
alter table public.profiles add column if not exists discoverable boolean not null default true;
comment on column public.profiles.discoverable is
  'Show me in Discover and suggestions (0150). Owner-editable; read by the owner through my_profile(). '
  'Under 18 stays out of Discover regardless (in_discover).';

-- ---------------------------------------------------------------- in_discover
create or replace function public.in_discover(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_id
      and p.status = 'active'
      and p.discoverable
      and p.birthday <= (current_date - interval '18 years')
  )
$$;
revoke execute on function public.in_discover(uuid) from public, anon;
grant execute on function public.in_discover(uuid) to authenticated;
comment on function public.in_discover(uuid) is
  'Whether a person may appear in Discover and suggestions: active, Show me in Discover on, 18 or older (0150).';

-- ---------------------------------------------------------------- discover_via
-- One of viewer's authors who reads p_author, first by username; null when p_author is outside viewer's
-- network. Internal: only the definer Discover functions call it.
create or replace function public.discover_via(viewer uuid, p_author uuid) returns text
language sql stable security definer set search_path = public as $$
  select vp.username::text
  from follows mine
  join follows theirs on theirs.reader_id = mine.author_id and theirs.author_id = p_author
  join profiles vp on vp.id = mine.author_id
  where mine.reader_id = viewer
    and vp.status = 'active'
    and not is_blocked_between(viewer, mine.author_id)
    and not is_blocked_between(mine.author_id, p_author)
  order by vp.username
  limit 1
$$;
revoke execute on function public.discover_via(uuid, uuid) from public, anon, authenticated;
comment on function public.discover_via(uuid, uuid) is
  'Discover''s "Read by @name": one of viewer''s authors who reads p_author, first by username, else null (0150).';

-- ---------------------------------------------------------------- discover_moments_page
drop function public.discover_moments_page(timestamptz, uuid);
create function public.discover_moments_page(cursor_at timestamptz default null, cursor_id uuid default null,
                                             cursor_network boolean default null)
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
  jar_visible boolean,
  in_network boolean,
  via_username text
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
         j.tz, j.local_date, jv.ok, v.via is not null, v.via
  from moments m
  join profiles p on p.id = m.user_id
  join jars j on j.id = m.jar_id
  cross join lateral (select can_view_jar(uid, j) as ok) jv
  cross join lateral (select discover_via(uid, m.user_id) as via) v
  where m.status = 'live'
    and m.visibility = 'everyone'
    and m.hidden_at is null
    and m.user_id <> uid
    and in_discover(m.user_id)
    and not is_blocked_between(uid, m.user_id)
    and not exists (select 1 from follows fo where fo.reader_id = uid and fo.author_id = m.user_id)
    and (discover_moments_page.cursor_at is null
         or (discover_moments_page.cursor_network is null and (m.added_at, m.id) < (discover_moments_page.cursor_at, discover_moments_page.cursor_id))
         or (v.via is not null, m.added_at, m.id) < (discover_moments_page.cursor_network, discover_moments_page.cursor_at, discover_moments_page.cursor_id))
    and can_view_moment(uid, m)
  order by v.via is not null desc, m.added_at desc, m.id desc
  limit 20;
end $$;
revoke execute on function public.discover_moments_page(timestamptz, uuid, boolean) from public, anon;
grant execute on function public.discover_moments_page(timestamptz, uuid, boolean) to authenticated;
comment on function public.discover_moments_page(timestamptz, uuid, boolean) is
  'Discover moments: live, not hidden Everyone moments of people in Discover (in_discover) the caller doesn''t read, with no block either way; people the caller''s authors read first (in_network, via_username), then everyone else, each newest added_at first; 20 per page, cursor (added_at, moment_id, in_network); moments_feed_page''s columns plus in_network and via_username (0070, D-102; network first, 0150).';

-- ---------------------------------------------------------------- discover_jars_page
drop function public.discover_jars_page(timestamptz, uuid);
create function public.discover_jars_page(cursor_at timestamptz default null, cursor_id uuid default null,
                                          cursor_network boolean default null)
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
  added_later boolean,
  in_network boolean,
  via_username text
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
         pv.preview_ids, pv.preview_paths, v.last_caption, false, v.cover_id, v.added_later,
         nw.via is not null, nw.via
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
  cross join lateral (select discover_via(uid, j.user_id) as via) nw
  where j.published_at is not null
    and j.visibility = 'everyone'
    and j.user_id <> uid
    and in_discover(j.user_id)
    and not is_blocked_between(uid, j.user_id)
    and not exists (select 1 from follows fo where fo.reader_id = uid and fo.author_id = j.user_id)
    and v.n > 0
    and (discover_jars_page.cursor_at is null
         or (discover_jars_page.cursor_network is null and (j.published_at, j.id) < (discover_jars_page.cursor_at, discover_jars_page.cursor_id))
         or (nw.via is not null, j.published_at, j.id) < (discover_jars_page.cursor_network, discover_jars_page.cursor_at, discover_jars_page.cursor_id))
    and can_view_jar(uid, j)
  order by nw.via is not null desc, j.published_at desc, j.id desc
  limit 20;
end $$;
revoke execute on function public.discover_jars_page(timestamptz, uuid, boolean) from public, anon;
grant execute on function public.discover_jars_page(timestamptz, uuid, boolean) to authenticated;
comment on function public.discover_jars_page(timestamptz, uuid, boolean) is
  'Discover jars: published Everyone jars with at least one live, not hidden Everyone moment, of people in Discover (in_discover) the caller doesn''t read, with no block either way; count, caption, previews and cover from those Everyone moments only; people the caller''s authors read first (in_network, via_username), then everyone else, each newest published_at first; 20 per page, cursor (feed_at = published_at, jar_id, in_network); feed_page''s columns plus in_network and via_username (0070, D-102; added_later, 0144; network first, 0150).';

-- ---------------------------------------------------------------- search_people
-- As 0031, without the reader_count tie-break: exact username, then prefix, then similarity, then username.
create or replace function public.search_people(query text, max_count int default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  lid_color text,
  reader_count int,
  is_reading boolean
)
language plpgsql stable set search_path = public, extensions as $$
declare q text := lower(btrim(regexp_replace(coalesce(search_people.query, ''), '^\s*@', '')));
begin
  if char_length(q) < 2 then
    return;
  end if;
  return query
  select p.id, p.username::text, p.display_name, p.avatar_path, p.lid_color, p.reader_count,
         exists (select 1 from follows f where f.reader_id = auth.uid() and f.author_id = p.id)
  from profiles p
  where p.id <> auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
    and (lower(p.username::text || ' ' || p.display_name) like '%' || q || '%'
         or lower(p.username::text || ' ' || p.display_name) % q)
  order by lower(p.username::text) = q desc,
           lower(p.username::text) like q || '%' desc,
           similarity(lower(p.username::text || ' ' || p.display_name), q) desc,
           p.username
  limit least(greatest(coalesce(search_people.max_count, 20), 1), 50);
end $$;

-- ---------------------------------------------------------------- suggested_authors
-- As 0031: friends of friends, most mutual first, now only people in Discover (in_discover) and with ties by
-- username instead of reader_count.
create or replace function public.suggested_authors(max_count int default 10)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  lid_color text,
  reader_count int,
  mutual_count int
)
language sql stable set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, p.lid_color, p.reader_count, count(*)::int
  from follows mine
  join follows theirs on theirs.reader_id = mine.author_id
  join profiles p on p.id = theirs.author_id
  where mine.reader_id = auth.uid()
    and p.id <> auth.uid()
    and in_discover(p.id)
    and not is_blocked_between(auth.uid(), p.id)
    and not is_blocked_between(auth.uid(), mine.author_id)
    and not exists (select 1 from follows f where f.reader_id = auth.uid() and f.author_id = p.id)
  group by p.id
  order by count(*) desc, p.username
  limit least(greatest(coalesce(suggested_authors.max_count, 10), 1), 50)
$$;
