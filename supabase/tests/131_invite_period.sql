-- INV-02 (0130, 0131): waiting accounts during the invite period. With no date set nothing changes; while the
-- period runs a new profile waits, can't write or be found, can still edit and delete itself, and the 13+
-- check still holds. The founders let the first n in (first come, first served, waitlist sign-ups by when
-- they joined the waitlist); once the period is over, admit_all_waiting() lets everyone in. Each admitted
-- account gets one `admitted` notification.
begin;
\ir _helpers.psql
select plan(53);

select tests.world();
select tests.create_user('founder', 'moderator');

-- An auth user without a profile: the profile is then inserted as that user, like the app's About you step.
create function tests.auth_only(p_name text) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
          p_name || '@tests.pickld.test', '', now(), '{"provider":"email"}', '{}', now(), now());
  insert into tests.users (name, id) values (p_name, uid);
  return uid;
end $$;

-- Founders are moderators with app_metadata.founder = true.
create function tests.act_as_founder(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', tests.id(p_name), 'role', 'authenticated', 'aud', 'authenticated',
    'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator', 'founder', true))::text, true);
end $$;

create function tests.status(p_name text) returns profile_status language sql stable as $$
  select status from public.profiles where id = tests.id(p_name)
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------- settings and privileges
select ok((select relrowsecurity from pg_class where oid = 'public.app_settings'::regclass), 'RLS is on app_settings');
select ok(not has_table_privilege('authenticated', 'public.app_settings', 'select')
          and not has_table_privilege('authenticated', 'public.app_settings', 'update')
          and not has_table_privilege('anon', 'public.app_settings', 'select'),
          'clients can neither read nor change app_settings');
select ok(has_function_privilege('anon', 'public.invite_period_active()', 'execute')
          and has_function_privilege('authenticated', 'public.invite_period_active()', 'execute'),
          'anyone may ask whether the invite period is on');
select ok(not has_function_privilege('anon', 'public.waiting_position()', 'execute')
          and has_function_privilege('authenticated', 'public.waiting_position()', 'execute'),
          'only signed-in people ask for their place in line');
select ok(not has_function_privilege('anon', 'public.admit_waiting(int)', 'execute'), 'anon cannot let anyone in');
select ok(not has_function_privilege('authenticated', 'public.admit_all_waiting()', 'execute')
          and not has_function_privilege('anon', 'public.admit_all_waiting()', 'execute')
          and has_function_privilege('service_role', 'public.admit_all_waiting()', 'execute'),
          'only the service role lets everyone in');
select ok(not has_function_privilege('authenticated', 'public.admit_profiles(uuid[], uuid, text)', 'execute')
          and not has_function_privilege('service_role', 'public.admit_profiles(uuid[], uuid, text)', 'execute'),
          'the shared admit step is internal');

-- ---------------------------------------------------------------- no date set: nothing changes
select is((select count(*)::int from public.app_settings), 1, 'app_settings has its one row');
select tests.act_as_anon();
select is(public.invite_period_active(), false, 'no date set: no invite period');
select tests.reset_role();
select tests.auth_only('early');
select tests.act_as('early');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_early', 'Early', '2000-02-02')$$,
                'a sign-up with no invite period');
select tests.reset_role();
select is(tests.status('early'), 'active', 'with no invite period a new profile is active');

-- ---------------------------------------------------------------- the period runs
update public.app_settings set invite_period_ends_at = now() + interval '3 months';
select tests.act_as_anon();
select is(public.invite_period_active(), true, 'a future date: the invite period is on');
select tests.reset_role();

select tests.auth_only('waiter1');
select tests.auth_only('waiter2');
select tests.auth_only('waiter3');
select tests.auth_only('leaver');
select tests.auth_only('kid');
-- waiter3 joined the pickld.me waitlist days ago, before making the profile.
insert into public.waitlist (email, user_id, created_at) values ('waiter3@tests.pickld.test', tests.id('waiter3'), now() - interval '5 days');

select tests.act_as('waiter1');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday, status) values (auth.uid(), 't_waiter1', 'Waiter One', '2000-02-02', 'active')$$,
                'a sign-up during the invite period works');
select tests.act_as('waiter2');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_waiter2', 'Waiter Two', '2000-02-02')$$,
                'a second sign-up');
select tests.act_as('waiter3');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_waiter3', 'Waiter Three', '2000-02-02')$$,
                'a waitlist sign-up');
select tests.act_as('leaver');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_leaver', 'Leaver', '2000-02-02')$$,
                'one more sign-up');
select tests.act_as('kid');
select throws_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_kid', 'Kid', current_date - interval '12 years')$$,
                 '23514', null, 'a 12-year-old still cannot sign up');
select tests.reset_role();

select is(tests.status('waiter1'), 'waiting', 'during the period a new profile waits, even if the client asks for active');
select is(array[tests.status('waiter2'), tests.status('waiter3'), tests.status('leaver')],
          array['waiting', 'waiting', 'waiting']::profile_status[], 'every sign-up during the period waits');
select ok((select joined_at is not null from public.waitlist where user_id = tests.id('waiter3')),
          'a waitlist account is marked joined when its profile is made');
select is(tests.status('owner'), 'active', 'existing accounts are untouched');

