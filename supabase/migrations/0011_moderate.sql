-- 0011 — fn:moderate is the only way a moment becomes live or removed (M2-19; FR-SAF-03, FR-PUB-07,
-- FR-JAR-03; D-22, C-4). Additive only: no column is dropped or renamed.
-- Numbered 0011 because 0009 (month_jars, M2-24) and 0010 (milestones, M2-27) were in flight at the same time.
--
-- Until now any non-client role (service_role, postgres, every security definer function) could set
-- `live` or `removed`. Now only the role `pickld_moderation` can, and nothing logs in as it: it owns one
-- security definer function, moderation_apply(), which only service_role may execute and only
-- fn:moderate calls. Clients, service_role and the other server functions are refused (rule 4).
--
-- fn:moderate reads the content a moment would show, asks its provider (D-22: auto-approve, no
-- provider is called), and hands the verdict to moderation_apply():
--   approve  checking → live; a pending proposal (0004) is swapped in and pending_* cleared.
--   review   a moderation_items row (source auto_check, pending) joins the queue; nothing changes.
--   remove   checking → removed; a proposal on a live moment is discarded. A decided item is recorded.
-- The caller passes the pending_since it saw, so a proposal changed during the check is never approved
-- unchecked ('stale': fn:moderate checks again).

-- ---------------------------------------------------------------- the moderation role
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pickld_moderation') then
    create role pickld_moderation nologin noinherit;
  end if;
end $$;
comment on role pickld_moderation is
  'Owns moderation_apply(); the only role that may set moments live or removed. No login.';
-- The migration owner (and pgTAP, which runs as postgres) can SET ROLE to it. The API roles can't.
grant pickld_moderation to postgres;

grant usage on schema public to pickld_moderation;
grant select, update on public.moments to pickld_moderation;
grant select, insert on public.moderation_items to pickld_moderation;
create policy moments_moderation_select on public.moments for select to pickld_moderation using (true);
create policy moments_moderation_update on public.moments for update to pickld_moderation using (true) with check (true);
create policy mod_items_moderation_select on public.moderation_items for select to pickld_moderation using (true);
create policy mod_items_moderation_insert on public.moderation_items for insert to pickld_moderation with check (true);

-- ---------------------------------------------------------------- status guard
-- Replaces 0004's guard (same trigger, moments_bu). Unchanged except the first status check.
create or replace function public.moments_guard_status() returns trigger
language plpgsql as $$
declare
  has_pending boolean := old.pending_since is not null;
begin
  -- Every role: a moment stays in its jar (FR-CAP-10, D-3) and keeps its owner; server time and the
  -- backfill flag from insert are permanent.
  if new.jar_id is distinct from old.jar_id then
    raise exception 'a moment cannot move to another jar' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
    raise exception 'a moment''s id and owner cannot change' using errcode = '42501';
  end if;
  new.added_at := old.added_at;
  new.is_backfilled := old.is_backfilled;

  -- Every role: live and removed come only from moderation_apply() (fn:moderate), rule 4.
  if new.status is distinct from old.status and new.status in ('live', 'removed')
     and current_user <> 'pickld_moderation' then
    raise exception 'status can only be set by the server' using errcode = '42501',
      hint = 'live and removed are set by fn:moderate through moderation_apply().';
  end if;

  if not public.is_client_role() then
    return new; -- fn:moderate, fn:mod-action and other server code
  end if;

  if new.like_count is distinct from old.like_count then
    raise exception 'like_count is set by the server' using errcode = '42501';
  end if;
  if new.pending_photo_path is distinct from old.pending_photo_path
     or new.pending_thumb_path is distinct from old.pending_thumb_path
     or new.pending_caption is distinct from old.pending_caption
     or new.pending_edits is distinct from old.pending_edits
     or new.pending_since is distinct from old.pending_since then
    raise exception 'pending_* columns are set by the server; update photo_path, thumb_path, caption or edits'
      using errcode = '42501';
  end if;
  -- The only status change a client may make is submitting an uploaded moment for checking.
  if new.status is distinct from old.status and not (old.status = 'uploading' and new.status = 'checking') then
    raise exception 'status can only be set by the server' using errcode = '42501';
  end if;

  if new.photo_path is distinct from old.photo_path
     or new.thumb_path is distinct from old.thumb_path
     or new.caption is distinct from old.caption
     or new.edits is distinct from old.edits then
    if old.status = 'removed' then
      raise exception 'a removed moment cannot be edited' using errcode = '42501';
    end if;
    if old.status = 'uploading' then
      return new; -- not submitted yet: nothing has been checked, so edit in place
    end if;
    -- checking or live: propose the change; each field starts from the existing proposal if there is one.
    new.pending_photo_path := case when new.photo_path is distinct from old.photo_path then new.photo_path
                                   when has_pending then old.pending_photo_path else old.photo_path end;
    new.pending_thumb_path := case when new.thumb_path is distinct from old.thumb_path then new.thumb_path
                                   when has_pending then old.pending_thumb_path else old.thumb_path end;
    new.pending_caption    := case when new.caption is distinct from old.caption then new.caption
                                   when has_pending then old.pending_caption else old.caption end;
    new.pending_edits      := case when new.edits is distinct from old.edits then new.edits
                                   when has_pending then old.pending_edits else old.edits end;
    new.pending_since := now();
    new.photo_path := old.photo_path;
    new.thumb_path := old.thumb_path;
    new.caption := old.caption;
    new.edits := old.edits;
  end if;
  -- Slot moves within the jar are allowed; unique (jar_id, slot) refuses a filled slot.
  return new;
end $$;

-- ---------------------------------------------------------------- moderation_apply
-- Applies one verdict to the content fn:moderate checked: the pending proposal when pending_since was
-- set, otherwise the moment itself. Returns what happened:
--   live | swapped | queued | removed | discarded   the verdict was applied (queued: left for a human)
--   stale              pending_since changed since fn:moderate read it; nothing changed, check again
--   nothing_to_check   uploading, removed, or live with no proposal
--   not_found
-- While an auto_check item for the moment is open (pending or escalated), a human decides: the verdict
-- is ignored and the result is 'queued', so calling fn:moderate again can't approve queued content.
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
    if m.pending_since is null then
      update moments set status = 'live' where id = m.id;
      return 'live';
    end if;
    update moments set
      status = 'live',
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

  -- remove
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

-- Changing the owner needs CREATE on the schema; the role keeps no such right afterwards.
grant create on schema public to pickld_moderation;
alter function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke execute on function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text) to service_role;
