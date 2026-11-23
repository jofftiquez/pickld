-- 0179 — Close friends audience, part 2 of 2: the list and who sees what. Additive: one table, functions and
-- triggers; can_view_moment, can_view_jar, notify, moments_count_sync, can_see_tag, moments_tags_sanitize,
-- moments_tags_sync and the four Jars feed functions are replaced with the close-friends case. Nothing is
-- dropped or rewritten; no existing row has the new value.
--
-- The rules (decided by Joff):
--   * close_friends is a fourth audience for a moment, a jar and the profile default, between Readers and
--     Only me. The owner picks the list (close_friends rows, written and read only by the owner).
--   * Only someone who reads you now can be on your list. Stopping reading, being removed as a reader, or a
--     block either way (blocks drop follows, 0001) takes them off the list; is_close_friend also checks the
--     follow, so a list row never outlives the follow.
--   * They aren't told when added. They see a small "Close friends" badge on those moments (app).
--   * Readers who aren't close friends never learn a close-friends moment exists: to them it is exactly an
--     Only me moment. So visible_count (what every reader sees, D-9) leaves it out like Only me, the Jars feed
--     doesn't count it, cover it or move a jar up for it, notifications about it reach only people who can
--     see it, and a tag on it is shown (and told) only to the tagged person if they can see it. What already
--     counts Only me moments (moment_count, is_full, jar_count) counts it too, so it tells nothing new.
--   * Taking someone off the list takes away their view of past close-friends moments and jars at once, and
--     their notifications about them go.
--   * Only people on the list can be newly tagged on a close-friends moment; a tag already there stays (as
--     0172) but its person sees and is told about it only while they can see the moment.
--   * Never on pickld.me, Discover or Explore: those show Everyone only (0066, 0150), and public_jar finds
--     only readers and everyone jars, whose readers teaser count is visible_count.
--   * Nobody can learn who is on someone's list: is_close_friend answers only about the caller (or for
--     server code), so can_view_moment and can_view_jar, which take any viewer, can't be used to probe it.

-- ---------------------------------------------------------------- the list
create table public.close_friends (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);
comment on table public.close_friends is
  'Each owner''s close friends list (0179): people who read the owner and may see close_friends moments and jars.';
create index close_friends_friend_idx on public.close_friends (friend_id, owner_id);

alter table public.close_friends enable row level security;
revoke all on public.close_friends from anon, authenticated;
grant select (owner_id, friend_id, created_at) on public.close_friends to authenticated;
grant insert (owner_id, friend_id) on public.close_friends to authenticated;
grant delete on public.close_friends to authenticated;
create policy close_friends_owner_select on public.close_friends for select to authenticated
  using (owner_id = auth.uid());
create policy close_friends_owner_insert on public.close_friends for insert to authenticated
  with check (owner_id = auth.uid());
create policy close_friends_owner_delete on public.close_friends for delete to authenticated
  using (owner_id = auth.uid());

-- Only a current reader, not blocked either way, with an active account.
create or replace function public.close_friends_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from follows where reader_id = new.friend_id and author_id = new.owner_id)
     or is_blocked_between(new.owner_id, new.friend_id)
     or not exists (select 1 from profiles where id = new.friend_id and status = 'active') then
    raise exception 'only people who read you can be close friends' using errcode = '42501';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger close_friends_before_insert before insert on public.close_friends
  for each row execute function public.close_friends_before_insert();

-- Stopping reading (an unfollow, a removed reader, a block) takes them off the list.
create or replace function public.follows_clear_close_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from close_friends where owner_id = old.author_id and friend_id = old.reader_id;
  return null;
end $$;
create trigger follows_clear_close_friend after delete on public.follows
  for each row execute function public.follows_clear_close_friend();

-- ---------------------------------------------------------------- membership
-- Unchecked: for security definer code only (not granted to clients).
create or replace function public.close_friend_of(p_owner uuid, p_friend uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from close_friends cf
                 join follows f on f.reader_id = cf.friend_id and f.author_id = cf.owner_id
                 where cf.owner_id = p_owner and cf.friend_id = p_friend)
$$;
revoke execute on function public.close_friend_of(uuid, uuid) from public, anon, authenticated;

