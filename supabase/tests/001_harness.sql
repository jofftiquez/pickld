-- The helpers set the JWT claims Postgres policies read, for every role in the test cast.
begin;
\ir _helpers.psql
select plan(14);

select tests.world();

select tests.act_as('owner');
select is(auth.uid(), tests.id('owner'), 'act_as(owner) sets auth.uid()');
select is(auth.role(), 'authenticated', 'act_as(owner) sets role claim authenticated');
select is(current_user::text, 'authenticated', 'act_as(owner) switches the Postgres role');
select is(public.is_moderator(), false, 'owner is not a moderator');

select tests.act_as('reader');
select is(auth.uid(), tests.id('reader'), 'act_as(reader) sets auth.uid()');

select tests.act_as('blocked');
select is(auth.uid(), tests.id('blocked'), 'act_as(blocked) sets auth.uid()');

select tests.act_as('moderator');
select is(public.is_moderator(), true, 'act_as(moderator) carries app_metadata.role = moderator');
select is(auth.uid(), tests.id('moderator'), 'act_as(moderator) sets auth.uid()');

select tests.act_as_anon();
select is(auth.uid(), null, 'act_as_anon has no user');
select is(current_user::text, 'anon', 'act_as_anon switches to the anon role');

select tests.act_as_service();
select is(auth.role(), 'service_role', 'act_as_service sets the service_role claim');

select tests.reset_role();
select is(current_user::text, 'postgres', 'reset_role returns to the superuser');

-- The cast's relationships are in place.
select ok(exists (select 1 from public.follows where reader_id = tests.id('reader') and author_id = tests.id('owner')),
          'reader follows owner');
select ok(public.is_blocked_between(tests.id('owner'), tests.id('blocked'))
          and public.is_blocked_between(tests.id('blocker'), tests.id('owner')),
          'owner blocked "blocked" and "blocker" blocked owner');

select * from finish();
rollback;