-- Sign-up order: waiter1, then waiter2 (the waitlist date puts waiter3 first).
update public.profiles set created_at = now() - interval '3 hours' where id = tests.id('waiter1');
update public.profiles set created_at = now() - interval '2 hours' where id = tests.id('waiter2');
update public.profiles set created_at = now() - interval '1 hour' where id in (tests.id('waiter3'), tests.id('leaver'));
select tests.make_jar('waiter1', 'everyone', published => false, p_days_ago => 1);
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values
  ('owner_jar', tests.make_jar('owner', 'everyone', published => true)),
  ('waiter_jar', (select id from public.jars where user_id = tests.id('waiter1')));
insert into t values ('m_live', tests.make_moment((select id from t where k = 'owner_jar'), 'morning', 'live'));

-- ---------------------------------------------------------------- a waiting account can't write
select tests.act_as('waiter1');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date, 'Asia/Manila')$$,
                 '42501', null, 'a waiting account cannot create a jar');
select throws_ok($$insert into public.moments (jar_id, user_id, slot, status) values ((select id from t where k = 'waiter_jar'), auth.uid(), 'selfie', 'checking')$$,
                 '42501', null, 'a waiting account cannot add a moment');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'owner_jar'), auth.uid(), 'hi')$$,
                 '42501', null, 'a waiting account cannot comment');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_live'))$$,
                 '42501', null, 'a waiting account cannot like');
select throws_ok(format('insert into public.follows (reader_id, author_id) values (auth.uid(), %L)', tests.id('owner')),
                 '42501', null, 'a waiting account cannot follow');
select lives_ok($$update public.profiles set bio = 'hello' where id = auth.uid()$$, 'a waiting account can edit its profile');
select is(public.waiting_position(), 2, 'waiter1 is second in line, after the earlier waitlist sign-up');
select tests.act_as('waiter3');
select is(public.waiting_position(), 1, 'a waitlist sign-up counts from when it joined the waitlist');
select tests.act_as('waiter2');
select is(public.waiting_position(), 3, 'waiter2 is third');
select tests.act_as('owner');
select is(public.waiting_position(), null, 'an active account is not in line');

-- ---------------------------------------------------------------- and nobody finds it
select tests.act_as('reader');
select throws_ok(format('insert into public.follows (reader_id, author_id) values (auth.uid(), %L)', tests.id('waiter1')),
                 '42501', null, 'nobody can follow a waiting account');
select is((select count(*)::int from public.search_people('waiter')), 0, 'search skips waiting accounts');
select is((select count(*)::int from public.profiles where id = tests.id('waiter1')), 0, 'others cannot read a waiting profile');

-- ---------------------------------------------------------------- it can leave
select tests.act_as('leaver');
select lives_ok($$select public.account_delete_request()$$, 'a waiting account can delete itself');
select tests.reset_role();
select is(tests.status('leaver'), 'deleted', 'and is deleted');

-- ---------------------------------------------------------------- the founders let people in
select tests.act_as('outsider');
select throws_ok($$select public.admit_waiting(1)$$, '42501', null, 'a member cannot let anyone in');
select tests.act_as('founder');
select throws_ok($$select public.admit_waiting(1)$$, '42501', null, 'a moderator who is not a founder cannot let anyone in');
select tests.act_as_founder('founder');
select throws_ok($$select public.admit_waiting(0)$$, '22023', null, 'at least one at a time');
select is(public.admit_waiting(2), 2, 'a founder lets the first two in');
select tests.reset_role();
select is(array[tests.status('waiter3'), tests.status('waiter1'), tests.status('waiter2')],
          array['active', 'active', 'waiting']::profile_status[], 'first come, first served');
select is((select array_agg(user_id order by user_id) from public.notifications where type = 'admitted'),
          (select array_agg(id order by id) from (values (tests.id('waiter1')), (tests.id('waiter3'))) v(id)),
          'each admitted account gets one admitted notification, nobody else');
select ok((select admitted_at is not null from public.waitlist where user_id = tests.id('waiter3')),
          'the waitlist row is marked admitted');
select is((select count(*)::int from public.audit_log where action = 'admit' and actor_id = tests.id('founder')), 2,
          'each admission is in the audit log under the founder');
select tests.act_as('waiter1');
select lives_ok(format('insert into public.follows (reader_id, author_id) values (auth.uid(), %L)', tests.id('owner')),
                'once let in, the account can follow');
select tests.act_as('waiter2');
select is(public.waiting_position(), 1, 'the next in line moves up');

-- ---------------------------------------------------------------- the period ends
select tests.act_as_service();
select is(public.admit_all_waiting(), 0, 'while the period runs, nobody is let in automatically');
select tests.reset_role();
update public.app_settings set invite_period_ends_at = now() - interval '1 minute';
select tests.act_as_service();
select is(public.admit_all_waiting(), 1, 'when the period is over, everyone still waiting is let in');
select tests.reset_role();
select is(tests.status('waiter2'), 'active', 'the last waiting account is active');
select is(tests.status('leaver'), 'deleted', 'a deleted account stays deleted');
select is((select count(*)::int from public.notifications where type = 'admitted' and user_id = tests.id('waiter2')), 1,
          'with its admitted notification');

select tests.auth_only('late');
select tests.act_as('late');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_late', 'Late', '2000-02-02')$$,
                'a sign-up after the period');
select tests.reset_role();
select is(tests.status('late'), 'active', 'after the period a new profile is active');

select * from finish();
rollback;
