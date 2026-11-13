-- T-508 (0061; FR-PRV-02): account_job_yield() hands a running export back to the next run without using an
-- attempt. Only the service role may call it; tried as owner, reader, outsider, blocked user and anon. It
-- touches only a running job.
begin;
\ir _helpers.psql
select plan(9);

select tests.world();

select ok(not has_function_privilege('anon', 'public.account_job_yield(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_job_yield(uuid)', 'execute'),
          'anon and signed-in users may not call it');
select ok(has_function_privilege('service_role', 'public.account_job_yield(uuid)', 'execute'), 'the service role may');

select tests.act_as('owner');
create temp table j as select (public.account_request_export()).id;
grant select on j to anon, authenticated, service_role;

select tests.act_as('owner');
select throws_ok(format('select public.account_job_yield(%L)', (select id from j)), '42501', null,
                 'the owner cannot hand back their own job');
select tests.act_as('reader');
select throws_ok(format('select public.account_job_yield(%L)', (select id from j)), '42501', null, 'nor a reader');
select tests.act_as('outsider');
select throws_ok(format('select public.account_job_yield(%L)', (select id from j)), '42501', null, 'nor an outsider');
select tests.act_as('blocked');
select throws_ok(format('select public.account_job_yield(%L)', (select id from j)), '42501', null, 'nor the blocked user');
select tests.act_as_anon();
select throws_ok(format('select public.account_job_yield(%L)', (select id from j)), '42501', null, 'nor anon');

-- Claimed (attempt 1), postponed, then handed back: pending, due now, no attempt used.
select tests.act_as_service();
select public.account_jobs_claim(10);
select tests.reset_role();
update public.account_jobs set run_after = now() + interval '1 hour' where id = (select id from j);
select tests.act_as_service();
select is((select status::text || '/' || attempts || '/' || (run_after <= now())
           from public.account_job_yield((select id from j))),
          'pending/0/true', 'a running job goes back to pending, due now, with its attempt given back');
select is((public.account_job_yield((select id from j))).id, null, 'a job that isn''t running is left alone');
select tests.reset_role();

select * from finish();
rollback;
