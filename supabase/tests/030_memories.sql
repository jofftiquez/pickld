-- M6-05 (0030): Memories RPCs return only the caller's own jars: On this day from earlier years, the monthly
-- recap (moments, full days, top tag, photo strip) and the year summary (FR-DAY-03).
begin;
\ir _helpers.psql
select plan(21);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;

-- Owner's jars are Everyone and published, so others could read them through RLS: the RPCs must still
-- return them only to the owner.
create function pg_temp.jar(p_owner text, p_date date) returns uuid language sql as $$
  insert into public.jars (user_id, local_date, tz, visibility, published_at)
  values (tests.id(p_owner), p_date, 'Asia/Manila', 'everyone', now()) returning id
$$;
create function pg_temp.fill(p_key text, p_owner text, p_date date, p_slots slot[]) returns void language plpgsql as $$
declare jid uuid := pg_temp.jar(p_owner, p_date); s slot;
begin
  insert into t values (p_key, jid);
  foreach s in array p_slots loop perform tests.make_moment(jid, s, 'live'); end loop;
end $$;

-- On this day (today = 2026-11-10).
select pg_temp.fill('nov10_2025', 'owner', date '2025-11-10', array['selfie', 'evening', 'ootd']::slot[]);
select pg_temp.fill('nov10_2024', 'owner', date '2024-11-10',
                    array['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening']::slot[]);
select pg_temp.fill('nov10_2023', 'owner', date '2023-11-10', array[]::slot[]);  -- empty: not a memory
select pg_temp.fill('nov11_2025', 'owner', date '2025-11-11', array['morning']::slot[]);
select pg_temp.fill('nov10_2026', 'owner', date '2026-11-10', array['morning']::slot[]); -- today itself
select pg_temp.fill('feb29_2024', 'owner', date '2024-02-29', array['morning']::slot[]);
-- October 2026: one full day, then smaller ones.
select pg_temp.fill('oct01', 'owner', date '2026-10-01',
                    array['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening']::slot[]);
select pg_temp.fill('oct05', 'owner', date '2026-10-05', array['selfie', 'ootd']::slot[]);
select pg_temp.fill('oct09', 'owner', date '2026-10-09', array['selfie']::slot[]);
select tests.make_moment((select id from t where k = 'oct09'), 'ootd', 'removed');           -- not counted
select tests.make_moment((select id from t where k = 'oct09'), 'morning', 'live', p_private => true); -- counted for the owner
select pg_temp.fill('oct20', 'owner', date '2026-10-20', array['selfie']::slot[]);
select pg_temp.fill('oct21', 'owner', date '2026-10-21', array['selfie']::slot[]);
select pg_temp.fill('oct22', 'owner', date '2026-10-22', array['selfie']::slot[]);
select pg_temp.fill('oct23', 'owner', date '2026-10-23', array['selfie']::slot[]);
select pg_temp.fill('sep15', 'owner', date '2026-09-15', array[]::slot[]);
-- Someone else's memory on the same day.
select pg_temp.fill('reader_nov10_2025', 'reader', date '2025-11-10', array['ootd']::slot[]);

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.memories_on_this_day(date)', 'execute'), 'anon cannot run memories_on_this_day');
select ok(not has_function_privilege('anon', 'public.memories_month_recap(date)', 'execute'), 'anon cannot run memories_month_recap');
select ok(not has_function_privilege('anon', 'public.memories_year_summary(int)', 'execute'), 'anon cannot run memories_year_summary');
select ok(has_function_privilege('authenticated', 'public.memories_on_this_day(date)', 'execute'), 'authenticated may run memories_on_this_day');
select ok(has_function_privilege('authenticated', 'public.memories_month_recap(date)', 'execute'), 'authenticated may run memories_month_recap');
select ok(has_function_privilege('authenticated', 'public.memories_year_summary(int)', 'execute'), 'authenticated may run memories_year_summary');
select tests.act_as_anon();
select throws_ok($$select * from public.memories_month_recap(date '2026-10-01')$$, '42501', null, 'anon is refused');

-- ---------------------------------------------------------------- owner
select tests.act_as('owner');
select is((select array_agg(local_date::text order by local_date desc) from public.memories_on_this_day(date '2026-11-10')),
          array['2025-11-10', '2024-11-10'],
          'On this day: earlier years with moments, newest first (not today, not an empty jar, not the next day)');
select is((select cover_slot::text from public.memories_on_this_day(date '2026-11-10') where local_date = '2025-11-10'),
          'ootd', 'the cover is the first filled slot in the fixed order');
select is((select count(*)::int from public.memories_on_this_day(date '2025-02-28')), 0, 'a Feb 29 jar is not shown on Feb 28');
select is((select array_agg(local_date::text) from public.memories_on_this_day(date '2028-02-29')), array['2024-02-29'],
          'a Feb 29 jar is shown on the next Feb 29');

select results_eq($$select moment_count, full_days, top_slot::text from public.memories_month_recap(date '2026-10-17')$$,
                  $$values (16, 1, 'selfie')$$,
                  'recap: owner''s count (private counted, removed not), full days and the most-filled slot');
select is((select array_agg(e->>'local_date' order by e->>'local_date') from public.memories_month_recap(date '2026-10-01') r,
           jsonb_array_elements(r.strip) e),
          array['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-22', '2026-10-23'],
          'the strip holds five covers from the fullest days (latest first on a tie), in date order');
select is((select top_slot::text from public.memories_month_recap(date '2025-11-01')), 'ootd',
          'a tie for top tag goes to the earlier slot in the fixed order');
select results_eq($$select moment_count, full_days, top_slot::text, strip from public.memories_month_recap(date '2026-07-01')$$,
                  $$values (0, 0, null::text, '[]'::jsonb)$$, 'an empty month: zeros, no top tag, no strip');
select results_eq($$select jars_filled, full_days, moment_count from public.memories_year_summary(2026)$$,
                  $$values (8, 1, 17)$$, 'year summary: jars with moments, full days and moments of that year');
select throws_ok($$select * from public.memories_month_recap(null)$$, '22023', null, 'a month is required');

-- ---------------------------------------------------------------- others never see the owner's memories
select tests.act_as('reader');
select is((select array_agg(jar_id) from public.memories_on_this_day(date '2026-11-10')),
          array[(select id from t where k = 'reader_nov10_2025')], 'a reader gets only their own memory');
select results_eq($$select moment_count, full_days from public.memories_month_recap(date '2026-10-01')$$,
                  $$values (0, 0)$$, 'a reader gets nothing from the owner''s Everyone jars');
select tests.act_as('outsider');
select results_eq($$select jars_filled, moment_count from public.memories_year_summary(2026)$$,
                  $$values (0, 0)$$, 'an outsider gets an empty year');
select tests.act_as('blocked');
select is((select count(*)::int from public.memories_on_this_day(date '2026-11-10')), 0, 'a blocked user gets nothing');

select * from finish();
rollback;
