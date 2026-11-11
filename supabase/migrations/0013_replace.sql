-- 0013 — A removed photo's slot can be filled again (D-27), and Replace (M2-22; FR-JAR-03, C-4, D-22).
-- Additive: one nullable column; 0001's unique (jar_id, slot) becomes a partial unique index. No column
-- is dropped or renamed (C-5).
--
-- Replace is a new moment, not an edit: it has its own photo, caption, edits, privacy, capture time,
-- server added_at and Added later flag, and starts with no likes. (Edits of the same photo keep using
-- the pending_* proposal from 0004.) The rules:
--   * The owner inserts the new moment with `replaces` = the moment that holds the slot (same owner,
--     jar and slot; not removed; not itself a pending replacement). It starts `checking` like any
--     moment (rule 4), so readers never see it, and it doesn't hold the slot or count while pending.
--   * One pending replacement per moment.
--   * fn:moderate approves it through moderation_apply(): in the same transaction the replaced moment
--     is deleted (as if its owner had deleted it) and the replacement goes live with `replaces` cleared.
--     Readers see the old photo until that commit, then the new one.
--   * Moderation removes it (or queues it): the old moment stays as it is. The removed replacement keeps
--     `replaces` as part of its moderation record.
--   * The replaced moment goes away first (moderation removes it, or the owner deletes it): the pending
--     replacement is released (`replaces` cleared) and holds the slot itself, still waiting for moderation.
--
-- Retiring by deletion: the old photo was the owner's to delete at any time (moments_owner allows it), so
-- Replace does nothing an owner couldn't already do. A removed moment is never deleted here (removed
-- moments are the moderation and appeal record), and Replace never targets one: its slot is simply free.
-- Like any delete, the replaced moment's moderation_items and notifications cascade, and its photo
-- objects stay in the bucket: there is no storage cleanup for deleted moments yet.

-- ---------------------------------------------------------------- the column
alter table public.moments add column replaces uuid references public.moments(id) on delete set null;
comment on column public.moments.replaces is
  'Set at insert on a Replace: the moment this one takes over from once fn:moderate approves it (0013).';
create index moments_replaces_idx on public.moments (replaces) where replaces is not null;
-- Readers only ever see live moments, which never have replaces set; the owner reads it to tell a pending
-- replacement from the moment that holds the slot.
grant select (replaces) on public.moments to authenticated;

-- ---------------------------------------------------------------- D-27: one moment per slot, removed ones aside
-- A removed moment stays (moderation and appeal record) but no longer holds its slot, and a pending
-- replacement doesn't hold it yet.
alter table public.moments drop constraint moments_jar_id_slot_key;
create unique index moments_slot_holder_key on public.moments (jar_id, slot)
  where status <> 'removed' and replaces is null;
create unique index moments_one_replacement_key on public.moments (replaces)
  where replaces is not null and status <> 'removed';

-- ---------------------------------------------------------------- insert: what may be replaced
-- Security definer so the check reads the target whatever the caller can see; runs after moments_bi
-- (owner matches the jar) and moments_bi_client (trigger names sort alphabetically).
create or replace function public.moments_before_insert_replaces() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t moments;
begin
  if new.replaces is null then
    return new;
  end if;
  select * into t from moments where id = new.replaces;
  if t.id is null or t.user_id <> new.user_id or t.jar_id <> new.jar_id or t.slot <> new.slot then
    raise exception 'a replacement must be for your own moment in the same jar and slot' using errcode = '42501';
  end if;
  if t.status = 'removed' then
    raise exception 'a removed moment is not replaced: its slot is free' using errcode = '22023';
  end if;
  if t.replaces is not null then
    raise exception 'a pending replacement cannot be replaced' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger moments_bi_replaces before insert on public.moments
  for each row execute function public.moments_before_insert_replaces();

-- ---------------------------------------------------------------- update: replaces is fixed at insert
create or replace function public.moments_before_update_replaces() returns trigger
language plpgsql as $$
begin
  -- Every role: a replacement goes live only through moderation_apply(), which clears replaces in the
  -- same update after retiring the old moment, so readers never see both.
  if new.status = 'live' and new.replaces is not null then
    raise exception 'a replacement goes live through moderation_apply()' using errcode = '42501';
  end if;
  if not public.is_client_role() then
    return new; -- moderation_apply(), the on delete set null action and the release below
  end if;
  if new.replaces is distinct from old.replaces then
    raise exception 'replaces is set when the replacement is inserted' using errcode = '42501';
  end if;
  if new.slot is distinct from old.slot and (
       old.replaces is not null
       or exists (select 1 from public.moments r where r.replaces = old.id and r.status <> 'removed')) then
    raise exception 'a moment being replaced, or its replacement, cannot move to another slot'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger moments_bu_replaces before update on public.moments
  for each row execute function public.moments_before_update_replaces();

-- The moment being replaced was removed (moderation): its pending replacement now holds the slot itself.
create or replace function public.moments_release_replacement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update moments set replaces = null where replaces = new.id and status <> 'removed';
  return null;
end $$;
create trigger moments_release_replacement after update of status on public.moments
  for each row when (new.status = 'removed' and old.status is distinct from 'removed')
  execute function public.moments_release_replacement();

