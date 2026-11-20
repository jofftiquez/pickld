-- 0171: Sign in with Apple refresh tokens are server only. Nobody signed in, not even the token's owner, can read
-- or write them; the service role can; a token goes with its auth user.
begin;
\ir _helpers.psql
select plan(9);

select tests.world();
insert into public.apple_tokens (user_id, client_id, refresh_token) values (tests.id('owner'), 'me.pickld.app', 'r-owner');

select ok((select relrowsecurity from pg_class where oid = 'public.apple_tokens'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.apple_tokens', 'select,insert,update,delete')
          and not has_table_privilege('authenticated', 'public.apple_tokens', 'select,insert,update,delete'),
          'anon and signed-in users have no privileges');

select tests.act_as('owner');
select throws_ok($$select refresh_token from public.apple_tokens$$, '42501', null, 'the owner cannot read their token');
select throws_ok($$update public.apple_tokens set refresh_token = 'x'$$, '42501', null, 'the owner cannot change it');
select tests.act_as('reader');
select throws_ok($$select count(*) from public.apple_tokens$$, '42501', null, 'a reader cannot read tokens');
select tests.act_as('outsider');
select throws_ok($$insert into public.apple_tokens (user_id, client_id, refresh_token)
                   values (auth.uid(), 'me.pickld.app', 'r')$$, '42501', null, 'an outsider cannot store a token');
select tests.act_as('blocked');
select throws_ok($$delete from public.apple_tokens$$, '42501', null, 'a blocked user cannot delete tokens');
select tests.act_as_anon();
select throws_ok($$select count(*) from public.apple_tokens$$, '42501', null, 'anon cannot read tokens');
select tests.reset_role();

delete from auth.users where id = tests.id('owner');
select is((select count(*)::int from public.apple_tokens), 0, 'the token is deleted with its auth user');

select * from finish();
rollback;
