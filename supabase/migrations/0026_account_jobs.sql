-- 0026 — account_jobs for fn:data-export, fn:account-delete and fn:account-jobs (M4-18; FR-PRV-02,
-- FR-PRV-03; T-305). Additive: two enums, one table, functions; nothing dropped or renamed.
--
-- Export (FR-PRV-02): the owner asks with account_request_export(); fn:account-jobs (cron) builds a zip of
-- their photos and data under exports/<uid>/<job id>.zip and marks the job done; fn:data-export hands out
-- a 24-hour link. One export per 24 hours: asking again within a day returns the done job.
--
-- Delete (FR-PRV-03): account_delete_request() sets the profile to 'deleted' at once. Every policy and
-- public RPC already hides non-active profiles and their jars and moments (0001, 0025), so the account is
-- gone for everyone else in that same statement. A pending delete job then purges it: fn:account-jobs
-- sweeps the person's bucket prefixes and calls account_delete_purge(), which deletes the auth user
-- (profiles and everything keyed to them cascade, account_jobs included) and the auth rows that don't.
-- The purge waits 7 days after an export finishes (or would finish) so the person can still download it,
-- and is never claimed while an export is unfinished; it never waits past 21 days after the request
-- (FR-PRV-03: everything gone within 30 days, leaving room for retries).
--
-- Jobs are written only by these functions: clients get SELECT on their own rows and nothing else. The
-- runner functions are service-role only (fn:account-jobs).

create type public.account_job_kind as enum ('export', 'delete');
create type public.account_job_status as enum ('pending', 'running', 'done', 'failed');

create table public.account_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.account_job_kind not null,
  status public.account_job_status not null default 'pending',
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  result_key text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table public.account_jobs is
  'Data export and account deletion jobs (0026). Owner reads own rows; written only by account_* functions.';
create unique index account_jobs_one_open_key on public.account_jobs (user_id, kind)
  where status in ('pending', 'running');
create index account_jobs_due_idx on public.account_jobs (run_after) where status in ('pending', 'running');
create index account_jobs_user_idx on public.account_jobs (user_id, kind, created_at desc);

alter table public.account_jobs enable row level security;
revoke all on public.account_jobs from public, anon, authenticated;
grant select on public.account_jobs to authenticated;
create policy account_jobs_owner_select on public.account_jobs for select to authenticated
  using (user_id = auth.uid());

-- The latest time a delete may wait until: 21 days after it was asked for.
create or replace function public.account_delete_latest(p_job public.account_jobs) returns timestamptz
language sql immutable as $$
  select p_job.created_at + interval '21 days'
$$;
revoke execute on function public.account_delete_latest(public.account_jobs) from public, anon, authenticated;

