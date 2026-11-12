-- M4-18 (0026; FR-PRV-02, FR-PRV-03; T-305): account_jobs, data export and account deletion. Tried as
-- owner, reader, outsider, blocked user and anon: only the owner sees their jobs and nobody writes them
-- directly; account_delete_request() hides the profile at once and the client can't undo it; the delete
-- waits for an export; the runner functions are service-role only.
begin;
\ir _helpers.psql
select plan(66);

select tests.world();
select tests.create_user('susp');
select tests.create_user('quick');
update public.profiles set status = 'suspended' where id = tests.id('susp');

create temp table k (name text primary key, id uuid);
grant select, insert, update on k to anon, authenticated, service_role;
insert into k select 'jar', tests.make_jar('owner', 'everyone', published => true);
insert into k select 'moment', tests.make_moment((select id from k where name = 'jar'), 'morning', 'live');

-- ---------------------------------------------------------------- privileges
select ok(has_table_privilege('authenticated', 'public.account_jobs', 'select'), 'signed-in users may select (RLS: own rows)');
select ok(not has_table_privilege('authenticated', 'public.account_jobs', 'insert'), 'but not insert');
select ok(not has_table_privilege('authenticated', 'public.account_jobs', 'update'), 'nor update');
select ok(not has_table_privilege('authenticated', 'public.account_jobs', 'delete'), 'nor delete');
select ok(not has_table_privilege('anon', 'public.account_jobs', 'select'), 'anon may not read jobs');
select ok(not has_function_privilege('anon', 'public.account_request_export()', 'execute'), 'anon may not ask for an export');
select ok(not has_function_privilege('anon', 'public.account_delete_request()', 'execute'), 'anon may not delete');
select ok(has_function_privilege('authenticated', 'public.account_delete_request()', 'execute'), 'signed-in users may delete themselves');
select ok(not has_function_privilege('authenticated', 'public.account_jobs_claim(int)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_job_done(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_job_fail(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_delete_purge(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_delete_defer(uuid, timestamptz)', 'execute'),
          'signed-in users may not call the runner functions');
select ok(not has_function_privilege('anon', 'public.account_jobs_claim(int)', 'execute')
          and not has_function_privilege('anon', 'public.account_delete_purge(uuid)', 'execute'),
          'nor may anon');
select ok(has_function_privilege('service_role', 'public.account_jobs_claim(int)', 'execute')
          and has_function_privilege('service_role', 'public.account_job_done(uuid, text)', 'execute')
          and has_function_privilege('service_role', 'public.account_job_fail(uuid, text)', 'execute')
          and has_function_privilege('service_role', 'public.account_delete_purge(uuid)', 'execute'),
          'the service role may');

select tests.act_as('owner');
select throws_ok($$select * from public.account_jobs_claim(5)$$, '42501', null, 'owner cannot claim jobs');
select throws_ok($$select public.account_delete_purge(auth.uid())$$, '42501', null, 'owner cannot run the purge');

-- ---------------------------------------------------------------- export
select tests.act_as('owner');
insert into k select 'export', (public.account_request_export()).id;
select is((select status::text from public.account_jobs where id = (select id from k where name = 'export')), 'pending',
          'owner asks for an export: a pending job');
select is((public.account_request_export()).id, (select id from k where name = 'export'), 'asking again returns the same job');
select is((select count(*) from public.account_jobs), 1::bigint, 'owner sees their job');
select throws_ok($$insert into public.account_jobs (user_id, kind) values (auth.uid(), 'export')$$, '42501', null,
                 'owner cannot insert a job directly');
select throws_ok($$update public.account_jobs set status = 'done', result_key = 'exports/x'$$, '42501', null,
                 'owner cannot update a job directly');
select throws_ok($$delete from public.account_jobs$$, '42501', null, 'owner cannot delete a job directly');

select tests.act_as('reader');
select is((select count(*) from public.account_jobs), 0::bigint, 'a reader sees none of owner''s jobs');
select throws_ok(format($$insert into public.account_jobs (user_id, kind) values (%L, 'delete')$$, tests.id('owner')),
                 '42501', null, 'a reader cannot queue a delete for owner');
