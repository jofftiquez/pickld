-- 0068 — Moment comments (QA round 1, piece 6; D-51; FR-SOC-04, FR-SOC-06). Additive: two columns, one
-- index, one function and two triggers; functions, two policies and two triggers are replaced. Nothing is
-- dropped or renamed.
--
-- Before: every comment belonged to its jar's one thread. Now each moment has its own thread too (D-51):
--   * comments.moment_id: null for the jar thread, else the moment whose thread it is in. jar_id stays
--     filled with that moment's jar, so cascades, moderation (fn:moderate works by comment id,
--     moderation_apply_comment, 0016), the moderation queue and reports keep working unchanged. The
--     comments_check_moment trigger refuses a moment from another jar; a reply stays in its parent's
--     thread (comments_check_parent). Deleting a moment deletes its thread, as it deletes its likes
--     (a Replace, 0013, is a new moment and starts with no likes and no comments).
--   * moments.comment_count: the moment thread's checked, not deleted comments. jars.comment_count now
--     counts only the jar thread (moment_id is null). comments_count_sync keeps both. A client can't write
--     moments.comment_count (moments_comment_count_guard), as jars' counters (0003).
--   * Who reads and writes a thread: can_view_comment_thread(viewer, jar, moment) is can_view_moment for a
--     moment thread and can_view_jar for the jar thread. comments_select, comments_insert and the report
--     check (reports_before_insert_validate, 0021) use it. A moment thread follows the moment's own
--     visibility (D-48), so readers of a moment in a jar that isn't published can comment on it; the jar
--     thread still waits for Publish jar.
--   * comments_notify: a comment or reply in a moment thread carries moment_id, so notify() keeps Only me
--     moments to their owner (0066) and the push says "commented on your moment" (fn:send-push).
--   * delete_comment (0005) is unchanged: the comment's author or the jar owner, who is the moment owner.
--
--   * moments_feed_page (0067) now carries each moment's own comment_count instead of its jar's: a card on
--     the Moments tab opens that moment's thread, which follows can_view_moment like the row itself.
--
-- Existing data: no comment has a moment, so every existing comment stays in its jar thread, every
-- moment's count starts at 0 (the column default), and jars' counts don't change (recounted anyway).

-- ---------------------------------------------------------------- columns
alter table public.comments add column moment_id uuid references public.moments(id) on delete cascade;
comment on column public.comments.moment_id is
  'The moment whose thread this comment is in; null for the jar thread. jar_id is that moment''s jar (0068).';
create index comments_moment_idx on public.comments (moment_id, created_at) where moment_id is not null;

alter table public.moments add column comment_count int not null default 0;
comment on column public.moments.comment_count is
  'Checked, not deleted comments in the moment''s own thread (0068). Set by comments_count_sync.';
-- Signed-in users read moments through a column list (0004).
grant select (comment_count) on public.moments to authenticated;

-- moments_guard_status (0011) guards the other counters; this one has its own trigger.
create or replace function public.moments_comment_count_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.comment_count := 0;
  elsif new.comment_count is distinct from old.comment_count then
    raise exception 'comment_count is set by the server' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger moments_comment_count_guard before insert or update on public.moments
  for each row execute function public.moments_comment_count_guard();

