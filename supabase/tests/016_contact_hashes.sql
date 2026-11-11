-- 0015 (M3-05; FR-ONB-06, FR-SOC-02; D-4): contact_hashes and contact_match_calls are server-only;
-- anon and signed-in users can't read or write them or call their functions. contacts_match_find never
-- returns the caller, blocked users (either way) or inactive users. contact_match_take allows 10 calls
-- an hour. contact_hashes_pending finds users whose hash is missing or stale.
begin;
\ir _helpers.psql
select plan(32);

select tests.world();
select tests.create_user('suspended');
select tests.create_user('gone');

-- A fake keyed hash per test user (the real ones are HMACs computed in the Edge Function).
create function pg_temp.h(p_name text) returns text language sql immutable as $$
  select md5(p_name) || md5(p_name || '#')
$$;
create function pg_temp.names(p_caller text) returns text[] language sql as $$
  select coalesce(array_agg(u.name order by u.name), '{}')
  from public.contacts_match_find(tests.id(p_caller), (select array_agg(pg_temp.h(name)) from tests.users)) m
  join tests.users u on u.id = m.id
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---------------------------------------------------------------- no client access
select ok((select relrowsecurity from pg_class where oid = 'public.contact_hashes'::regclass)
          and (select relrowsecurity from pg_class where oid = 'public.contact_match_calls'::regclass),
          'RLS is enabled on both tables');
select ok(not has_table_privilege('anon', 'public.contact_hashes', 'select,insert,update,delete')
          and not has_table_privilege('anon', 'public.contact_match_calls', 'select,insert,update,delete'),
          'anon has no privileges on the tables');
select ok(not has_table_privilege('authenticated', 'public.contact_hashes', 'select,insert,update,delete')
          and not has_table_privilege('authenticated', 'public.contact_match_calls', 'select,insert,update,delete'),
          'authenticated has no privileges on the tables');
select ok(has_table_privilege('service_role', 'public.contact_hashes', 'select,insert,update,delete'),
          'the service role (the Edge Function) may use contact_hashes');
select ok(not has_function_privilege('anon', 'public.contact_match_take(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.contact_hashes_pending(int)', 'execute')
          and not has_function_privilege('anon', 'public.contact_hashes_save(uuid[], text[])', 'execute')
          and not has_function_privilege('anon', 'public.contacts_match_find(uuid, text[])', 'execute'),
          'anon may not call the contact functions');
select ok(not has_function_privilege('authenticated', 'public.contact_match_take(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.contact_hashes_pending(int)', 'execute')
          and not has_function_privilege('authenticated', 'public.contact_hashes_save(uuid[], text[])', 'execute')
          and not has_function_privilege('authenticated', 'public.contacts_match_find(uuid, text[])', 'execute'),
          'authenticated may not call the contact functions');

select tests.act_as_service();
select is(public.contact_hashes_save((select array_agg(id order by name) from tests.users),
                                     (select array_agg(pg_temp.h(name) order by name) from tests.users)),
          8, 'the service role saves one hash per user');
select tests.reset_role();

select tests.act_as('outsider');
select throws_ok($$select count(*) from public.contact_hashes$$, '42501', null, 'a signed-in user cannot read contact_hashes');
select throws_ok($$insert into public.contact_hashes (user_id, email_hash) values (auth.uid(), md5('a') || md5('b'))$$,
                 '42501', null, 'a signed-in user cannot write contact_hashes');
select throws_ok($$update public.contact_hashes set email_hash = md5('a') || md5('b')$$, '42501', null,
                 'a signed-in user cannot update contact_hashes');
select throws_ok($$delete from public.contact_hashes$$, '42501', null, 'a signed-in user cannot delete contact_hashes');
select throws_ok($$select count(*) from public.contact_match_calls$$, '42501', null,
                 'a signed-in user cannot read contact_match_calls');