-- For clients and the functions they call: answers only about the caller, as owner or friend, and false for
-- anyone else (server code without a signed-in user may ask about anyone).
create or replace function public.is_close_friend(p_owner uuid, p_friend uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner is not null and p_friend is not null
     and (p_friend = auth.uid() or p_owner = auth.uid()
          or coalesce(auth.role(), '') not in ('anon', 'authenticated'))
     and close_friend_of(p_owner, p_friend)
$$;
revoke execute on function public.is_close_friend(uuid, uuid) from public, anon;
grant execute on function public.is_close_friend(uuid, uuid) to authenticated, service_role;

-- Taking someone off the list: their notifications about the owner's close-friends moments and jars go.
create or replace function public.close_friends_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from notifications n
  where n.user_id = old.friend_id
    and ((n.moment_id is not null and exists (select 1 from moments m where m.id = n.moment_id
                                              and m.user_id = old.owner_id and m.visibility = 'close_friends'))
         or (n.moment_id is null and n.jar_id is not null
             and exists (select 1 from jars j where j.id = n.jar_id
                         and j.user_id = old.owner_id and j.visibility = 'close_friends')));
  return null;
end $$;
create trigger close_friends_after_delete after delete on public.close_friends
  for each row execute function public.close_friends_after_delete();

-- ---------------------------------------------------------------- who sees a moment or jar
-- As 0176 (a Private account's Everyone posts reach its readers only), with close_friends; each audience is
-- named, so a value nobody handles is seen by nobody.
create or replace function public.can_view_moment(viewer uuid, m public.moments) returns boolean
language sql stable security definer set search_path = public as $$
  select m.user_id = viewer
      or (m.status = 'live'
          and m.hidden_at is null
          and viewer is not null
          and not is_blocked_between(viewer, m.user_id)
          and exists (
            select 1 from profiles p
            where p.id = m.user_id and p.status = 'active'
              and ((m.visibility = 'everyone' and not p.is_private)
                   or (m.visibility in ('readers', 'everyone')
                       and exists (select 1 from follows where reader_id = viewer and author_id = m.user_id))
                   or (m.visibility = 'close_friends' and is_close_friend(m.user_id, viewer)))))
$$;

create or replace function public.can_view_jar(viewer uuid, j public.jars) returns boolean
language sql stable security definer set search_path = public as $$
  select
    j.user_id = viewer
    or (
      j.published_at is not null
      and viewer is not null
      and not is_blocked_between(viewer, j.user_id)
      and exists (
        select 1 from profiles p
        where p.id = j.user_id and p.status = 'active'
          and ((j.visibility = 'everyone' and not p.is_private)
               or (j.visibility in ('readers', 'everyone')
                   and exists (select 1 from follows where reader_id = viewer and author_id = j.user_id))
               or (j.visibility = 'close_friends' and is_close_friend(j.user_id, viewer))))
    )
$$;

-- ---------------------------------------------------------------- visible_count (D-9)
-- As 0021: visible_count is what every reader of the jar sees, so close-friends moments are left out like
-- Only me. Feeds that show a close friend more count for them (feed_page).
create or replace function public.moments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set
      moment_count  = (select count(*) from moments where jar_id = jid and status <> 'removed' and replaces is null),
      visible_count = (select count(*) from moments
                       where jar_id = jid and status = 'live' and visibility in ('readers', 'everyone')
                         and hidden_at is null),
      updated_at = now()
    where id = jid;
    update profiles p set jar_count = (select count(*) from jars where user_id = p.id and moment_count > 0)
    where p.id = (select user_id from jars where id = jid);
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------- notifications (0177)
-- As 0177 (together types), plus: about a close-friends moment or jar, only its owner and their close friends are told.
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
  m_visibility jar_visibility;
  j_owner uuid;
  j_visibility jar_visibility;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null then
    if is_blocked_between(p_user, p_actor) then return; end if;
    if not exists (select 1 from profiles where id = p_actor and status = 'active') then return; end if;
  end if;
  if p_moment is not null then
    select user_id, visibility into m_owner, m_visibility from moments where id = p_moment;
    if m_visibility = 'only_me' and (p_user <> m_owner
                                     or p_type in ('like', 'comment', 'reply', 'friend_joined', 'tag',
                                                   'together_request', 'together_added')) then
      return;
    end if;
    if m_visibility = 'close_friends' and p_user <> m_owner and not close_friend_of(m_owner, p_user) then
      return;
    end if;
  elsif p_jar is not null then
    select user_id, visibility into j_owner, j_visibility from jars where id = p_jar;
    if j_visibility = 'close_friends' and p_user <> j_owner and not close_friend_of(j_owner, p_user) then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, actor_id, jar_id, moment_id, comment_id)
  values (p_user, p_type, p_actor, p_jar, p_moment, p_comment);
end $$;

-- ---------------------------------------------------------------- tags (0172, 0173)
-- As can_tag, plus: on a close-friends moment, only someone on the author's list can be newly tagged.
create or replace function public.can_tag_on(p_author uuid, p_tagged uuid, p_moment uuid, p_visibility jar_visibility)
returns boolean
language sql stable security definer set search_path = public as $$
  select can_tag(p_author, p_tagged, p_moment)
     and (p_visibility is distinct from 'close_friends'
          or close_friend_of(p_author, p_tagged)
          or exists (select 1 from moment_tags t
                     where t.moment_id = p_moment and t.tagged_id = p_tagged and t.removed_at is null))
$$;
revoke execute on function public.can_tag_on(uuid, uuid, uuid, jar_visibility) from public, anon, authenticated;

-- `edits` without the mention overlays of people can_tag_on refuses on a close-friends moment.
create or replace function public.edits_close_friend_mentions(p_edits jsonb, p_author uuid, p_moment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  kept jsonb := '[]'::jsonb;
  o jsonb;
begin
  if p_edits is null or jsonb_typeof(p_edits -> 'overlays') is distinct from 'array'
     or not jsonb_path_exists(p_edits, '$.overlays[*] ? (@.type == "mention")') then
    return p_edits;
  end if;
  for o in select value from jsonb_array_elements(p_edits -> 'overlays') loop
    -- edits_allowed_mentions has already dropped mentions without a valid userId.
    if o ->> 'type' = 'mention'
       and not can_tag_on(p_author, (o ->> 'userId')::uuid, p_moment, 'close_friends') then
      continue;
    end if;
    kept := kept || jsonb_build_array(o);
  end loop;
  return jsonb_set(p_edits, '{overlays}', kept);
end $$;
revoke execute on function public.edits_close_friend_mentions(jsonb, uuid, uuid) from public, anon, authenticated;

-- As 0172, plus the close-friends filter.
create or replace function public.moments_tags_sanitize() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.edits := edits_allowed_mentions(new.edits, new.user_id, new.id);
  new.pending_edits := edits_allowed_mentions(new.pending_edits, new.user_id, new.id);
  if new.visibility = 'close_friends' then
    new.edits := edits_close_friend_mentions(new.edits, new.user_id, new.id);
    new.pending_edits := edits_close_friend_mentions(new.pending_edits, new.user_id, new.id);
  end if;
  return new;
end $$;

-- A tagged person sees their tag on a close-friends moment only while they can see the moment (otherwise as
-- 0172: the author and the tagged person always see it, readers when they can see the moment).
create or replace function public.can_see_tag(viewer uuid, t public.moment_tags) returns boolean
language sql stable security definer set search_path = public as $$
  select t.removed_at is null and viewer is not null and (
    viewer = t.author_id
    or (viewer = t.tagged_id
        and exists (select 1 from moments m where m.id = t.moment_id
                    and (m.visibility is distinct from 'close_friends' or can_view_moment(viewer, m))))
    or (not is_blocked_between(viewer, t.tagged_id)
        and exists (select 1 from profiles p where p.id = t.tagged_id and p.status = 'active')
        and exists (select 1 from moments m where m.id = t.moment_id and can_view_moment(viewer, m))))
$$;

-- As 0173, plus: caption tags follow can_tag_on; on a close-friends moment only tagged people on the list
-- are told, and a moment that turns close friends takes back the tag and Together (0177) notifications of
-- everyone else.
create or replace function public.moments_tags_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted uuid[];
  r record;
begin
  if tg_op = 'UPDATE'
     and new.edits is not distinct from old.edits and new.caption is not distinct from old.caption
     and new.status is not distinct from old.status and new.visibility is not distinct from old.visibility
     and new.hidden_at is not distinct from old.hidden_at then
    return null;
  end if;

  select coalesce(array_agg(distinct u), '{}') into wanted from (
    select (o ->> 'userId')::uuid as u
    from jsonb_array_elements(case when jsonb_typeof(new.edits -> 'overlays') = 'array'
                                   then new.edits -> 'overlays' else '[]'::jsonb end) o
    where o ->> 'type' = 'mention' -- already checked by moments_tags_sanitize
    union
    select c from caption_mentioned(new.caption) c where can_tag_on(new.user_id, c, new.id, new.visibility)
  ) s;

  delete from moment_tags where moment_id = new.id and removed_at is null and not (tagged_id = any (wanted));
  insert into moment_tags (moment_id, tagged_id, author_id)
  select new.id, u, new.user_id from unnest(wanted) u
  on conflict (moment_id, tagged_id) do nothing;

  if new.status = 'live' and new.visibility <> 'only_me' and new.hidden_at is null then
    if new.visibility = 'close_friends' then
      delete from notifications
      where type in ('tag', 'together_added') and moment_id = new.id and not close_friend_of(new.user_id, user_id);
    end if;
    for r in
      update moment_tags set notified_at = now()
      where moment_id = new.id and removed_at is null and notified_at is null
        and (new.visibility <> 'close_friends' or close_friend_of(new.user_id, tagged_id))
      returning tagged_id
    loop
      if not exists (select 1 from mutes where muter_id = r.tagged_id and muted_id = new.user_id)
         and not exists (select 1 from notifications
                         where user_id = r.tagged_id and type = 'tag' and moment_id = new.id) then
        perform notify(r.tagged_id, 'tag', new.user_id, new.jar_id, new.id);
      end if;
    end loop;
  elsif new.status = 'removed' or new.visibility = 'only_me' or new.hidden_at is not null then
    delete from notifications where type = 'tag' and moment_id = new.id;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------- Jars feed (0151)
-- As 0151, with close friends: a close-friends moment counts, covers and moves its jar up only for the owner
-- and their close friends (the moments RLS already hides it from everyone else; written out here as the
-- Only me rule is), and a close-friends jar is in the feed of the owner's close friends (can_view_jar).

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
      and (j.user_id = uid or (m.visibility <> 'only_me'
                               and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))))
  ) v
  cross join lateral (
    -- The mosaic: the cover first, then slot order.
    select coalesce((array_agg(m.id order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or (m.visibility <> 'only_me'
                               and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))))
  ) pv
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility <> 'only_me' and can_view_jar(uid, j)))
    and v.n > 0
    and (feed_page.cursor_at is null or (f.feed_at, j.id) < (feed_page.cursor_at, feed_page.cursor_id))
  order by f.feed_at desc, j.id desc
  limit 20;
