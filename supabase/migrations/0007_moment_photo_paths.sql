-- 0007 — Photo paths for fn:photo-urls (NFR-SEC-02, FR-PUB-05, FR-MOD-03; D-12; M1-16).
-- Additive only: one new function, no table change.
--
-- fn:photo-urls signs 15-minute photo tokens only for the paths this returns. The visibility decision
-- stays in Postgres:
--   * anyone who can view the moment (can_view_moment: the owner, or others for a live, non-private
--     moment in a jar they can view) gets photo_path and thumb_path;
--   * a moderator also gets them for a moment in the moderation queue (an item that is pending or
--     escalated, or has an open appeal), whatever its status;
--   * pending_* paths (an edit awaiting moderation, 0004) go only to the owner and, for queued
--     moments, moderators. Readers never see unchecked content.
-- Moments the caller can't see are simply not returned, so the caller can't tell them from missing ids.
create or replace function public.moment_photo_paths(ids uuid[])
returns table (moment_id uuid, photo_path text, thumb_path text, pending_photo_path text, pending_thumb_path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if cardinality(ids) > 100 then
    raise exception 'at most 100 moments per call' using errcode = '22023';
  end if;
  return query
  select m.id, m.photo_path, m.thumb_path,
         case when m.user_id = auth.uid() or q.queued then m.pending_photo_path end,
         case when m.user_id = auth.uid() or q.queued then m.pending_thumb_path end
  from moments m
  cross join lateral (
    select is_moderator() and exists (
      select 1 from moderation_items mi
      where mi.moment_id = m.id
        and (mi.status in ('pending', 'escalated')
             or exists (select 1 from appeals a where a.moderation_item_id = mi.id and a.status = 'open'))
    ) as queued
  ) q
  where m.id = any (ids)
    and (q.queued or can_view_moment(auth.uid(), m));
end $$;
revoke execute on function public.moment_photo_paths(uuid[]) from public, anon;
grant execute on function public.moment_photo_paths(uuid[]) to authenticated;