select throws_ok($$insert into public.contact_match_calls (user_id) values (auth.uid())$$, '42501', null,
                 'a signed-in user cannot write contact_match_calls');
select throws_ok($$select * from public.contacts_match_find(auth.uid(), array[md5('a') || md5('b')])$$, '42501', null,
                 'a signed-in user cannot call contacts_match_find');
select throws_ok($$select * from public.contact_hashes_pending()$$, '42501', null,
                 'a signed-in user cannot read sign-up emails through contact_hashes_pending');
select throws_ok($$select public.contact_match_take(auth.uid())$$, '42501', null,
                 'a signed-in user cannot call contact_match_take');

select tests.act_as_anon();
select throws_ok($$select count(*) from public.contact_hashes$$, '42501', null, 'anon cannot read contact_hashes');
select throws_ok($$insert into public.contact_hashes (user_id, email_hash) values (gen_random_uuid(), md5('a') || md5('b'))$$,
                 '42501', null, 'anon cannot write contact_hashes');
select throws_ok($$select count(*) from public.contact_match_calls$$, '42501', null, 'anon cannot read contact_match_calls');
select tests.reset_role();

-- ---------------------------------------------------------------- matching
update public.profiles set status = 'suspended' where id = tests.id('suspended');
update public.profiles set status = 'deleted' where id = tests.id('gone');
select tests.act_as_service();
select is(pg_temp.names('outsider'), array['blocked', 'blocker', 'moderator', 'owner', 'reader'],
          'everyone matching except the caller and inactive users');
select is(pg_temp.names('owner'), array['moderator', 'outsider', 'reader'],
          'blocked users are never returned, in either direction');
select is(pg_temp.names('blocked'), array['blocker', 'moderator', 'outsider', 'reader'],
          'the blocked user never sees the user who blocked them');
select is((select array_agg(is_following) from public.contacts_match_find(tests.id('reader'), array[pg_temp.h('owner')])),
          array[true], 'is_following is true for authors the caller reads');
select is((select array_agg(is_following) from public.contacts_match_find(tests.id('owner'), array[pg_temp.h('reader')])),
          array[false], 'is_following is false otherwise');
select is((select count(*)::int from public.contacts_match_find(tests.id('owner'), array[md5('x') || md5('y')])), 0,
          'hashes that match nobody (phone hashes) return nothing');

-- ---------------------------------------------------------------- pending (backfill)
select is((select count(*)::int from public.contact_hashes_pending(1000) where user_id in (select id from tests.users)), 0,
          'nothing pending once every user has a hash');
select tests.reset_role();
update auth.users set updated_at = now() + interval '1 minute' where id = tests.id('reader');
delete from public.contact_hashes where user_id = tests.id('outsider');
select tests.act_as_service();
select is((select array_agg(u.name order by u.name) from public.contact_hashes_pending(1000) p join tests.users u on u.id = p.user_id),
          array['outsider', 'reader'], 'pending: users without a hash and users whose auth record changed');
select is((select email from public.contact_hashes_pending(1000) where user_id = tests.id('outsider')),
          'outsider@tests.pickld.test', 'pending returns the sign-up email for the function to hash');
select tests.reset_role();

-- ---------------------------------------------------------------- rate limit
select tests.act_as_service();
select is((select array_agg(public.contact_match_take(tests.id('reader'))) from generate_series(1, 10)),
          array_fill('ok'::text, array[10]), 'ten calls an hour are allowed');
select is(public.contact_match_take(tests.id('reader')), 'limited', 'the eleventh call within the hour is limited');
select tests.reset_role();
update public.contact_match_calls set called_at = now() - interval '61 minutes' where user_id = tests.id('reader');
select tests.act_as_service();
select is(public.contact_match_take(tests.id('reader')), 'ok', 'calls older than an hour no longer count');
select is(public.contact_match_take(tests.id('suspended')), 'inactive', 'inactive users cannot match contacts');
select tests.reset_role();

select * from finish();
rollback;
