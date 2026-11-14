-- 0090: the console dashboard (FR-MOD-06 Overview, FR-MOD-07 Users, D-132). Only moderators can read the
-- Overview, search users, open a user or list their moments, or suspend and lift; owner, reader, outsider,
-- blocked and anon are refused. Counts are compared with a snapshot taken first, so rows already in the
-- database don't matter. Suspend and lift: notes required, own account refused, audited, child-safety
-- suspensions stay, an overturned appeal doesn't end a manual suspension, and the expiry job still does.
begin;
\ir _helpers.psql
select plan(75);

-- The Overview before this test adds anything (claims set by hand: no test user exists yet).
select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(),
                  'app_metadata', jsonb_build_object('role', 'moderator'))::text, true);
create temp table snap as select public.mod_overview() as o;
select tests.reset_role();
grant select on snap to authenticated, anon, service_role;

select tests.world();
select tests.create_user('mod2', 'moderator');
select tests.create_user('newbie');
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'everyone', published => true));
insert into t values ('live', tests.make_moment((select id from t where k = 'jar'), 'morning', 'live'));
insert into t values ('private', tests.make_moment((select id from t where k = 'jar'), 'evening', 'live', p_visibility => 'only_me'));
insert into t values ('flagged', tests.make_moment((select id from t where k = 'jar'), 'afternoon', 'checking', p_visibility => 'only_me'));
insert into t values ('gone', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'removed'));
insert into t values ('stuck', tests.make_moment((select id from t where k = 'jar'), 'ootd', 'checking'));
-- added_at is server-stamped and frozen (moments_bu); turn that off for one backdated row.
alter table public.moments disable trigger moments_bu;
update public.moments set added_at = now() - interval '1 hour' where id = (select id from t where k = 'stuck');
alter table public.moments enable trigger moments_bu;
-- Just after Manila midnight that hour is yesterday, so it only counts toward "moments today" after 01:00.
create temp table stuck_today as
  select (added_at >= public.mod_day_start())::int as n from public.moments where id = (select id from t where k = 'stuck');
grant select on stuck_today to authenticated, anon, service_role;

-- A private moment queued 3 hours ago, an automatic removal, and two reports on the live moment.
insert into public.moderation_items (moment_id, source, scores, decision_reason, created_at)
values ((select id from t where k = 'flagged'), 'auto_check', '{}', 'violence', now() - interval '3 hours');
with x as (
  insert into public.moderation_items (moment_id, source, status, decided_at, decision_reason)
  values ((select id from t where k = 'gone'), 'auto_check', 'removed', now(), 'violence') returning id)
insert into t select 'i_gone', id from x;
insert into public.reports (reporter_id, target, target_id, reason, note)
values (tests.id('reader'), 'moment', (select id from t where k = 'live'), 'spam', 'Selling followers'),
       (tests.id('outsider'), 'moment', (select id from t where k = 'live'), 'spam', null);

create function pg_temp.delta(p_path text[]) returns int language sql as $$
  select ((public.mod_overview() #>> p_path)::int - ((select o from snap) #>> p_path)::int)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- who can call them
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_suspend'),
          'pickld_moderation/true', 'mod_suspend is security definer, owned by pickld_moderation');
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_lift_suspension'),
          'pickld_moderation/true', 'mod_lift_suspension is security definer, owned by pickld_moderation');
select ok(not has_schema_privilege('pickld_moderation', 'public', 'create'), 'pickld_moderation still cannot create objects');
select ok(not has_function_privilege('authenticated', 'public.mod_manual_suspension(uuid)', 'execute'),
          'clients cannot call the suspension helper');

select tests.act_as_anon();
select throws_ok($$select public.mod_overview()$$, '42501', null, 'anon cannot read the Overview');
select throws_ok($$select * from public.mod_user_search('t_')$$, '42501', null, 'anon cannot search users');
select throws_ok($$select public.mod_user(tests.id('owner'))$$, '42501', null, 'anon cannot open a user');
select throws_ok($$select public.mod_suspend(tests.id('owner'), 'x')$$, '42501', null, 'anon cannot suspend');
select tests.act_as('owner');
select throws_ok($$select public.mod_overview()$$, '42501', 'moderators only', 'the owner cannot read the Overview');
select throws_ok($$select * from public.mod_user_search('t_')$$, '42501', 'moderators only', 'the owner cannot search users');
select throws_ok($$select public.mod_user(tests.id('owner'))$$, '42501', 'moderators only', 'the owner cannot open their own record');
select throws_ok($$select * from public.mod_user_moments(tests.id('owner'))$$, '42501', 'moderators only',
                 'the owner cannot list moments here');
select throws_ok($$select public.mod_suspend(tests.id('reader'), 'x')$$, '42501', 'moderators only', 'the owner cannot suspend');
select throws_ok($$select public.mod_lift_suspension(tests.id('owner'), 'x')$$, '42501', 'moderators only',
                 'the owner cannot lift a suspension');
