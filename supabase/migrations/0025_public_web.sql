-- 0025 — Public web RPCs for the shared-link site (M4-12; FR-WEB-01, FR-PUB-03, FR-PUB-05; C-2, C-6,
-- D-9, D-11). Additive: two functions, nothing dropped, renamed or changed.
--
-- pickld.me/<username> and pickld.me/j/<id> (C-2) render for signed-out visitors. Anon has no table
-- privileges (0006) and no service key goes into a web page (rule 2), so these narrow security definer
-- functions are the only anon window on content (C-6). Call them with the anon key:
--   supabase.rpc('public_profile', { p_username }) / supabase.rpc('public_jar', { p_id })
-- Both return jsonb, or null when there is nothing public to show. Null covers a missing row, an author
-- who is not active (suspended by moderation, D-11, or deleted), an unpublished jar and an Only me jar:
-- the four look the same.
--
-- What is public, all decided here:
--   * Author: active profiles only, and only the public_profiles columns (0001): no birthday, email,
--     home_tz, default_visibility or feed_seen_at.
--   * Moments: only in a published Everyone jar, and only status live, not private and not hidden by
--     reports (0021), which is exactly what jars.visible_count counts (D-9), so the count never reveals
--     private, unchecked, removed or hidden moments. pending_* edits and replacements awaiting
--     moderation are never returned (a live moment has replaces null).
--   * Readers jars (published): a teaser only, with author, date, visible_count and readers_only = true,
--     and no moments key at all (no ids, captions, edits or photo paths).
--   * No blocks apply: a visitor has no account to block or be blocked by.
--
-- Shapes (jsonb; timestamps are ISO strings, dates YYYY-MM-DD):
--   author  = { id, username, display_name, bio, avatar_path, cover_path, lid_color,
--               reader_count, author_count, created_at }
--   (no jar_count: it counts the owner's Only me jars too, which anon must not learn)
--   moment  = { id, slot, caption, captured_at, added_at, is_backfilled, edits, photo_path, thumb_path }
--             (in slot order: whereami … evening)
--
--   public_profile(p_username) → null | {
--     profile: author,
--     jars: [ { id, local_date, published_at, visible_count, moments: [moment] } ]
--   }   The 30 newest (local_date desc) published Everyone jars with at least one visible moment.
--
--   public_jar(p_id) → null | {
--     id, local_date, visibility ('everyone' | 'readers'), readers_only, published_at, visible_count,
--     author,
--     moments: [moment]      -- Everyone jars only; absent when readers_only
--   }
--
-- Photos: photo_path / thumb_path are the bucket keys fn:photo-urls signs (0007). fn:photo-urls needs a
-- signed-in caller, so the web site needs its own anon-safe signing path (M4-13) that signs only keys
-- these functions return.

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
               'visible_count', j.visible_count,
               'moments', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                          'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                          'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                        order by m.slot)
                 from moments m
                 where m.jar_id = j.id and m.status = 'live' and not m.is_private and m.hidden_at is null
               ), '[]'::jsonb))
             order by j.local_date desc, j.id desc)
      from (
        select * from jars
        where user_id = p.id and published_at is not null and visibility = 'everyone' and visible_count > 0
        order by local_date desc, id desc
        limit 30
      ) j
    ), '[]'::jsonb))
  from profiles p
  where p.username = p_username::citext
    and p.status = 'active'
$$;
comment on function public.public_profile(text) is
  'Anon shared-link profile: public fields of an active profile and its 30 newest Everyone jars with live, non-private moments; null otherwise (0025).';

create or replace function public.public_jar(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
      'id', j.id, 'local_date', j.local_date, 'visibility', j.visibility,
      'readers_only', j.visibility = 'readers', 'published_at', j.published_at,
      'visible_count', j.visible_count,
      'author', jsonb_build_object(
        'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
        'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
        'reader_count', p.reader_count, 'author_count', p.author_count,
        'created_at', p.created_at))
    || case when j.visibility = 'everyone' then jsonb_build_object('moments', coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                  'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                  'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                order by m.slot)
         from moments m
         where m.jar_id = j.id and m.status = 'live' and not m.is_private and m.hidden_at is null
       ), '[]'::jsonb))
       else '{}'::jsonb end
  from jars j
  join profiles p on p.id = j.user_id
  where j.id = p_id
    and j.published_at is not null
    and j.visibility in ('everyone', 'readers')
    and p.status = 'active'
$$;
comment on function public.public_jar(uuid) is
  'Anon shared-link jar: an Everyone jar with its live, non-private moments, or a teaser (no moments) for a Readers jar; null otherwise (0025).';

revoke all on function public.public_profile(text) from public;
revoke all on function public.public_jar(uuid) from public;
grant execute on function public.public_profile(text) to anon, authenticated, service_role;
grant execute on function public.public_jar(uuid) to anon, authenticated, service_role;