-- ---------------------------------------------------------------- counters
-- Replaces 0003's function. moment_count leaves out pending replacements (the slot is counted once);
-- visible_count needs no change because a replacement is never live while pending.
create or replace function public.moments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set
      moment_count  = (select count(*) from moments where jar_id = jid and status <> 'removed' and replaces is null),
      visible_count = (select count(*) from moments where jar_id = jid and status = 'live' and not is_private),
      updated_at = now()
    where id = jid;
    update profiles p set jar_count = (select count(*) from jars where user_id = p.id and moment_count > 0)
    where p.id = (select user_id from jars where id = jid);
  end loop;
  return null;
end $$;
drop trigger moments_count on public.moments;
create trigger moments_count after insert or delete or update of status, is_private, jar_id, replaces on public.moments
  for each row execute function public.moments_count_sync();

-- ---------------------------------------------------------------- month_jars cover
-- Replaces 0009's function: unchanged except that a pending replacement is never the cover.
create or replace function public.month_jars(month date)
returns table (
  jar_id uuid,
  local_date date,
  tz text,
  visibility jar_visibility,
  published_at timestamptz,
  moment_count smallint,
  is_full boolean,
  cover_moment_id uuid,
  cover_slot slot,
  cover_thumb_path text
)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
begin
  if month_jars.month is null then
    raise exception 'month is required' using errcode = '22023';
  end if;
  return query
  select j.id, j.local_date, j.tz, j.visibility, j.published_at, j.moment_count, j.is_full,
         c.id, c.slot, c.thumb_path
  from jars j
  left join lateral (
    select m.id, m.slot, m.thumb_path
    from moments m
    where m.jar_id = j.id and m.status <> 'removed' and m.replaces is null and m.thumb_path is not null
    order by m.slot
    limit 1
  ) c on true
  where j.user_id = auth.uid()
    and j.local_date >= date_trunc('month', month_jars.month)::date
    and j.local_date < (date_trunc('month', month_jars.month) + interval '1 month')::date
  order by j.local_date;
end $$;

-- ---------------------------------------------------------------- the swap
-- The moderation role may delete only a moment that has a pending replacement, and only
-- moderation_apply() runs as it.
-- (A security definer helper: a policy on moments can't query moments itself.)
create or replace function public.has_pending_replacement(moment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from moments r where r.replaces = has_pending_replacement.moment_id and r.status <> 'removed')
$$;
revoke execute on function public.has_pending_replacement(uuid) from public, anon, authenticated;
grant execute on function public.has_pending_replacement(uuid) to pickld_moderation;
grant delete on public.moments to pickld_moderation;
create policy moments_moderation_delete on public.moments for delete to pickld_moderation
  using (public.has_pending_replacement(id));

-- Replaces 0011's function: unchanged except the approve branch, which retires the replaced moment and
-- clears replaces. A replacement that becomes live returns 'live' (or 'swapped' with a pending edit).
create or replace function public.moderation_apply(
  p_moment_id uuid,
  p_pending_since timestamptz,
  p_decision text,
  p_provider text,
  p_scores jsonb default '{}'::jsonb,
  p_reason text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  m moments;
  item jsonb := jsonb_build_object('provider', p_provider, 'scores', coalesce(p_scores, '{}'::jsonb));
begin
  if p_decision is null or p_decision not in ('approve', 'review', 'remove') then
    raise exception 'decision must be approve, review or remove' using errcode = '22023';
  end if;
  if p_provider is null or p_provider = '' then
    raise exception 'provider is required' using errcode = '22023';
  end if;

  select * into m from moments where id = p_moment_id for update;
  if m.id is null then
    return 'not_found';
  end if;
  if m.pending_since is distinct from p_pending_since then
    return 'stale';
  end if;
  if m.status in ('uploading', 'removed') or (m.status = 'live' and m.pending_since is null) then
    return 'nothing_to_check';
  end if;
  if exists (select 1 from moderation_items
             where moment_id = m.id and source = 'auto_check' and status in ('pending', 'escalated')) then
    return 'queued';
  end if;

  if p_decision = 'approve' then
    if m.replaces is not null then
      -- Replace (0013): the old moment leaves in this transaction, so readers see one or the other.
      delete from moments where id = m.replaces and status <> 'removed';
    end if;
    if m.pending_since is null then
      update moments set status = 'live', replaces = null where id = m.id;
      return 'live';
    end if;
    update moments set
      status = 'live',
      replaces = null,
      photo_path = m.pending_photo_path,
      thumb_path = m.pending_thumb_path,
      caption = m.pending_caption,
      edits = coalesce(m.pending_edits, '{}'::jsonb),
      pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
      pending_edits = null, pending_since = null
    where id = m.id;
    return 'swapped';
  end if;

  if p_decision = 'review' then
    insert into moderation_items (moment_id, source, scores, status, decision_reason)
    values (m.id, 'auto_check', item, 'pending', p_reason);
    return 'queued';
  end if;

  -- remove (a replacement's old moment is left as it is)
  insert into moderation_items (moment_id, source, scores, status, decided_at, decision_reason)
  values (m.id, 'auto_check', item, 'removed', now(), p_reason);
  if m.status = 'checking' then
    update moments set
      status = 'removed',
      pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
      pending_edits = null, pending_since = null
    where id = m.id;
    return 'removed';
  end if;
  -- live with a proposal: the checked version stays, the proposal is dropped.
  update moments set
    pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
    pending_edits = null, pending_since = null
  where id = m.id;
  return 'discarded';
end $$;
