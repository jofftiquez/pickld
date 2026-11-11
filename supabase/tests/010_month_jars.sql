-- M2-24 (0009): month_jars(month) returns only the caller's jars for that month, with the owner's count
-- and the cover from the first filled slot in the fixed order (FR-DAY-01; D-9, D-11).
begin;
\ir _helpers.psql
select plan(23);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;

-- Fixed past dates, so month boundaries are exact. Owner's jars are Everyone and published, so others
-- could read them through RLS: month_jars must still return them only to the owner.
create function pg_temp.jar(p_owner text, p_date date, p_tz text default 'Asia/Manila',
                            p_vis jar_visibility default 'everyone', p_published boolean default true)
returns uuid language sql as $$
  insert into public.jars (user_id, local_date, tz, visibility, published_at)
  values (tests.id(p_owner), p_date, p_tz, p_vis, case when p_published then now() end) returning id
$$;
insert into t values ('sep01', pg_temp.jar('owner', date '2026-09-01'));
insert into t values ('sep10', pg_temp.jar('owner', date '2026-09-10'));
insert into t values ('sep15', pg_temp.jar('owner', date '2026-09-15', p_vis => 'readers', p_published => false));
insert into t values ('sep30', pg_temp.jar('owner', date '2026-09-30', 'Europe/London', 'readers'));
insert into t values ('aug31', pg_temp.jar('owner', date '2026-08-31'));
insert into t values ('oct01', pg_temp.jar('owner', date '2026-10-01'));
insert into t values ('reader_sep05', pg_temp.jar('reader', date '2026-09-05', p_vis => 'readers', p_published => false));

-- sep01: whereami removed, whoamiwith private, ootd checking, evening live → cover whoamiwith, count 3.
select tests.make_moment((select id from t where k = 'sep01'), 'whereami', 'removed');
select tests.make_moment((select id from t where k = 'sep01'), 'evening', 'live');
select tests.make_moment((select id from t where k = 'sep01'), 'ootd', 'checking');
insert into t values ('sep01_cover', tests.make_moment((select id from t where k = 'sep01'), 'whoamiwith', 'live', p_private => true));
-- sep10: whereami has no thumbnail yet (still uploading) → cover selfie, count 2.
insert into public.moments (jar_id, user_id, slot, status)
  select id, tests.id('owner'), 'whereami', 'uploading' from t where k = 'sep10';
select tests.make_moment((select id from t where k = 'sep10'), 'selfie', 'live');
-- sep30: full jar, inserted in reverse order → cover whereami.
select tests.make_moment((select id from t where k = 'sep30'), s, 'live')
  from unnest(array['evening', 'afternoon', 'morning', 'selfie', 'ootd', 'whoamiwith', 'mebusywith', 'whereami']::slot[]) s;
select tests.make_moment((select id from t where k = 'aug31'), 'morning', 'live');
select tests.make_moment((select id from t where k = 'oct01'), 'morning', 'live');
select tests.make_moment((select id from t where k = 'reader_sep05'), 'ootd', 'live');

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.month_jars(date)', 'execute'), 'anon has no execute privilege');
select ok(has_function_privilege('authenticated', 'public.month_jars(date)', 'execute'), 'authenticated may execute');
select tests.act_as_anon();
select throws_ok($$select * from public.month_jars(date '2026-09-01')$$, '42501', null, 'anon cannot call month_jars');

-- ---------------------------------------------------------------- owner
select tests.act_as('owner');
select is((select array_agg(local_date::text order by local_date) from public.month_jars(date '2026-09-01')),
          array['2026-09-01', '2026-09-10', '2026-09-15', '2026-09-30'], 'owner gets every jar of the month, oldest first');
select is((select array_agg(moment_count::int order by local_date) from public.month_jars(date '2026-09-01')),
          array[3, 2, 0, 8], 'counts are the owner''s count: every moment that isn''t removed (D-9)');
select is((select array_agg(coalesce(cover_slot::text, '-') order by local_date) from public.month_jars(date '2026-09-01')),
          array['whoamiwith', 'selfie', '-', 'whereami'], 'covers come from the first filled slot in the fixed order');
select is((select cover_moment_id from public.month_jars(date '2026-09-01') where local_date = '2026-09-01'),
          (select id from t where k = 'sep01_cover'), 'cover_moment_id is that moment (a removed earlier slot is skipped)');
select is((select cover_thumb_path from public.month_jars(date '2026-09-01') where local_date = '2026-09-01'),
          (select thumb_path from public.moments where id = (select id from t where k = 'sep01_cover')),
          'cover_thumb_path is its thumbnail');
select is((select array_agg(is_full order by local_date) from public.month_jars(date '2026-09-01')),
          array[false, false, false, true], 'is_full marks the full jar');
select is((select array_agg(tz || '/' || visibility || '/' || (published_at is not null) order by local_date) from public.month_jars(date '2026-09-01')),
          array['Asia/Manila/everyone/true', 'Asia/Manila/everyone/true', 'Asia/Manila/readers/false', 'Europe/London/readers/true'],
          'zone, visibility and published state come with each jar');
select is((select array_agg(jar_id order by local_date) from public.month_jars(date '2026-09-17')),
          (select array_agg(jar_id order by local_date) from public.month_jars(date '2026-09-01')),
          'any date in the month selects the same month');
select is((select array_agg(local_date::text) from public.month_jars(date '2026-08-15')), array['2026-08-31'],
          'August stops at its last day');
select is((select array_agg(local_date::text) from public.month_jars(date '2026-10-31')), array['2026-10-01'],
          'October starts at its first day');
select is((select count(*)::int from public.month_jars(date '2026-07-01')), 0, 'a month without jars is empty');
select throws_ok($$select * from public.month_jars(null)$$, '22023', 'month is required', 'month is required');

-- Deleting the cover moment moves the cover to the next filled slot.
delete from public.moments where id = (select id from t where k = 'sep01_cover');
select is((select cover_slot::text || '/' || moment_count from public.month_jars(date '2026-09-01') where local_date = '2026-09-01'),
          'ootd/2', 'the cover follows the next filled slot (a checking moment counts for the owner)');

-- ---------------------------------------------------------------- everyone else sees only their own
select tests.act_as('reader');
select is((select array_agg(jar_id) from public.month_jars(date '2026-09-01')), array[(select id from t where k = 'reader_sep05')],
          'a reader gets only their own jar, never the owner''s');
select tests.act_as('outsider');
select is((select count(*)::int from public.month_jars(date '2026-09-01')), 0,
          'an outsider gets nothing, even though the owner''s Everyone jars are visible to them');
select ok((select count(*) from public.jars where user_id = tests.id('owner')) > 0,
          'control: the outsider can see the owner''s Everyone jars through RLS');
select tests.act_as('blocked');
select is((select count(*)::int from public.month_jars(date '2026-09-01')), 0, 'the blocked user gets nothing');
select tests.act_as('moderator');
select is((select count(*)::int from public.month_jars(date '2026-09-01')), 0, 'a moderator gets nothing');
select tests.act_as_service();
select is((select count(*)::int from public.month_jars(date '2026-09-01')), 0, 'a call without a signed-in user gets nothing');

-- D-11: a suspended owner still reads their own days.
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('owner');
select tests.act_as('owner');
select is((select count(*)::int from public.month_jars(date '2026-09-01')), 4, 'a suspended owner still gets their jars');

select * from finish();
rollback;
