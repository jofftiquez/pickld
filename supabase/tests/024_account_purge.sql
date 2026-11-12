-- 0023 (M4-03; FR-ACC-04, G-20): account_purge() is service-role only. It deletes a profile-less auth user
-- and every auth row naming them (refresh tokens, flow state, audit entries), and refuses, touching
-- nothing, when the user has a profile, so it can never delete an established account.
begin;
\ir _helpers.psql
select plan(12);

select tests.world();

-- A sign-up with no profile yet (the Under 13 state), with the auth rows a sign-in leaves.
create function pg_temp.signup(p_email text) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email, '', now(),
          '{"provider":"email"}', '{}', now(), now());
  insert into auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', md5(uid::text), uid::text, false, now(), now());
  insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
          json_build_object('action', 'user_signedup', 'actor_id', '00000000-0000-0000-0000-000000000000',
                            'traits', json_build_object('user_id', uid, 'user_email', p_email)), now(), ''),
         ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
          json_build_object('action', 'login', 'actor_id', uid, 'actor_username', p_email), now(), '');
  return uid;
end $$;

create temp table ids as select pg_temp.signup('kid@tests.pickld.test') as kid,
                                pg_temp.signup('other@tests.pickld.test') as other;
grant select on ids to service_role;

create function pg_temp.traces(p_user uuid, p_email text) returns bigint language sql as $$
  select (select count(*) from auth.users where id = p_user)
       + (select count(*) from auth.refresh_tokens where user_id = p_user::text)
       + (select count(*) from auth.audit_log_entries
          where payload->>'actor_id' = p_user::text or payload->'traits'->>'user_id' = p_user::text
             or payload->>'actor_username' = p_email or payload->'traits'->>'user_email' = p_email)
$$;

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.account_purge(uuid)', 'execute'), 'anon may not call it');
select ok(not has_function_privilege('authenticated', 'public.account_purge(uuid)', 'execute'),
          'signed-in users may not call it (fn:account-purge decides who is purged)');
select ok(has_function_privilege('service_role', 'public.account_purge(uuid)', 'execute'), 'the service role may');

select tests.act_as('outsider');
select throws_ok($$select public.account_purge(auth.uid())$$, '42501', null, 'a signed-in user is refused');
select tests.reset_role();

-- ---------------------------------------------------------------- established accounts are refused
select tests.act_as_service();
select is(public.account_purge(tests.id('owner')), false, 'a user with a profile is refused');
select tests.reset_role();
select is((select count(*) from auth.users where id = tests.id('owner')), 1::bigint, 'their auth user is untouched');
select is((select count(*) from public.profiles where id = tests.id('owner')), 1::bigint, 'their profile is untouched');
select is((select count(*) from public.follows where author_id = tests.id('owner')), 1::bigint,
          'their readers are untouched (the reader; blocks_sync already removed the blocked pair)');

-- ---------------------------------------------------------------- a sign-up is purged
select is(pg_temp.traces((select kid from ids), 'kid@tests.pickld.test'), 4::bigint, 'the sign-up left four auth rows');
select tests.act_as_service();
select is(public.account_purge((select kid from ids)), true, 'a profile-less sign-up is purged');
select tests.reset_role();
select is(pg_temp.traces((select kid from ids), 'kid@tests.pickld.test'), 0::bigint,
          'nothing names them afterwards: auth user, refresh tokens, audit entries');
select is(pg_temp.traces((select other from ids), 'other@tests.pickld.test'), 4::bigint, 'another sign-up is untouched');

select * from finish();
rollback;
