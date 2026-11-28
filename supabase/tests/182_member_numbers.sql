-- 0182: member numbers. An account gets the next number when it is let in (at sign-up with no invite period,
-- on admission during it), a batch in queue order. Failed sign-ups give their number back, deleted accounts
-- keep theirs retired, clients can't choose or change one, and #1 to #100 are handed out by SQL. Others and
-- pickld.me see the number unless the owner hides it; the owner always sees it.
begin;
\ir _helpers.psql
select plan(33);

select tests.world();

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

-- The About you insert, as that user.
create function tests.sign_up(p_name text, p_member_number int default null) returns void language plpgsql as $$
begin
  perform tests.auth_only(p_name);
  perform tests.act_as(p_name);
  insert into public.profiles (id, username, display_name, birthday, member_number)
  values (auth.uid(), 't_' || p_name, initcap(p_name), date '2000-02-02', p_member_number);
  perform tests.reset_role();
end $$;

create function tests.n(p_name text) returns int language sql stable security definer as $$
  select member_number from public.profiles where id = tests.id(p_name)
$$;
create function tests.last_number() returns int language sql stable security definer as $$
  select last_number from public.member_number_counter
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------- privileges
select ok(not has_column_privilege('authenticated', 'public.profiles', 'member_number', 'select')
          and not has_column_privilege('authenticated', 'public.profiles', 'hide_member_number', 'select')
          and has_column_privilege('authenticated', 'public.profiles', 'public_member_number', 'select'),
          'others read only the public number, not the raw one or the hide switch');
select ok(not has_table_privilege('authenticated', 'public.member_number_counter', 'select')
          and not has_table_privilege('authenticated', 'public.member_number_counter', 'update')
          and not has_table_privilege('anon', 'public.member_number_counter', 'select'),
          'clients can neither read nor move the counter');
select ok(not has_function_privilege('authenticated', 'public.next_member_number()', 'execute')
          and not has_function_privilege('service_role', 'public.next_member_number()', 'execute'),
          'nobody draws a number by hand');
select ok(not has_function_privilege('authenticated', 'public.give_member_number(text, int)', 'execute')
          and not has_function_privilege('anon', 'public.give_member_number(text, int)', 'execute')
          and not has_function_privilege('service_role', 'public.give_member_number(text, int)', 'execute'),
          'only SQL hands out #1 to #100');
select ok(not exists (select 1 from public.profiles where status <> 'waiting' and member_number is null),
          'every account already let in has a number');
select ok(tests.last_number() >= (select coalesce(max(member_number), 1) from public.profiles),
          'the counter is past every number given out');

-- ---------------------------------------------------------------- sign-ups with no invite period
select tests.reset_role();
update public.app_settings set invite_period_ends_at = null;
create temp table t (k text primary key, v int);
grant select on t to authenticated, anon, service_role;
insert into t values ('start', tests.last_number());

select tests.sign_up('first', 1);
select is(tests.n('first'), (select v from t where k = 'start') + 1,
          'a sign-up gets the next number, whatever number the client sends');
select ok(tests.n('first') > 100, 'sign-ups never get #1 to #100 on their own');

-- A failed sign-up gives its number back.
select tests.auth_only('kid');
select tests.act_as('kid');
select throws_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_kid', 'Kid', current_date - interval '12 years')$$,
                 '23514', null, 'a 12-year-old cannot sign up');
select tests.reset_role();
select tests.auth_only('dupe');
select tests.act_as('dupe');
select throws_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_first', 'Dupe', '2000-02-02')$$,
                 '23505', null, 'a taken username cannot sign up');
select tests.reset_role();
select tests.sign_up('second');
select is(tests.n('second'), tests.n('first') + 1, 'failed sign-ups leave no gap');

-- ---------------------------------------------------------------- the number is the server's
select tests.act_as('second');
select throws_ok($$update public.profiles set member_number = 2 where id = auth.uid()$$,
                 '42501', null, 'the owner cannot change their number');
select tests.reset_role();

-- ---------------------------------------------------------------- who sees it
select tests.act_as('reader');
select is((select public_member_number from public.profiles where id = tests.id('second')), tests.n('second'),
          'others see the number');
select tests.act_as_anon();
select is((public.public_profile('t_second') -> 'profile' ->> 'member_number')::int, tests.n('second'),
          'pickld.me shows the number');
select tests.act_as('second');
select lives_ok($$update public.profiles set hide_member_number = true where id = auth.uid()$$,
                'the owner can hide their number');
