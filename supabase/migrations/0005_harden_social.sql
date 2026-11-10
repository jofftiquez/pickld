-- 0005 — Harden social tables (docs/analysis.md S-3, S-6 counters, S-7, S-8, S-10; D-11; M1-10).
-- Additive only: no column is dropped or renamed. Two 0001 policies are replaced (comments_soft_delete,
-- reactions_select); policies hold no data.

-- ---------------------------------------------------------------- visibility helper
-- A moment is visible to its owner, or to others when it is live, not private and in a jar they can view.
create or replace function public.can_view_moment(viewer uuid, m public.moments) returns boolean
language sql stable security definer set search_path = public as $$
  select m.user_id = viewer
      or (m.status = 'live' and not m.is_private
          and exists (select 1 from jars j where j.id = m.jar_id and can_view_jar(viewer, j)))
$$;

-- True when target (a jar or moment id) exists and viewer can see it.
create or replace function public.can_view_target(viewer uuid, t target_type, tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case t
    when 'jar' then exists (select 1 from jars j where j.id = tid and can_view_jar(viewer, j))
    when 'moment' then exists (select 1 from moments m where m.id = tid and can_view_moment(viewer, m))
    else false
  end
$$;

-- ---------------------------------------------------------------- S-10: active users only (D-11)
-- Restrictive policies are ANDed with the existing permissive ones.
create policy jars_active_insert on public.jars as restrictive for insert to authenticated
  with check (public.is_active_user());
create policy moments_active_insert on public.moments as restrictive for insert to authenticated
  with check (public.is_active_user());
create policy comments_active_insert on public.comments as restrictive for insert to authenticated
  with check (public.is_active_user());
create policy reactions_active_insert on public.reactions as restrictive for insert to authenticated
  with check (public.is_active_user());
-- Following needs both ends active: a suspended or deleted author can't gain readers.
create policy follows_active_insert on public.follows as restrictive for insert to authenticated
  with check (public.is_active_user() and public.is_active_user(author_id));

-- ---------------------------------------------------------------- S-7: reactions on visible targets
create policy reactions_visible_insert on public.reactions as restrictive for insert to authenticated
  with check (public.can_view_target(auth.uid(), target, target_id));
drop policy reactions_select on public.reactions;
create policy reactions_select on public.reactions for select
  using (public.can_view_target(auth.uid(), target, target_id));
revoke update on public.reactions from authenticated, anon;

-- ---------------------------------------------------------------- S-7: appeals only for your own removed content
create or replace function public.can_appeal(item uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from moderation_items mi
    left join moments m on m.id = mi.moment_id
    left join comments c on c.id = mi.comment_id
    where mi.id = item and mi.status = 'removed'
      and (m.user_id = uid or c.user_id = uid)
  )
$$;
create policy appeals_own_removed_insert on public.appeals as restrictive for insert to authenticated
  with check (public.can_appeal(moderation_item_id) and status = 'open');

-- ---------------------------------------------------------------- S-3: comments
-- No direct updates by clients: is_hidden is the moderation result and bodies aren't editable.
drop policy comments_soft_delete on public.comments;
revoke update, delete on public.comments from authenticated, anon;

-- The comment author or the jar owner soft-deletes through this RPC.
create or replace function public.delete_comment(comment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c comments;
begin
  select * into c from comments where id = comment_id and deleted_at is null;
  if c.id is null
     or not (c.user_id = auth.uid() or exists (select 1 from jars j where j.id = c.jar_id and j.user_id = auth.uid())) then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
  update comments set deleted_at = now() where id = comment_id;
end $$;
revoke execute on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

-- Client inserts start hidden (checked by fn:moderate) with server time.
create or replace function public.comments_before_insert_client() returns trigger
language plpgsql as $$
begin
  if public.is_client_role() then
    new.is_hidden := true;
    new.deleted_at := null;
    new.created_at := now();
  end if;
  return new;
end $$;
create trigger comments_bi_client before insert on public.comments
  for each row execute function public.comments_before_insert_client();

-- S-8: one level of replies, parent in the same jar, not deleted, and no replies across a block.
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
  if p.parent_id is not null then
    raise exception 'replies can only be one level deep' using errcode = '23514';
  end if;
  if is_blocked_between(p.user_id, new.user_id) then
    raise exception 'parent comment not found' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger comments_check_parent before insert or update of parent_id, jar_id on public.comments
  for each row execute function public.comments_check_parent();

-- ---------------------------------------------------------------- S-6: like and comment counters
-- Recomputed from the source rows, so they can't drift.
create or replace function public.reactions_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r reactions := coalesce(new, old);
begin
  if r.target = 'jar' then
    update jars set like_count = (select count(*) from reactions where target = 'jar' and target_id = r.target_id)
    where id = r.target_id;
  elsif r.target = 'moment' then
    update moments set like_count = (select count(*) from reactions where target = 'moment' and target_id = r.target_id)
    where id = r.target_id;
  end if;
  return null;
end $$;
create trigger reactions_count after insert or delete on public.reactions
  for each row execute function public.reactions_count_sync();

-- comment_count is public, so it counts only comments others can see: checked and not deleted.
create or replace function public.comments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set comment_count =
      (select count(*) from comments where jar_id = jid and deleted_at is null and not is_hidden)
    where id = jid;
  end loop;
  return null;
end $$;
create trigger comments_count after insert or delete or update of is_hidden, deleted_at, jar_id on public.comments
  for each row execute function public.comments_count_sync();

-- Bring existing rows in line (the seed has likes and comments).
update public.jars j set
  like_count = (select count(*) from public.reactions r where r.target = 'jar' and r.target_id = j.id),
  comment_count = (select count(*) from public.comments c where c.jar_id = j.id and c.deleted_at is null and not c.is_hidden);
update public.moments m set
  like_count = (select count(*) from public.reactions r where r.target = 'moment' and r.target_id = m.id);