select tests.act_as('outsider');
select is((select count(*) from public.account_jobs), 0::bigint, 'an outsider sees none');
select tests.act_as('blocked');
select is((select count(*) from public.account_jobs), 0::bigint, 'the blocked user sees none');
select tests.act_as_anon();
select throws_ok($$select count(*) from public.account_jobs$$, '42501', null, 'anon cannot read jobs');
select throws_ok($$select public.account_request_export()$$, '42501', null, 'anon cannot ask for an export');

select tests.act_as('susp');
select throws_ok($$select public.account_request_export()$$, '42501', null, 'a suspended account cannot export');

-- The runner takes the export and finishes it.
select tests.act_as_service();
select is((select array_agg(id) from public.account_jobs_claim(10)), array[(select id from k where name = 'export')],
          'the runner claims the due export');
select tests.reset_role();
select is((select status::text || '/' || attempts from public.account_jobs where id = (select id from k where name = 'export')),
          'running/1', 'claimed: running, first attempt');
select tests.act_as('owner');
select is((public.account_request_export()).id, (select id from k where name = 'export'), 'asking while it runs returns it');
select tests.act_as_service();
select is((select count(*) from public.account_jobs_claim(10)), 0::bigint, 'a running job is not claimed twice');
select is((public.account_job_done((select id from k where name = 'export'), 'exports/x.zip')).status::text, 'done',
          'the runner marks it done');
select tests.act_as('owner');
select is((public.account_request_export()).id, (select id from k where name = 'export'),
          'within 24 hours, asking again returns the done export (one a day)');
select is((select result_key from public.account_jobs where id = (select id from k where name = 'export')), 'exports/x.zip',
          'with its result key');
select tests.reset_role();
update public.account_jobs set created_at = now() - interval '25 hours' where id = (select id from k where name = 'export');
select tests.act_as('owner');
select isnt((public.account_request_export()).id, (select id from k where name = 'export'),
            'a day later, a new export can be asked for');
select tests.reset_role();
delete from public.account_jobs where user_id = tests.id('owner') and status = 'pending';
update public.account_jobs set created_at = now() - interval '1 hour' where id = (select id from k where name = 'export');

-- ---------------------------------------------------------------- delete hides the profile at once
select tests.act_as('reader');
select is((select count(*) from public.profiles where id = tests.id('owner')), 1::bigint, 'before: reader sees owner');
select is((select count(*) from public.moments where id = (select id from k where name = 'moment')), 1::bigint,
          'and owner''s moment');
select tests.act_as_anon();
select isnt(public.public_profile('t_owner'), null, 'before: owner''s public page exists');

select tests.act_as('owner');
insert into k select 'delete', (public.account_delete_request()).id;
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('owner')), 'deleted', 'owner''s profile is deleted');
select is((select run_after from public.account_jobs where id = (select id from k where name = 'delete')),
          (select completed_at from public.account_jobs where id = (select id from k where name = 'export')) + interval '7 days',
          'the purge waits 7 days after the finished export');

select tests.act_as('reader');
select is((select count(*) from public.profiles where id = tests.id('owner')), 0::bigint, 'reader no longer sees owner');
select is((select count(*) from public.moments where id = (select id from k where name = 'moment')), 0::bigint,
          'nor owner''s moment');
select is((select count(*) from public.jars where id = (select id from k where name = 'jar')), 0::bigint, 'nor the jar');
select tests.act_as('outsider');
select is((select count(*) from public.profiles where id = tests.id('owner')), 0::bigint, 'an outsider no longer sees owner');
select tests.act_as_anon();
select is(public.public_profile('t_owner'), null, 'owner''s public page is gone');
select is(public.public_jar((select id from k where name = 'jar')), null, 'and the shared jar link');

select tests.act_as('owner');
select is((public.account_delete_request()).id, (select id from k where name = 'delete'), 'deleting again returns the same job');
select throws_ok($$update public.profiles set status = 'active' where id = auth.uid()$$, '42501', null,
                 'owner cannot flip the status back');
