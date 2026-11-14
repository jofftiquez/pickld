-- 0134 (INV-02, #373): a waiting account can ask for a copy of its data. People who signed up during the
-- invite period are entitled to their data before they're let in, like they can already delete themselves
-- (account_delete_request accepts any status). Same as 0026 with `waiting` added to the allowed statuses.

create or replace function public.account_request_export() returns public.account_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_status profile_status;
  j account_jobs;
begin
  select status into v_status from profiles where id = v_uid;
  if v_status is null or v_status not in ('active', 'waiting', 'deleted') then
    raise exception 'this account can''t export its data'
      using errcode = '42501', hint = 'Only active or waiting accounts, or deleted ones not yet purged, can export.';
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
  'Asks for a data export (FR-PRV-02); returns the unfinished one, or a done one from the last 24 hours (0026). Waiting accounts too (0134).';
revoke execute on function public.account_request_export() from public, anon;
grant execute on function public.account_request_export() to authenticated;
