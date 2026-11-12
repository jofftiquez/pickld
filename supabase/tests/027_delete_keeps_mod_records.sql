-- D-36 (0027): an account with moderation records (a decided moderation item, or an audit log entry) can't
-- delete itself; nothing changes when it tries. Everyone else still can.
begin;
\ir _helpers.psql
select plan(8);

select tests.world();
select tests.create_user('mod', 'moderator');
select tests.create_user('auditor');

create temp table k (name text primary key, id uuid);
grant select on k to anon, authenticated, service_role;
insert into k select 'jar', tests.make_jar('owner', 'everyone', published => true);
insert into k select 'moment', tests.make_moment((select id from k where name = 'jar'), 'morning', 'live');
insert into public.moderation_items (moment_id, source, status, decided_by, decided_at)
values ((select id from k where name = 'moment'), 'report', 'kept', tests.id('mod'), now());
insert into public.audit_log (actor_id, action) values (tests.id('auditor'), 'test');

select tests.act_as('mod');
select throws_ok($$select public.account_delete_request()$$, '42501', null, 'a moderator who decided an item is refused');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('mod')), 'active', 'and stays active');
select is((select count(*) from public.account_jobs where user_id = tests.id('mod')), 0::bigint, 'with no delete job');

select tests.act_as('auditor');
select throws_ok($$select public.account_delete_request()$$, '42501', null, 'someone in the audit log is refused');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('auditor')), 'active', 'and stays active');

select tests.act_as('outsider');
select lives_ok($$select public.account_delete_request()$$, 'an ordinary account can still delete itself');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('outsider')), 'deleted', 'and is deleted');
select is((select count(*) from public.moderation_items where decided_by = tests.id('mod')), 1::bigint,
          'the moderator''s decision is kept');

select * from finish();
rollback;
