-- 0091: the console's Waitlist page (FR-MOD-08). Only moderators can read the summary or the list, export it,
-- or remove an email; owner, reader, outsider, blocked and anon are refused, and the helpers are not callable.
-- Counts are compared with a snapshot taken first, so rows already in the database don't matter. Export and
-- removal write audit rows that carry no email.
begin;
\ir _helpers.psql
select plan(40);

select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(),
                  'app_metadata', jsonb_build_object('role', 'moderator'))::text, true);
create temp table snap as select public.mod_waitlist_summary() as s;
select tests.reset_role();
grant select on snap to authenticated, anon, service_role;

select tests.world();
-- Accounts made by the pickld.me form have no profile yet.
create function pg_temp.auth_user(p_email text) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email, '', now(),
          '{"provider":"email"}', '{}', now(), now());
  return uid;
end $$;
insert into public.waitlist (email, source, ip_hash, created_at) values
  ('old@wl091.pickld.test', 'web', repeat('a', 64), now() - interval '40 days');
insert into public.waitlist (email, source, user_id) values
  ('Wait@WL091.pickld.test', 'hero', pg_temp.auth_user('wait@wl091.pickld.test')),
  ('story@wl091.pickld.test', 'story', pg_temp.auth_user('story@wl091.pickld.test'));
insert into public.waitlist (email, source, user_id, admitted_at) values
  ('in@wl091.pickld.test', 'final', pg_temp.auth_user('in@wl091.pickld.test'), now());
insert into public.waitlist (email, source, user_id, admitted_at) values
  ('owner@wl091.pickld.test', 'hero', tests.id('owner'), now());

create function pg_temp.delta(p_key text) returns int language sql as $$
  select ((public.mod_waitlist_summary() ->> p_key)::int - ((select s from snap) ->> p_key)::int)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- who can call them
select ok(not has_function_privilege('authenticated', 'public.mod_waitlist_state(uuid, timestamptz)', 'execute'),
          'clients cannot call the state helper');
select ok(not has_function_privilege('authenticated', 'public.mod_require_moderator()', 'execute'),
          'clients cannot call the role helper');
select ok(not has_table_privilege('authenticated', 'public.waitlist', 'select'), 'the waitlist table stays closed to clients');

select tests.act_as_anon();
select throws_ok($$select public.mod_waitlist_summary()$$, '42501', null, 'anon cannot read the summary');
select throws_ok($$select * from public.mod_waitlist()$$, '42501', null, 'anon cannot list the waitlist');
select throws_ok($$select * from public.mod_waitlist_export()$$, '42501', null, 'anon cannot export');
select throws_ok($$select public.mod_waitlist_remove('old@wl091.pickld.test', 'x')$$, '42501', null, 'anon cannot remove');
select tests.act_as('owner');
select throws_ok($$select public.mod_waitlist_summary()$$, '42501', 'moderators only', 'the owner cannot read the summary');
select throws_ok($$select * from public.mod_waitlist()$$, '42501', 'moderators only', 'the owner cannot list the waitlist');
select throws_ok($$select * from public.mod_waitlist_export()$$, '42501', 'moderators only', 'the owner cannot export');
select throws_ok($$select public.mod_waitlist_remove('old@wl091.pickld.test', 'x')$$, '42501', 'moderators only',
                 'the owner cannot remove');
select tests.act_as('reader');
select throws_ok($$select * from public.mod_waitlist()$$, '42501', 'moderators only', 'a reader cannot list the waitlist');
select tests.act_as('outsider');
select throws_ok($$select * from public.mod_waitlist_export()$$, '42501', 'moderators only', 'an outsider cannot export');
select tests.act_as('blocked');
select throws_ok($$select public.mod_waitlist_summary()$$, '42501', 'moderators only', 'a blocked user cannot read the summary');
select tests.act_as('owner');
select throws_ok($$select public.mod_require_moderator()$$, '42501', null, 'the role helper is not callable directly');
select tests.reset_role();
select is((select count(*)::int from public.waitlist where email::text ilike '%@wl091.pickld.test'), 5,
          'refused calls changed nothing');