select is((public.account_request_export()).id, (select id from k where name = 'export'),
          'a deleted account can still reach its export');
select is((select count(*) from public.account_jobs), 2::bigint, 'and still sees its jobs');

-- ---------------------------------------------------------------- the runner and the delete
select tests.act_as_service();
select is((select count(*) from public.account_jobs_claim(10)), 0::bigint, 'the delete is not due yet');

-- Due, but an export is unfinished: not claimed.
select tests.reset_role();
update public.account_jobs set run_after = now() - interval '1 minute' where id = (select id from k where name = 'delete');
insert into public.account_jobs (user_id, kind) values (tests.id('owner'), 'export');
select tests.act_as_service();
select is((select array_agg(kind::text) from public.account_jobs_claim(10)), array['export'],
          'with an unfinished export, only the export is claimed');
select is((select count(*) from public.account_jobs_claim(10)), 0::bigint, 'and the delete waits while it runs');
select is((public.account_job_done((select id from public.account_jobs where user_id = tests.id('owner') and status = 'running'),
                                   'exports/y.zip')).status::text, 'done', 'the export finishes');
select tests.reset_role();
select cmp_ok((select run_after from public.account_jobs where id = (select id from k where name = 'delete')), '>=',
              now() + interval '7 days', 'its finish pushes the delete back 7 days');

-- A delete with no export runs at once; a suspended account can delete itself.
select tests.act_as('quick');
select is((public.account_delete_request()).run_after, now(), 'with no export, the purge is due at once');
select tests.act_as('susp');
select lives_ok($$select public.account_delete_request()$$, 'a suspended account can delete itself');
select tests.act_as_service();
select is((select array_agg(user_id order by user_id) from public.account_jobs_claim(10)),
          (select array_agg(id order by id) from unnest(array[tests.id('quick'), tests.id('susp')]) id),
          'both deletes are claimed');

-- Failures retry twice, 10 minutes apart, then fail.
select is((public.account_job_fail((select id from public.account_jobs where user_id = tests.id('quick')), 'boom')).status::text,
          'pending', 'a first failure goes back to pending');
select is((select run_after from public.account_jobs where user_id = tests.id('quick')), now() + interval '10 minutes',
          'to run again in 10 minutes');
select tests.reset_role();
update public.account_jobs set attempts = 3, status = 'running' where user_id = tests.id('quick');
select tests.act_as_service();
select is((public.account_job_fail((select id from public.account_jobs where user_id = tests.id('quick')), 'boom')).status::text,
          'failed', 'the third failure is final');

-- The purge: refuses an account that isn't deleted, removes one that is.
select is(public.account_delete_purge(tests.id('reader')), false, 'the purge refuses an active account');
select is(public.account_delete_purge(tests.id('quick')), true, 'and purges a deleted one');
select tests.reset_role();
select is((select count(*) from auth.users where id = tests.id('reader'))
          + (select count(*) from public.profiles where id = tests.id('reader')), 2::bigint, 'reader is untouched');
select is((select count(*) from auth.users where id = tests.id('quick'))
          + (select count(*) from public.profiles where id = tests.id('quick'))
          + (select count(*) from public.account_jobs where user_id = tests.id('quick')), 0::bigint,
          'quick''s auth user, profile and jobs are gone');
-- Owner has jars, a moment with its moderation item, readers and blocks: all cascade.
select tests.act_as_service();
select is(public.account_delete_purge(tests.id('owner')), true, 'owner, with content and relationships, is purged');
select tests.reset_role();
select is((select count(*) from public.jars where user_id = tests.id('owner'))
          + (select count(*) from public.moments where user_id = tests.id('owner'))
          + (select count(*) from public.follows where tests.id('owner') in (reader_id, author_id))
          + (select count(*) from public.blocks where tests.id('owner') in (blocker_id, blocked_id))
          + (select count(*) from public.account_jobs where user_id = tests.id('owner')), 0::bigint,
          'nothing keyed to owner remains');

select * from finish();
rollback;