end $$;

-- ---------------------------------------------------------------- feed_page_newer
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
      and (j.user_id = uid or (m.visibility <> 'only_me'
                               and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))))
  ) v
  cross join lateral (
    select coalesce((array_agg(m.id order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_ids,
           coalesce((array_agg(m.thumb_path order by m.id = v.cover_id desc, m.slot)
                       filter (where m.thumb_path is not null))[1:4], '{}') as preview_paths
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.hidden_at is null
      and (j.user_id = uid or (m.visibility <> 'only_me'
                               and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))))
  ) pv
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility <> 'only_me' and can_view_jar(uid, j)))
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
      and (j.user_id = uid or (m.visibility <> 'only_me'
                               and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))))
  ) v
  cross join lateral (select greatest(j.published_at, v.last_added) as feed_at) f
  where j.published_at is not null
    and (j.user_id = uid or (j.visibility <> 'only_me' and can_view_jar(uid, j)))
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
      and (m.visibility <> 'close_friends' or is_close_friend(j.user_id, uid))
    where j.user_id = p.id
      and j.published_at is not null
      and j.visibility <> 'only_me'
      and can_view_jar(uid, j)
  ) l
  where fo.reader_id = uid
    and not exists (select 1 from mutes mu where mu.muter_id = uid and mu.muted_id = fo.author_id)
    and p.id <> uid
    and p.status = 'active'
    and not is_blocked_between(uid, p.id)
  order by has_new desc, l.latest_at desc nulls last, p.username;
end $$;

