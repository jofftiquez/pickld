-- INV-06 (0141): invite_period_ends_at() shows the period's end to anyone, and only while it is running.
-- app_settings itself stays closed to clients.
begin;
\ir _helpers.psql
select plan(6);

select tests.world();

select ok(has_function_privilege('anon', 'public.invite_period_ends_at()', 'execute')
          and has_function_privilege('authenticated', 'public.invite_period_ends_at()', 'execute'),
          'signed-out and signed-in callers may ask when early access ends');

select is(public.invite_period_ends_at(), null, 'no date set: nothing to show');

update public.app_settings set invite_period_ends_at = '2099-02-14 00:00+00';

select tests.act_as('outsider');
select is(public.invite_period_ends_at(), '2099-02-14 00:00+00'::timestamptz, 'a signed-in caller sees the end');
select throws_ok('select invite_period_ends_at from public.app_settings', '42501', null,
                 'app_settings itself stays closed to clients');
select tests.act_as_anon();
select is(public.invite_period_ends_at(), '2099-02-14 00:00+00'::timestamptz, 'a signed-out caller sees it too');
select tests.reset_role();

update public.app_settings set invite_period_ends_at = now() - interval '1 day';
select is(public.invite_period_ends_at(), null, 'a date in the past: early access is over, nothing to show');

select * from finish();
rollback;