-- ---------------------------------------------------------------- summary
select tests.act_as('moderator');
select is(pg_temp.delta('total'), 5, 'the total counts every row');
select is(pg_temp.delta('email_only'), 1, 'a row from the first form is email only');
select is(pg_temp.delta('waiting'), 2, 'verified accounts without a profile are waiting');
select is(pg_temp.delta('admitted'), 1, 'an admitted account without a profile is admitted');
select is(pg_temp.delta('members'), 1, 'an account with a profile is a member, admitted or not');
select is(pg_temp.delta('today'), 4, 'today counts rows from Manila midnight');
select is(jsonb_array_length(public.mod_waitlist_summary() -> 'per_day'), 30, 'joins per day covers 30 days');
select is((public.mod_waitlist_summary() -> 'per_day' -> 29 ->> 'day')::date,
          (now() at time zone 'Asia/Manila')::date, 'the last day is today in Manila');
select is((select (e ->> 'count')::int from jsonb_array_elements(public.mod_waitlist_summary() -> 'per_day') e
           where (e ->> 'day')::date = (now() at time zone 'Asia/Manila')::date)
          - (select (e ->> 'count')::int from jsonb_array_elements((select s from snap) -> 'per_day') e
             where (e ->> 'day')::date = (now() at time zone 'Asia/Manila')::date), 4,
          'today''s bar counts the 4 rows added today');

-- ---------------------------------------------------------------- list
select is((select array_agg(email order by email) from public.mod_waitlist('wl091', 'all')),
          array['in@wl091.pickld.test', 'old@wl091.pickld.test', 'owner@wl091.pickld.test',
                'story@wl091.pickld.test', 'Wait@WL091.pickld.test'], 'search matches part of an email');
select is((select array_agg(email) from public.mod_waitlist('WAIT@wl091', 'all')), array['Wait@WL091.pickld.test'],
          'search ignores case');
select is((select state from public.mod_waitlist('owner@wl091', 'all')), 'member', 'the list shows each row''s state');
select is((select array_agg(email order by email) from public.mod_waitlist('wl091', 'waiting')),
          array['story@wl091.pickld.test', 'Wait@WL091.pickld.test'], 'the state filter keeps waiting rows only');
select is((select count(*)::int from public.mod_waitlist('wl091', 'all', 2, 0)), 2, 'the limit pages the list');
select is((select max(total)::int from public.mod_waitlist('wl091', 'all', 2, 0)), 5, 'total counts every match, not the page');
select is((select email from public.mod_waitlist('wl091', 'all', 1, 4)), 'old@wl091.pickld.test',
          'the list is newest first');
select throws_ok($$select * from public.mod_waitlist('', 'nobody')$$, '22023', null, 'an unknown state is refused');

-- ---------------------------------------------------------------- export and remove
select is((select count(*)::int from public.mod_waitlist_export() where email ilike '%wl091%'), 5,
          'the export includes every row');
select is((select data ->> 'count' from public.audit_log where action = 'waitlist_export'
           and actor_id = tests.id('moderator') order by id desc limit 1)::int,
          (select (public.mod_waitlist_summary() ->> 'total')::int), 'the export writes an audit row with the count');
select throws_ok($$select public.mod_waitlist_remove('old@wl091.pickld.test', '  ')$$, '22023', null,
                 'removal needs a note');
select is(public.mod_waitlist_remove('nobody@wl091.pickld.test', 'asked by email') ->> 'result', 'not_found',
          'an email not on the list is not_found');
select is(public.mod_waitlist_remove(' wait@wl091.pickld.test ', 'asked by email') ->> 'result', 'removed',
          'a moderator removes an email on request, ignoring case and spaces');
select is((select data - 'joined_on' from public.audit_log where action = 'waitlist_remove'
           and actor_id = tests.id('moderator') order by id desc limit 1),
          '{"source": "hero", "had_account": true, "note": "asked by email"}'::jsonb,
          'the removal audit row keeps the source and note but no email');
select tests.reset_role();
select is((select count(*)::int from public.waitlist where email::text ilike '%@wl091.pickld.test'), 4,
          'the row is gone and the others stay');

select * from finish();
rollback;