select is((select member_number from public.my_profile()), tests.n('second'), 'the owner still sees it');
select tests.act_as('reader');
select is((select public_member_number from public.profiles where id = tests.id('second')), null,
          'others no longer see a hidden number');
select tests.act_as_anon();
select ok((public.public_profile('t_second') -> 'profile') ? 'member_number'
          and public.public_profile('t_second') -> 'profile' -> 'member_number' = 'null'::jsonb,
          'pickld.me no longer shows a hidden number');
select tests.reset_role();

-- ---------------------------------------------------------------- during the invite period: on admission
update public.app_settings set invite_period_ends_at = now() + interval '7 days';
select tests.sign_up('w1');
select tests.sign_up('w2');
select tests.sign_up('w3');
select tests.sign_up('w4');
select tests.sign_up('waiter_c');
select is(array[tests.n('w1'), tests.n('w4'), tests.n('waiter_c')], array[null, null, null]::int[],
          'a waiting account has no number yet');
-- The queue runs opposite to sign-up order: w4 joined the waitlist first, then w3, w2, w1; waiter_c is last.
insert into public.waitlist (email, source, user_id, created_at)
select name || '@tests.pickld.test', 'web', id, now() - interval '1 day' * right(name, 1)::int
from tests.users where name in ('w1', 'w2', 'w3', 'w4');
select tests.create_user('founder', 'moderator');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', tests.id('founder'), 'role', 'authenticated', 'aud', 'authenticated',
  'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator', 'founder', true))::text, true);
select is(public.admit_waiting(4), 4, 'a founder lets four in');
select tests.reset_role();
-- The founder's own account came in as active above; the batch follows it.
select is(array[tests.n('w4'), tests.n('w3'), tests.n('w2'), tests.n('w1')],
          array[tests.n('founder') + 1, tests.n('founder') + 2, tests.n('founder') + 3, tests.n('founder') + 4],
          'a batch is numbered in queue order, not sign-up order');
select is(tests.n('waiter_c'), null, 'the one still waiting has none');
update public.app_settings set invite_period_ends_at = now() - interval '1 minute';
select tests.act_as_service();
select ok(public.admit_all_waiting() >= 1, 'the period ends and everyone comes in');
select tests.reset_role();
select is(tests.n('waiter_c'), tests.n('w1') + 1, 'and gets the next number');

-- ---------------------------------------------------------------- numbers stay put
insert into t values ('before_suspend', tests.n('first'));
update public.profiles set status = 'suspended' where id = tests.id('first');
update public.profiles set status = 'active' where id = tests.id('first');
select is(tests.n('first'), (select v from t where k = 'before_suspend'), 'a suspension and return keeps the number');

insert into t values ('deleted', tests.n('waiter_c'));
delete from auth.users where id = tests.id('waiter_c');
update public.app_settings set invite_period_ends_at = null;
select tests.sign_up('after_delete');
select is(tests.n('after_delete'), (select v from t where k = 'deleted') + 1, 'a deleted account''s number is never reused');

-- ---------------------------------------------------------------- #1 to #100
-- Two free numbers from 1 to 100 in this database (any already handed out are skipped).
insert into t select 'free1', min(n) from generate_series(1, 100) n
  where not exists (select 1 from public.profiles where member_number = n);
insert into t select 'free2', min(n) from generate_series(1, 100) n
  where n > (select v from t where k = 'free1') and not exists (select 1 from public.profiles where member_number = n);
insert into t values ('newest', tests.n('after_delete'));
select is(public.give_member_number('t_after_delete', (select v from t where k = 'free1')), (select v from t where k = 'free1'),
          'a founder hands out a number from 1 to 100');
select is(tests.n('after_delete'), (select v from t where k = 'free1'), 'the account holds it');
select throws_ok(format('select public.give_member_number(%L, %s)', 't_second', (select v from t where k = 'free1')),
                 '23505', null, 'a number already held cannot be handed out again');
select throws_ok($$select public.give_member_number('t_second', 101)$$, '22023', null, 'only 1 to 100 are handed out');
select tests.sign_up('next');
select is(tests.n('next'), (select v from t where k = 'newest'),
          'the account''s old number was the newest, so it is not skipped');
select lives_ok(format('select public.give_member_number(%L, %s)', 't_second', (select v from t where k = 'free2')),
                'an older account moves onto a reserved number');
select tests.sign_up('later');
select is(tests.n('later'), tests.n('next') + 1, 'an older account''s old number stays retired');

select * from finish();
rollback;
