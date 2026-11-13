-- 0069 — A jar's cover photo (QA round 1, piece 9; D-56, D-75; FR-SOC-03, FR-SOC-01, FR-SOC-10, FR-WEB-01,
-- FR-CAP-10). Additive: one column, one index, three functions and three triggers; four functions are
-- replaced, and feed_page is dropped and re-created with one more column (a function, not a schema drop;
-- its grants are restored). Nothing else is dropped or renamed.
--
-- Before: the cover was derived wherever it was shown: the newest caption, else the first moment in slot
-- order (the Jar page, jarPage.ts), and the feed card's mosaic was in slot order. Now the owner may pick it
-- (D-56) and every surface shows one resolved cover, first:
--   * jars.cover_moment_id: the owner's pick, or null for the derived rule. Every existing jar starts with
--     null, so nothing changes for it until its owner picks. It references moments on delete set null.
--   * Writing it (the owner's guarded update, as visibility and published_at, 0003): jars_update lets only
--     the jar's owner update the row, and jars_before_update now lets a client change cover_moment_id as
--     well as visibility and published_at. jars_cover_check allows only a moment of the same jar, and from a
--     client only a live one that isn't a pending replacement (clearing it is always allowed).
--   * A Replace (0013) keeps the cover: when the replaced moment is deleted (fn:moderate approving the new
--     photo, or the owner deleting the old one), moments_cover_follow moves the cover to the replacement.
--     Any other delete clears it (on delete set null) and the jar falls back to the derived rule.
--
-- The resolved cover, for a viewer: among the live moments they may see (can_view_moment, 0066), the
-- owner's pick if it is one of them, else the newest caption (added_at, then later slot), else the first in
-- slot order. So readers fall back when the pick is Only me, removed, hidden or deleted; the owner keeps
-- their pick while it is live, whatever its visibility (a removed moment is no longer shown to them either).
--   * resolved_cover_id(jars): the Jar page and the profile's Jars tab read it as a computed column of the
--     jar row, as the caller. Security definer, like moment_jar (0067): can_view_moment takes a whole moments
--     row and pending_* aren't granted (0004). It returns only the id of a moment the caller may see.
--   * feed_page (0014, 0066): one more column, cover_moment_id, resolved over the moments that viewer sees,
--     and preview_moment_ids / preview_thumb_paths start with the cover, then slot order.
--   * public_jar (0025, 0066): an Everyone jar carries cover_moment_id, resolved over its live Everyone
--     moments (an Only me or Readers pick falls back). A Readers teaser still has no moment ids.
--
-- The raw column is readable by whoever may open the jar (jars has a table grant; column grants on jars
-- would break every invoker function that passes a jars row). It is an id only: the photo, caption and
-- everything else of an Only me pick stay behind can_view_moment, and every surface reads the resolved
-- cover, never the raw pick (D-75).

-- ---------------------------------------------------------------- column
alter table public.jars add column cover_moment_id uuid references public.moments(id) on delete set null;
comment on column public.jars.cover_moment_id is
  'The owner''s chosen cover, a moment of this jar; null for the derived rule (newest caption, else first slot). Readers get it only through resolved_cover_id, feed_page and public_jar (0069, D-56).';
-- For on delete set null: deleting a moment looks up the jars that point at it.
create index jars_cover_moment_idx on public.jars (cover_moment_id) where cover_moment_id is not null;

-- ---------------------------------------------------------------- owners may change the cover (0003)
-- Replaces 0003's function: cover_moment_id joins visibility and published_at as what an owner may change.
create or replace function public.jars_before_update() returns trigger
language plpgsql as $$
begin
  if new.ends_at < old.ends_at then
    raise exception 'ends_at can only move later' using errcode = '22023';
  end if;
  if new.tz is distinct from old.tz and not public.is_valid_tz(new.tz) then
    raise exception 'tz must be an IANA time zone name, got %', new.tz using errcode = '22023';
  end if;
  if public.is_client_role() then
    -- Owners change only visibility, published_at and the cover (0069); every other column is
    -- server-owned, including any column added later. (is_full is generated, so NEW has no value for it yet.)
    if (to_jsonb(new) - array['visibility', 'published_at', 'cover_moment_id', 'updated_at', 'is_full'])
       is distinct from (to_jsonb(old) - array['visibility', 'published_at', 'cover_moment_id', 'updated_at', 'is_full']) then
      raise exception 'only visibility and published_at can be changed' using errcode = '42501';
    end if;
    if new.published_at is distinct from old.published_at then
      -- Unpublishing is done by switching to only_me; publishing uses the server clock.
      if new.published_at is null then
        raise exception 'a published jar cannot be unpublished; set visibility to only_me' using errcode = '42501';
      end if;
      new.published_at := case when old.published_at is null then now() else old.published_at end;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- only a moment of the same jar
-- Invoker, so is_client_role() sees the caller: the owner reads their own moments through moments_owner, and
-- another user can't update the jar at all (jars_update). Server code (fn:*, the triggers below) isn't a client.
create or replace function public.jars_cover_check() returns trigger
language plpgsql as $$
begin
  if new.cover_moment_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.cover_moment_id is not distinct from old.cover_moment_id then
    return new;
  end if;
  if not exists (select 1 from public.moments m where m.id = new.cover_moment_id and m.jar_id = new.id) then
    raise exception 'the cover must be a moment of this jar' using errcode = '23514';
  end if;
  if public.is_client_role()
     and not exists (select 1 from public.moments m
                     where m.id = new.cover_moment_id and m.status = 'live' and m.replaces is null) then
    raise exception 'only a live moment can be the cover' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger jars_cover_check before insert or update of cover_moment_id on public.jars
  for each row execute function public.jars_cover_check();

-- ---------------------------------------------------------------- a Replace keeps the cover (0013)
-- Before the delete, while the replacement still points at the replaced moment (replaces is cleared by its
-- on delete set null). A jar being deleted has already gone when its moments are, so nothing is updated then.
create or replace function public.moments_cover_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update jars j
  set cover_moment_id = r.id
  from moments r
  where j.cover_moment_id = old.id
    and r.replaces = old.id
    and r.status <> 'removed';
  return old;
end $$;
create trigger moments_cover_follow before delete on public.moments
  for each row execute function public.moments_cover_follow();

-- ---------------------------------------------------------------- the resolved cover
create or replace function public.resolved_cover_id(j public.jars) returns uuid
language sql stable security definer set search_path = public as $$
  with shown as (
    select m.id, m.slot, m.caption, m.added_at
    from moments m
    where m.jar_id = j.id
      and m.status = 'live'
      and can_view_moment(auth.uid(), m)
  )
  select coalesce(
    (select s.id from shown s where s.id = j.cover_moment_id),
    (select s.id from shown s where nullif(btrim(s.caption), '') is not null
     order by s.added_at desc, s.slot desc limit 1),
    (select s.id from shown s order by s.slot limit 1)
  )
$$;
revoke execute on function public.resolved_cover_id(public.jars) from public, anon;
grant execute on function public.resolved_cover_id(public.jars) to authenticated, service_role;
comment on function public.resolved_cover_id(public.jars) is
  'The jar''s cover for the caller, among the live moments they may see (can_view_moment): the owner''s pick, else the newest caption, else the first slot; null when they see none (0069, D-56). A computed column of jars.';

-- ---------------------------------------------------------------- Jars feed (0014, 0066)
-- The return type gains cover_moment_id, so the function is dropped and re-created; its grants follow.
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
  if (feed_page.cursor_at is null) <> (feed_page.cursor_id is null) then
    raise exception 'cursor_at and cursor_id go together' using errcode = '22023';
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
           -- The resolved cover (0069): the owner's pick if this viewer sees it, else the newest caption,
           -- else the first slot, among the moments with a thumbnail the card can show.
           coalesce(
             (array_agg(m.id) filter (where m.id = j.cover_moment_id and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.added_at desc, m.slot desc)
                filter (where nullif(btrim(m.caption), '') is not null and m.thumb_path is not null))[1],
             (array_agg(m.id order by m.slot) filter (where m.thumb_path is not null))[1]
           ) as cover_id
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

-- ---------------------------------------------------------------- shared web page (0025, 0066)
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
    || case when j.visibility = 'everyone'
            then jsonb_build_object('moments', e.moments, 'cover_moment_id', e.cover_id)
            else '{}'::jsonb end
  from jars j
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           coalesce(jsonb_agg(jsonb_build_object(
                      'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                      'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                      'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                    order by m.slot), '[]'::jsonb) as moments,
           -- The resolved cover among these Everyone moments (0069).
           coalesce(
             (array_agg(m.id) filter (where m.id = j.cover_moment_id))[1],
             (array_agg(m.id order by m.added_at desc, m.slot desc) filter (where nullif(btrim(m.caption), '') is not null))[1],
             (array_agg(m.id order by m.slot))[1]
           ) as cover_id
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
  ) e
  where j.id = p_id
    and j.published_at is not null
    and j.visibility in ('everyone', 'readers')
    and p.status = 'active'
$$;
comment on function public.public_jar(uuid) is
  'Anon shared-link jar: a published Everyone jar with its live Everyone moments and their resolved cover, or a Readers teaser without moments; null otherwise (0025, 0066, 0069).';