-- ---------------------------------------------------------------- who reads and writes a thread
create or replace function public.can_view_comment_thread(viewer uuid, p_jar uuid, p_moment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_moment is null then exists (select 1 from jars j where j.id = p_jar and can_view_jar(viewer, j))
    else exists (select 1 from moments m where m.id = p_moment and can_view_moment(viewer, m))
  end
$$;
revoke execute on function public.can_view_comment_thread(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_view_comment_thread(uuid, uuid, uuid) to authenticated, service_role;
comment on function public.can_view_comment_thread(uuid, uuid, uuid) is
  'Whether viewer may read and write a comment thread: can_view_moment for a moment thread, can_view_jar for the jar thread (0068).';

alter policy comments_select on public.comments using (
  deleted_at is null
  and public.can_view_comment_thread(auth.uid(), jar_id, moment_id)
  and (not is_hidden or user_id = auth.uid())
  and not public.is_blocked_between(auth.uid(), user_id)
);
alter policy comments_insert on public.comments with check (
  user_id = auth.uid()
  and public.can_view_comment_thread(auth.uid(), jar_id, moment_id)
);

-- ---------------------------------------------------------------- the thread a comment is in
-- Security definer: the moment may be one the writer can't see (RLS then refuses the insert anyway).
create or replace function public.comments_check_moment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.moment_id is not null
     and not exists (select 1 from moments m where m.id = new.moment_id and m.jar_id = new.jar_id) then
    raise exception 'a moment comment must be in the moment''s jar' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger comments_check_moment before insert or update of moment_id, jar_id on public.comments
  for each row execute function public.comments_check_moment();

-- Replaces 0005's function: also, a reply is in its parent's thread.
create or replace function public.comments_check_parent() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into p from comments where id = new.parent_id;
  if p.id is null or p.deleted_at is not null then
    raise exception 'parent comment not found' using errcode = '23503';
  end if;
  if p.jar_id <> new.jar_id then
    raise exception 'a reply must be in the same jar as its parent' using errcode = '23514';
  end if;
  if p.moment_id is distinct from new.moment_id then
    raise exception 'a reply must be in the same thread as its parent' using errcode = '23514';
  end if;
  if p.parent_id is not null then
    raise exception 'replies can only be one level deep' using errcode = '23514';
  end if;
  if is_blocked_between(p.user_id, new.user_id) then
    raise exception 'parent comment not found' using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger comments_check_parent on public.comments;
create trigger comments_check_parent before insert or update of parent_id, jar_id, moment_id on public.comments
  for each row execute function public.comments_check_parent();

-- ---------------------------------------------------------------- counters
-- Replaces 0005's function. Both counts are public, so they count only comments others can see: checked
-- and not deleted. The jar's covers its own thread only (D-51).
create or replace function public.comments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
  mid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set comment_count =
      (select count(*) from comments
       where jar_id = jid and moment_id is null and deleted_at is null and not is_hidden)
    where id = jid;
  end loop;
  foreach mid in array array_remove(array[old.moment_id, new.moment_id], null) loop
    update moments set comment_count =
      (select count(*) from comments where moment_id = mid and deleted_at is null and not is_hidden)
    where id = mid;
  end loop;
  return null;
end $$;
drop trigger comments_count on public.comments;
create trigger comments_count
  after insert or delete or update of is_hidden, deleted_at, jar_id, moment_id on public.comments
  for each row execute function public.comments_count_sync();

-- No comment has a moment yet, so this changes nothing; it keeps the rule true whatever the data.
with c as (
  select j.id,
         (select count(*) from public.comments c
          where c.jar_id = j.id and c.moment_id is null and c.deleted_at is null and not c.is_hidden)::int as n
  from public.jars j
)
update public.jars j set comment_count = c.n from c where c.id = j.id and j.comment_count is distinct from c.n;

-- ---------------------------------------------------------------- notifications (0019)
-- Replaces 0019's function: a comment or reply in a moment thread carries the moment.
create or replace function public.comments_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jar_owner uuid;
  parent_author uuid;
begin
  if not (old.is_hidden and not new.is_hidden) or new.deleted_at is not null then return new; end if;
  select user_id into jar_owner from jars where id = new.jar_id;
  if new.parent_id is not null then
    select user_id into parent_author from comments where id = new.parent_id and deleted_at is null;
    perform notify(parent_author, 'reply', new.user_id, new.jar_id, new.moment_id, new.id);
  end if;
  if jar_owner is distinct from parent_author then
    perform notify(jar_owner, 'comment', new.user_id, new.jar_id, new.moment_id, new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- reports (0021)
-- Replaces 0021's function: a comment is reportable where it can be read, so a moment comment follows
-- its moment (can_view_comment_thread) instead of the jar. Otherwise unchanged.
create or replace function public.reports_before_insert_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  visible boolean;
begin
  -- A repeat report: leave it to the unique index (submit_report ignores it), even if the target has
  -- been hidden since the first one.
  if exists (select 1 from reports r
             where r.reporter_id = new.reporter_id and r.target = new.target and r.target_id = new.target_id) then
    return new;
  end if;

  case new.target
    when 'moment' then
      select m.user_id, can_view_moment(new.reporter_id, m) into owner_id, visible
      from moments m where m.id = new.target_id;
    when 'jar' then
      select j.user_id, can_view_jar(new.reporter_id, j) into owner_id, visible
      from jars j where j.id = new.target_id;
    when 'comment' then
      select c.user_id,
             c.deleted_at is null and not c.is_hidden
             and not is_blocked_between(new.reporter_id, c.user_id)
             and can_view_comment_thread(new.reporter_id, c.jar_id, c.moment_id)
        into owner_id, visible
      from comments c where c.id = new.target_id;
    when 'profile' then
      select p.id, p.status = 'active' and not is_blocked_between(new.reporter_id, p.id)
        into owner_id, visible
      from profiles p where p.id = new.target_id;
  end case;

  if owner_id is not null and owner_id = new.reporter_id then
    raise exception 'you cannot report your own content' using errcode = '22023';
  end if;
  if owner_id is null or not coalesce(visible, false) then
    raise exception 'you can only report something you can see' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- moments_feed_page (0067)
-- Same function, one change: comment_count is the moment's own thread. Every row already passed
-- can_view_moment, which is who may read that thread (can_view_comment_thread). Grants are kept.
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
