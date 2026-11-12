-- 0040 — Child-safety match and second opinion (M2-20; FR-SAF-04, FR-SAF-03; D-13, D-22, D-41;
-- docs/csam-scanning.md). Additive only: one new table, one new function, and moderation_apply() gains a
-- p_second_opinion argument. No column is dropped or renamed. Numbered 0040 to stay clear of migrations
-- other work adds meanwhile.
--
-- fn:moderate now runs the full check (CSAM hash match, then content scores, then a vision second opinion
-- on borderline scores). A hash match never reaches moderation_apply(): it calls moderation_csam_block(),
-- which, in one transaction,
--   * removes the moment (checking → removed) or drops a proposal on a live moment,
--   * suspends the owner with no end date (profiles.status = 'suspended': everything they posted is hidden
--     from others at once, D-11),
--   * records a csam_incidents row with the object keys, which survives the moment and blocks the
--     account's purge (evidence for the legal flow), and
--   * deletes every moderation_items row about the moment, so the photo never appears in the console's
--     queue or history (FR-SAF-04). The incident is the record.
-- csam_incidents has RLS on and no policies: no client or moderator role can read it. The founders' legal
-- group reads it with the service role (Studio) until a legal console exists.

-- ---------------------------------------------------------------- csam_incidents
create table public.csam_incidents (
  id uuid primary key default gen_random_uuid(),
  -- No on-delete action: the owner's profile (and so the account purge) can't be deleted while the
  -- incident exists. A founder closes the legal flow first.
  user_id uuid not null references public.profiles(id),
  moment_id uuid references public.moments(id) on delete set null,
  photo_path text,
  thumb_path text,
  matcher text not null check (matcher <> ''),
  match jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reported', 'closed')),
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.csam_incidents is
  'Child-safety hash matches (FR-SAF-04, 0040). Written only by moderation_csam_block(); read by the '
  'legal group with the service role. Keeps the object keys after the moment is gone.';
create index csam_incidents_user_idx on public.csam_incidents (user_id);
alter table public.csam_incidents enable row level security;
revoke all on public.csam_incidents from anon, authenticated;
-- service_role (Studio, the legal group) may read; only moderation_csam_block() writes.
revoke insert, update, delete, truncate on public.csam_incidents from service_role;

-- ---------------------------------------------------------------- the moderation role's new rights
grant insert, select on public.csam_incidents to pickld_moderation;
create policy csam_incidents_moderation_insert on public.csam_incidents for insert to pickld_moderation
  with check (true);
create policy csam_incidents_moderation_select on public.csam_incidents for select to pickld_moderation
  using (true);
grant select, update (status) on public.profiles to pickld_moderation;
create policy profiles_moderation_select on public.profiles for select to pickld_moderation using (true);
create policy profiles_moderation_update on public.profiles for update to pickld_moderation
  using (true) with check (true);
grant delete on public.moderation_items to pickld_moderation;
create policy mod_items_moderation_delete on public.moderation_items for delete to pickld_moderation
  using (true);

-- ---------------------------------------------------------------- moderation_csam_block
-- Returns blocked | stale | nothing_to_check | not_found (the same meanings as moderation_apply()).
-- p_photo_path and p_thumb_path are the keys fn:moderate checked (the proposal's, for a pending change).
create or replace function public.moderation_csam_block(
  p_moment_id uuid,
  p_pending_since timestamptz,
  p_matcher text,
  p_match jsonb,
  p_photo_path text,
  p_thumb_path text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  m moments;
begin
  if p_matcher is null or p_matcher = '' then
    raise exception 'matcher is required' using errcode = '22023';
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

  insert into csam_incidents (user_id, moment_id, photo_path, thumb_path, matcher, match)
  values (m.user_id, m.id, p_photo_path, p_thumb_path, p_matcher, coalesce(p_match, '{}'::jsonb));

  update profiles set status = 'suspended' where id = m.user_id and status = 'active';

  -- Never in the queue: no item (auto_check, report or appeal) about this moment remains.
  delete from moderation_items where moment_id = m.id;

  if m.status = 'checking' then
    update moments set
      status = 'removed',
      pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
      pending_edits = null, pending_since = null
    where id = m.id;
  else
    update moments set
      pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
      pending_edits = null, pending_since = null
    where id = m.id;
  end if;
  return 'blocked';
end $$;

grant create on schema public to pickld_moderation;
alter function public.moderation_csam_block(uuid, timestamptz, text, jsonb, text, text) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke execute on function public.moderation_csam_block(uuid, timestamptz, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.moderation_csam_block(uuid, timestamptz, text, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------- moderation_apply: second opinion
-- Replaces 0013's function with one more argument: p_second_opinion is stored on the queued item
-- (moderation_items.second_opinion, D-13) for the console. It never changes the decision. The old
-- six-argument signature is dropped so callers can't reach a version without it.
drop function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text);
create function public.moderation_apply(
  p_moment_id uuid,
  p_pending_since timestamptz,
  p_decision text,
  p_provider text,
  p_scores jsonb default '{}'::jsonb,
  p_reason text default null,
  p_second_opinion jsonb default null
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
    insert into moderation_items (moment_id, source, scores, second_opinion, status, decision_reason)
    values (m.id, 'auto_check', item, p_second_opinion, 'pending', p_reason);
    return 'queued';
  end if;

  -- remove (a replacement's old moment is left as it is)
  insert into moderation_items (moment_id, source, scores, second_opinion, status, decided_at, decision_reason)
  values (m.id, 'auto_check', item, p_second_opinion, 'removed', now(), p_reason);
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

grant create on schema public to pickld_moderation;
alter function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text, jsonb) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke execute on function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.moderation_apply(uuid, timestamptz, text, text, jsonb, text, jsonb) to service_role;

-- ---------------------------------------------------------------- account deletion keeps the evidence
-- account_delete_request() (0027) gains one check: an account with a child-safety incident can't purge
-- itself (the profile FK would also stop the purge later). A founder handles it with the legal flow.
create or replace function public.account_delete_request() returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_status profile_status;
  v_export account_jobs;
  v_run_after timestamptz := now();
  j account_jobs;
begin
  select status into v_status from profiles where id = v_uid for update;
  if v_status is null then
    raise exception 'no account to delete' using errcode = '42501';
  end if;

  -- D-36: a moderator's decisions and audit entries are kept, so their account can't purge itself.
  -- D-41: neither can an account with a child-safety incident (the evidence is kept for the legal flow).
  -- Refused before anything changes; a founder handles it by hand.
  if exists (select 1 from moderation_items where decided_by = v_uid)
     or exists (select 1 from audit_log where actor_id = v_uid)
     or exists (select 1 from csam_incidents where user_id = v_uid) then
    raise exception 'this account has moderation records'
      using errcode = '42501', hint = 'Accounts with moderation records are deleted by a founder (D-36, D-41).';
  end if;

  -- Hidden from everyone from here on (RLS and the public RPCs only show active profiles).
  if v_status <> 'deleted' then
    update profiles set status = 'deleted' where id = v_uid;
  end if;

  -- Asked before: the same job (a failed one is replaced by a new one below).
  select * into j from account_jobs
  where user_id = v_uid and kind = 'delete' and status in ('pending', 'running');
  if found then return j; end if;

  -- Wait so an unfinished export, or one finished in the last 7 days, can still be downloaded.
  select * into v_export from account_jobs
  where user_id = v_uid and kind = 'export'
    and (status in ('pending', 'running') or (status = 'done' and completed_at > now() - interval '7 days'))
  order by (status in ('pending', 'running')) desc, completed_at desc nulls last
  limit 1;
  if found then
    v_run_after := coalesce(case when v_export.status = 'done' then v_export.completed_at end, now())
                   + interval '7 days';
  end if;

  insert into account_jobs (user_id, kind, run_after) values (v_uid, 'delete', v_run_after)
  returning * into j;
  return j;
end $$;
comment on function public.account_delete_request() is
  'Deletes the caller''s account (FR-PRV-03): hides the profile now and queues the purge (0026). Idempotent.';
revoke execute on function public.account_delete_request() from public, anon;
grant execute on function public.account_delete_request() to authenticated;