select tests.act_as('reader');
select throws_ok($$select public.mod_overview()$$, '42501', 'moderators only', 'a reader cannot read the Overview');
select throws_ok($$select public.mod_user(tests.id('owner'))$$, '42501', 'moderators only', 'a reader cannot open a user');
select tests.act_as('outsider');
select throws_ok($$select * from public.mod_user_search('t_')$$, '42501', 'moderators only', 'an outsider cannot search users');
select throws_ok($$select public.mod_suspend(tests.id('owner'), 'x')$$, '42501', 'moderators only', 'an outsider cannot suspend');
select tests.act_as('blocked');
select throws_ok($$select * from public.mod_user_moments(tests.id('owner'))$$, '42501', 'moderators only',
                 'a blocked user cannot list moments');
select throws_ok($$select public.mod_lift_suspension(tests.id('owner'), 'x')$$, '42501', 'moderators only',
                 'a blocked user cannot lift a suspension');

-- ---------------------------------------------------------------- Overview
select tests.act_as('moderator');
select is(pg_temp.delta('{queue,open}'), 2, 'queue: the queued private moment and the reported moment');
select is(pg_temp.delta('{queue,over_two_hours}'), 1, 'queue: it has waited over 2 hours');
select ok((public.mod_overview() #>> '{queue,oldest_seconds}')::int >= 3 * 3600 - 60, 'queue: the oldest wait is at least 3 hours');
select is(pg_temp.delta('{today,reports}'), 2, 'today: two reports');
select is(pg_temp.delta('{today,removed_auto}'), 1, 'today: one automatic removal');
select is(pg_temp.delta('{people,signups_today}'), 8, 'people: eight sign-ups today');
select is(pg_temp.delta('{people,moments_today}'), 4 + (select n from stuck_today),
          'people: five moments today (four in the first hour of a Manila day)');
select is(pg_temp.delta('{people,posted_today}'), 1, 'people: one person posted today');
select is(pg_temp.delta('{stuck_uploads}'), 1, 'stuck: Checking for an hour with nothing queued (the queued one is not stuck)');

-- ---------------------------------------------------------------- search
select is((select id from public.mod_user_search((select username::text from public.profiles where id = tests.id('owner'))) limit 1),
          tests.id('owner'), 'an exact username comes first');
select is((select id from public.mod_user_search('@' || (select username::text from public.profiles where id = tests.id('owner'))) limit 1),
          tests.id('owner'), 'a leading @ is ignored');
select is((select array_agg(id) from public.mod_user_search('owner@tests.pickld.test')), array[tests.id('owner')],
          'an exact email finds the account');
select is((select count(*)::int from public.mod_user_search('owner@tests')), 0, 'part of an email finds nothing');
select is((select array_agg(id) from public.mod_user_search(tests.id('newbie')::text)), array[tests.id('newbie')],
          'a user id finds the account');
select ok(exists (select 1 from public.mod_user_search('NEWBI') where id = tests.id('newbie')),
          'part of a name matches, ignoring case');
select is((select count(*)::int from public.mod_user_search('%%')), 0, '% is a literal character, not a wildcard');
select is((select strikes || '/' || open_reports || '/' || moment_count from public.mod_user_search('owner@tests.pickld.test')),
          '1/2/5', 'a row carries strikes, open reports and the moment count');
select throws_ok($$select * from public.mod_user_search(repeat('a', 255))$$, '22023', null, 'a query over 254 characters is refused');

-- ---------------------------------------------------------------- one user
select is(public.mod_user(gen_random_uuid()), null, 'an unknown id gives null');
select is(public.mod_user(tests.id('owner')) #>> '{profile,email}', 'owner@tests.pickld.test', 'the email comes with the profile');
select is(public.mod_user(tests.id('owner')) -> 'moments', '{"total":5,"live":2,"checking":2,"removed":1}'::jsonb,
          'moment counts include private ones');
select is((public.mod_user(tests.id('owner')) #>> '{strikes,count}')::int, 1, 'one strike');
select is(public.mod_user(tests.id('owner')) #>> '{strikes,items,0,guideline}', 'violence', 'the strike names its guideline');
select is(jsonb_array_length(public.mod_user(tests.id('owner')) -> 'reports_against'), 2, 'the reports against them');
select ok(public.mod_user(tests.id('reader')) #>> '{reports_filed,total}' = '1', 'the reports they filed');
select is(public.mod_user(tests.id('owner')) ->> 'can_suspend', 'true', 'an active account can be suspended');
select is(public.mod_user(tests.id('moderator')) ->> 'can_suspend', 'false', 'a moderator cannot suspend themselves');

-- ---------------------------------------------------------------- their moments
select is((select count(*)::int from public.mod_user_moments(tests.id('owner')) where id = (select id from t where k = 'private')), 0,
          'a private moment that was never queued stays out (rule 9)');
select is((select moderation from public.mod_user_moments(tests.id('owner')) where id = (select id from t where k = 'flagged')),
          'pending', 'a queued private moment shows, with its queue status');
select is((select count(*)::int from public.mod_user_moments(tests.id('owner'))), 4, 'every other moment shows');

-- ---------------------------------------------------------------- suspend
select throws_ok($$select public.mod_suspend(tests.id('owner'), '  ')$$, '22023', null, 'suspending needs a note');
select throws_ok($$select public.mod_suspend(tests.id('owner'), repeat('a', 501))$$, '22023', null, 'a note is at most 500 characters');
select is(public.mod_suspend(tests.id('moderator'), 'test') ->> 'result', 'own_account', 'nobody suspends their own account');
select is(public.mod_suspend(gen_random_uuid(), 'test') ->> 'result', 'not_found', 'an unknown id is not found');
select is(public.mod_suspend(tests.id('owner'), 'Spam wave') ->> 'result', 'suspended', 'a moderator suspends an active account');
select is(public.mod_suspend(tests.id('owner'), 'Again') ->> 'result', 'not_active', 'a suspended account is not suspended twice');
select tests.reset_role();
select ok((select status = 'suspended' and suspended_until between now() + interval '7 days' - interval '1 minute'
                  and now() + interval '7 days' from public.profiles where id = tests.id('owner')),
          'suspended for 7 days');
select is((select data - 'until' from public.audit_log where action = 'suspend' and target_id = tests.id('owner')
           and actor_id = tests.id('moderator')),
          '{"manual":true,"note":"Spam wave"}'::jsonb, 'the audit row says who, that it was manual, and the note');
select tests.act_as('moderator');
select is((public.mod_user(tests.id('owner')) -> 'suspension') - 'until',
          jsonb_build_object('kind', 'manual', 'note', 'Spam wave',
                             'by', (select username from public.profiles where id = tests.id('moderator'))),
          'the user page shows a manual suspension, by whom and why');
select is(pg_temp.delta('{suspended,total}'), 1, 'Overview: one more account suspended');

-- ---------------------------------------------------------------- an appeal doesn't end it
select tests.reset_role();
insert into public.appeals (moderation_item_id, user_id, message)
values ((select id from t where k = 'i_gone'), tests.id('owner'), 'Not violent.');
select tests.act_as('mod2');
select is(public.mod_decide((select id from public.moderation_items
                             where appeal_id = (select id from public.appeals where moderation_item_id = (select id from t where k = 'i_gone'))),
                            'keep') ->> 'result',
          'overturned', 'the appeal is overturned');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('owner')), 'suspended',
          'a manual suspension outlasts an overturned appeal');
select is((select count(*)::int from public.audit_log where action = 'lift_suspension' and target_id = tests.id('owner')), 0,
          'and no lift is recorded');

-- ---------------------------------------------------------------- lift
select tests.act_as('mod2');
select throws_ok($$select public.mod_lift_suspension(tests.id('owner'), '')$$, '22023', null, 'lifting needs a note');
select is(public.mod_lift_suspension(tests.id('mod2'), 'x') ->> 'result', 'own_account', 'nobody lifts their own account');
select is(public.mod_lift_suspension(tests.id('owner'), 'Spoke with them') ->> 'result', 'lifted', 'a moderator lifts it early');
select is(public.mod_lift_suspension(tests.id('owner'), 'x') ->> 'result', 'not_suspended', 'an active account has nothing to lift');
select tests.reset_role();
select ok((select status = 'active' and suspended_until is null from public.profiles where id = tests.id('owner')),
          'the account is active again');
select is((select data from public.audit_log where action = 'lift_suspension' and target_id = tests.id('owner')
           and actor_id = tests.id('mod2')),
          '{"reason":"moderator","note":"Spoke with them"}'::jsonb, 'the lift is audited with its note');

-- A child-safety suspension (no end date) stays; a strike suspension can be lifted.
update public.profiles set status = 'suspended', suspended_until = null where id = tests.id('newbie');
update public.profiles set status = 'suspended', suspended_until = now() + interval '3 days' where id = tests.id('outsider');
select tests.act_as('moderator');
select is(public.mod_user(tests.id('owner')) -> 'can_lift', 'false'::jsonb,
          'an active account has nothing to lift (false, not null)');
select is(public.mod_lift_suspension(tests.id('newbie'), 'x') ->> 'result', 'child_safety',
          'a child-safety suspension cannot be lifted here');
select is(public.mod_user(tests.id('newbie')) #>> '{suspension,kind}' || '/' || (public.mod_user(tests.id('newbie')) ->> 'can_lift'),
          'child_safety/false', 'the user page marks it child safety, with no lift');
select is(public.mod_user(tests.id('outsider')) #>> '{suspension,kind}' || '/' || (public.mod_user(tests.id('outsider')) ->> 'can_lift'),
          'strikes/true', 'a strike suspension can be lifted');

-- The expiry job still ends a manual suspension once its 7 days are up.
select public.mod_suspend(tests.id('reader'), 'Expiry check');
select tests.reset_role();
update public.profiles set suspended_until = now() - interval '1 minute' where id = tests.id('reader');
select tests.act_as_service();
select ok(public.moderation_lift_suspensions() >= 1, 'the expiry job runs');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('reader')), 'active',
          'an expired manual suspension ends');

select * from finish();
rollback;
