-- 0173 — A tag notifies once, and its notification goes when the moment stops being shared. Additive: replaces
-- moments_tags_sync (0172) only; nothing is dropped or rewritten.
--
--   * Told once (0172's rule): taking a mention out deletes its moment_tags row, so putting it back made a new
--     row and a second notification and push. A tag notification already there for that person and moment now
--     stops a second one.
--   * Rule 9 (private moments never leave their owner, notifications included): when the moment turns Only me,
--     is hidden or is removed, the tagged people's notifications for it go, pushed or not. Their rows keep
--     notified_at, so sharing the moment again doesn't tell them again.

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
    select c from caption_mentioned(new.caption) c where can_tag(new.user_id, c, new.id)
  ) s;

  delete from moment_tags where moment_id = new.id and removed_at is null and not (tagged_id = any (wanted));
  insert into moment_tags (moment_id, tagged_id, author_id)
  select new.id, u, new.user_id from unnest(wanted) u
  on conflict (moment_id, tagged_id) do nothing;

  if new.status = 'live' and new.visibility <> 'only_me' and new.hidden_at is null then
    for r in
      update moment_tags set notified_at = now()
      where moment_id = new.id and removed_at is null and notified_at is null
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
