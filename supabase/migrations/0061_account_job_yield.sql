-- 0061 — account_job_yield() for fn:account-jobs (T-508; FR-PRV-02). The data export now draws a finished
-- copy of every moment (filter and overlays) before it builds the zip. Drawing takes longer than one cron
-- run may use, so a run draws a few and hands the job back for the next run. Handing back is not a
-- failure: the attempt the claim counted is given back and the job is due again at once. Additive only.

create or replace function public.account_job_yield(p_id uuid) returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare j account_jobs;
begin
  update account_jobs
  set status = 'pending', attempts = greatest(attempts - 1, 0), run_after = now(), updated_at = now()
  where id = p_id and status = 'running'
  returning * into j;
  return j;
end $$;

comment on function public.account_job_yield(uuid) is
  'Puts a running account job back to pending without using an attempt (0061; fn:account-jobs, service role).';

revoke execute on function public.account_job_yield(uuid) from public, anon, authenticated;
grant execute on function public.account_job_yield(uuid) to service_role;
