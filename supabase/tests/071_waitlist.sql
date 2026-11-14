-- 0071 (marketing site): the waitlist is server only. Anon and signed-in users can't read or write it or
-- call waitlist_join(); the service role joins emails once each (case-insensitive), 5 per IP hash an hour.
begin;
\ir _helpers.psql
select plan(17);

select tests.world();

-- ---------------------------------------------------------------- no client access
select ok((select relrowsecurity from pg_class where oid = 'public.waitlist'::regclass), 'RLS is enabled on waitlist');
select ok(not has_table_privilege('anon', 'public.waitlist', 'select,insert,update,delete'),
          'anon has no privileges on waitlist');
select ok(not has_table_privilege('authenticated', 'public.waitlist', 'select,insert,update,delete'),
          'authenticated has no privileges on waitlist');
select ok(not has_function_privilege('anon', 'public.waitlist_join(text, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.waitlist_join(text, text, text)', 'execute'),
          'anon and signed-in users may not call waitlist_join');

select tests.act_as_anon();
select throws_ok($$select public.waitlist_join('anon@example.com', repeat('a', 64))$$, '42501', null,
                 'anon cannot join through the function');
select throws_ok($$insert into public.waitlist (email, ip_hash) values ('anon@example.com', repeat('a', 64))$$,
                 '42501', null, 'anon cannot insert into waitlist');
select tests.reset_role();

select tests.act_as('outsider');
select throws_ok($$select count(*) from public.waitlist$$, '42501', null, 'a signed-in user cannot read waitlist');
select throws_ok($$select public.waitlist_join('me@example.com', repeat('a', 64))$$, '42501', null,
                 'a signed-in user cannot join through the function');
select tests.reset_role();

-- ---------------------------------------------------------------- the service role
select tests.act_as_service();
select is(public.waitlist_join('Dale@Example.com', repeat('a', 64)), 'joined', 'a new email joins');
select is(public.waitlist_join('dale@example.com', repeat('b', 64)), 'already',
          'the same email in another case is already on the list');
select is((select count(*)::int from public.waitlist where email = 'DALE@example.com'), 1, 'one row per email');
select is((select source from public.waitlist where email = 'dale@example.com'), 'web', 'source defaults to web');
select throws_ok($$select public.waitlist_join('not-an-email', repeat('c', 64))$$, '23514', null,
                 'an address without @ and a dot is refused');
select throws_ok($$select public.waitlist_join('x@example.com', 'raw-ip-1.2.3.4')$$, '23514', null,
                 'only a 64-character hex hash is stored, never a raw IP');

-- Four more from the same hash fill its hour (5 in all); the sixth is limited. A different hash still joins.
select is(array(select public.waitlist_join('n' || i || '@example.com', repeat('a', 64)) from generate_series(1, 4) i),
          array['joined', 'joined', 'joined', 'joined'], 'up to 5 emails per IP hash an hour');
select is(public.waitlist_join('sixth@example.com', repeat('a', 64)), 'limited', 'the sixth from that hash is limited');
select tests.reset_role();

-- Joins older than an hour don't count.
update public.waitlist set created_at = now() - interval '2 hours' where ip_hash = repeat('a', 64);
select tests.act_as_service();
select is(public.waitlist_join('later@example.com', repeat('a', 64)), 'joined', 'the limit resets after an hour');
select tests.reset_role();

select * from finish();
rollback;
