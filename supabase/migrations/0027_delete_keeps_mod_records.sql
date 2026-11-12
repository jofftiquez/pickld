-- 0027 — account deletion refuses accounts with moderation records (D-36). Additive: replaces
-- account_delete_request() (0026) with one extra check. moderation_items.decided_by and audit_log.actor_id
-- reference profiles without an on-delete action (audit_log is append-only), so purging someone who decided
-- a moderation item or appears in the audit log would fail. Those records are kept; the app's delete is
-- refused up front (fn:account-delete answers 403 not_allowed) and a founder handles such accounts.

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
  -- Refused before anything changes; a founder handles it by hand.
  if exists (select 1 from moderation_items where decided_by = v_uid)
     or exists (select 1 from audit_log where actor_id = v_uid) then
    raise exception 'this account has moderation records'
      using errcode = '42501', hint = 'Moderator accounts are deleted by a founder (D-36).';
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