-- Pushes a pending delete back so an export (finished at p_from, or unfinished: now) can be downloaded for 7 days.
create or replace function public.account_delete_defer(p_user uuid, p_from timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  update account_jobs j
  set run_after = greatest(j.run_after, least(p_from + interval '7 days', account_delete_latest(j))),
      updated_at = now()
  where j.user_id = p_user and j.kind = 'delete' and j.status = 'pending'
$$;
revoke execute on function public.account_delete_defer(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- client: export
create or replace function public.account_request_export() returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_status profile_status;
  j account_jobs;
begin
  select status into v_status from profiles where id = v_uid;
  if v_status is null or v_status not in ('active', 'deleted') then
    raise exception 'this account can''t export its data'
      using errcode = '42501', hint = 'Only active accounts, or deleted ones not yet purged, can export.';
  end if;

  select * into j from account_jobs
  where user_id = v_uid and kind = 'export' and status in ('pending', 'running');
  if found then return j; end if;

  -- One export a day: a done one from the last 24 hours is the answer (its link is still good).
  select * into j from account_jobs
  where user_id = v_uid and kind = 'export' and status = 'done' and created_at > now() - interval '24 hours'
  order by created_at desc limit 1;
  if found then return j; end if;

  insert into account_jobs (user_id, kind) values (v_uid, 'export')
  on conflict (user_id, kind) where status in ('pending', 'running') do nothing
  returning * into j;
  if not found then -- a concurrent call inserted it first
    select * into j from account_jobs
    where user_id = v_uid and kind = 'export' and status in ('pending', 'running');
  end if;
  -- Already deleted: the purge waits until this export has been downloadable for a while.
  if v_status = 'deleted' then perform account_delete_defer(v_uid, now()); end if;
  return j;
end $$;
comment on function public.account_request_export() is
  'Asks for a data export (FR-PRV-02); returns the unfinished one, or a done one from the last 24 hours (0026).';
revoke execute on function public.account_request_export() from public, anon;
grant execute on function public.account_request_export() to authenticated;

-- ---------------------------------------------------------------- client: delete
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

-- ---------------------------------------------------------------- runner (fn:account-jobs, service role)
-- Claims up to p_limit due jobs. A job left running for 15 minutes (the function died) is claimed again,
-- or failed once it has used its 3 attempts. A delete is not claimed while the person has an unfinished export.
create or replace function public.account_jobs_claim(p_limit int default 5) returns setof public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update account_jobs
  set status = 'failed', error = coalesce(error, 'timed out'), completed_at = now(), updated_at = now()
  where status = 'running' and updated_at < now() - interval '15 minutes' and attempts >= 3;

  return query
  with due as (
    select j.id from account_jobs j
    where ((j.status = 'pending' and j.run_after <= now())
           or (j.status = 'running' and j.updated_at < now() - interval '15 minutes'))
      and not (j.kind = 'delete' and exists (
        select 1 from account_jobs e
        where e.user_id = j.user_id and e.kind = 'export' and e.status in ('pending', 'running')))
    order by j.run_after
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update account_jobs j
  set status = 'running', attempts = j.attempts + 1, updated_at = now()
  from due where j.id = due.id
  returning j.*;
end $$;

create or replace function public.account_job_done(p_id uuid, p_result_key text default null)
returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare j account_jobs;
begin
  update account_jobs
  set status = 'done', result_key = p_result_key, error = null, completed_at = now(), updated_at = now()
  where id = p_id and status = 'running'
  returning * into j;
  if found and j.kind = 'export' then perform account_delete_defer(j.user_id, j.completed_at); end if;
  return j;
end $$;

-- A failure: back to pending in 10 minutes, or failed after the third attempt.
create or replace function public.account_job_fail(p_id uuid, p_error text) returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare j account_jobs;
begin
  update account_jobs
  set status = case when attempts >= 3 then 'failed' else 'pending' end::account_job_status,
      run_after = case when attempts >= 3 then run_after else now() + interval '10 minutes' end,
      completed_at = case when attempts >= 3 then now() end,
      error = left(p_error, 500),
      updated_at = now()
  where id = p_id and status = 'running'
  returning * into j;
  return j;
end $$;

-- The purge itself: only an account whose profile is 'deleted' (or already gone). Like account_purge()
-- (0023) it deletes, in one transaction, the auth user (cascading to the profile and every public table
-- keyed to it, and to identities, sessions and the like) and the auth rows without a foreign key that
-- still name the person. Photos are not in Postgres: fn:account-jobs sweeps the bucket first.
create or replace function public.account_delete_purge(p_user uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user for update;
  if exists (select 1 from profiles where id = p_user and status <> 'deleted') then
    return false;
  end if;

  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.flow_state where user_id = p_user;
  delete from auth.users where id = p_user;
  delete from auth.audit_log_entries
  where payload->>'actor_id' = p_user::text
     or payload->'traits'->>'user_id' = p_user::text
     or (v_email is not null and (payload->>'actor_username' = v_email or payload->'traits'->>'user_email' = v_email));
  return true;
end $$;
comment on function public.account_delete_purge(uuid) is
  'Purges a deleted account: auth user (cascades) and auth rows naming them; false if the profile is not deleted (0026).';

revoke execute on function public.account_jobs_claim(int) from public, anon, authenticated;
revoke execute on function public.account_job_done(uuid, text) from public, anon, authenticated;
revoke execute on function public.account_job_fail(uuid, text) from public, anon, authenticated;
revoke execute on function public.account_delete_purge(uuid) from public, anon, authenticated;
grant execute on function public.account_jobs_claim(int) to service_role;
grant execute on function public.account_job_done(uuid, text) to service_role;
grant execute on function public.account_job_fail(uuid, text) to service_role;
grant execute on function public.account_delete_purge(uuid) to service_role;
