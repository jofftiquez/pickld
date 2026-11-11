-- M2-02 (0008): ensure_jar(local_date, tz) gets or creates the caller's jar race-safely, checks the zone and
-- date on the server, and re-zones today's jar for westward travel without ever moving ends_at earlier
-- (FR-JAR-04, FR-JAR-05; D-1).
begin;
\ir _helpers.psql
select plan(39);

select tests.world();
create temp table t (k text primary key, id uuid, snap jsonb);
grant select, insert on t to authenticated, anon, service_role;

create function pg_temp.jar(p_k text) returns public.jars language sql as $$
  select j.* from public.jars j where j.id = (select id from t where k = p_k)
$$;
grant execute on function pg_temp.jar(text) to authenticated;

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.ensure_jar(date, text)', 'execute'), 'anon has no execute privilege');
select ok(has_function_privilege('authenticated', 'public.ensure_jar(date, text)', 'execute'), 'authenticated may execute');
select tests.act_as_anon();
select throws_ok($$select public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Manila')$$, '42501', null,
                 'anon cannot call ensure_jar');
select tests.act_as_service();
select throws_ok($$select public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Manila')$$, '42501', null,
                 'a call without a signed-in user is refused');
select tests.reset_role();
select is((select count(*)::int from public.jars where user_id in (select id from tests.users)), 0, 'refused calls created no jar');

-- ---------------------------------------------------------------- owner: create, then the same jar on repeat calls
select tests.act_as('owner');
select lives_ok($$insert into t (k, id) select 'today', (public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Manila')).id$$,
                'owner creates today''s jar');
select is((select array[user_id::text, local_date::text, tz] from pg_temp.jar('today')),
          array[tests.id('owner')::text, (now() at time zone 'Asia/Manila')::date::text, 'Asia/Manila'],
          'the jar belongs to the caller, for the given date and zone');
select is((select ends_at from pg_temp.jar('today')), (((now() at time zone 'Asia/Manila')::date + 1)::timestamp at time zone 'Asia/Manila'),
          'ends_at is next local midnight in the jar''s zone');
select is((select array[visibility::text, coalesce(published_at::text, 'unpublished'), moment_count::text] from pg_temp.jar('today')),
          array['readers', 'unpublished', '0'], 'a new jar is unpublished, Readers, empty');
select is((select to_jsonb(public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Manila'))),
          (select to_jsonb(j) from pg_temp.jar('today') j), 'a repeat call returns the same full jar row');
select is((select count(*)::int from public.jars where user_id = auth.uid() and local_date = (now() at time zone 'Asia/Manila')::date), 1,
          'repeat calls never create a second jar');
select tests.reset_role();
update t set snap = (select to_jsonb(j) from pg_temp.jar('today') j) where k = 'today';

-- ---------------------------------------------------------------- race: another device's insert won first
-- Two concurrent calls serialize on the unique (user_id, local_date) index: the loser's ON CONFLICT waits
-- for the winner to commit, then reads its row. Here the "other device" commits first as a direct insert.
insert into t (k, id) values ('race', tests.make_jar('reader', p_days_ago => 1));
select tests.act_as('reader');
select is((public.ensure_jar((now() at time zone 'Asia/Manila')::date - 1, 'Asia/Manila')).id, (select id from t where k = 'race'),
          'a call after another device created the jar returns that jar');
select is((select count(*)::int from public.jars where user_id = auth.uid()), 1, 'and creates no duplicate');

-- ---------------------------------------------------------------- zone and date checks (server clock, jar's own zone)
select tests.act_as('moderator');
select throws_ok($$select public.ensure_jar((now() at time zone 'Pacific/Kiritimati')::date + 1, 'Pacific/Kiritimati')$$,
                 '22023', 'jar date is in the future for its time zone', 'tomorrow in the given zone is refused');
select throws_ok($$select public.ensure_jar((now() at time zone 'Pacific/Pago_Pago')::date + 1, 'Pacific/Pago_Pago')$$,
                 '22023', null, 'tomorrow in UTC-11 is refused even when it is already that date in UTC');
select lives_ok($$select public.ensure_jar((now() at time zone 'Pacific/Kiritimati')::date, 'Pacific/Kiritimati')$$,
                'today in UTC+14 is accepted even when it is already tomorrow in UTC');
select lives_ok($$select public.ensure_jar((now() at time zone 'Asia/Manila')::date - 30, 'Asia/Manila')$$, 'a past date is accepted (backfill)');
select throws_ok($$select public.ensure_jar(current_date - 40, 'Mars/Olympus_Mons')$$, '22023', null, 'an unknown zone is refused');
select throws_ok($$select public.ensure_jar(current_date - 41, '+08:00')$$, '22023', null, 'an offset is refused');
select throws_ok($$select public.ensure_jar(current_date - 42, 'PST')$$, '22023', null, 'an abbreviation is refused');
select throws_ok($$select public.ensure_jar(current_date - 43, null)$$, '22023', null, 'a missing zone is refused');
select throws_ok($$select public.ensure_jar(null, 'Asia/Manila')$$, '22023', null, 'a missing date is refused');
select is((select count(*)::int from public.jars where user_id = auth.uid()), 2, 'only the two valid calls created jars');

-- ---------------------------------------------------------------- D-1 westward travel
-- Kiritimati (UTC+14) is always exactly one date ahead of Honolulu (UTC-10), neither has DST. A jar for
-- Honolulu's today, made in Kiritimati, ended at Kiritimati midnight; the trip west re-opens it.
select tests.act_as('outsider');
select lives_ok($$insert into t (k, id) select 'trip', (public.ensure_jar((now() at time zone 'Pacific/Honolulu')::date, 'Pacific/Kiritimati')).id$$,
                'the jar is made in Kiritimati (a past date there)');
select ok((select ends_at <= now() from pg_temp.jar('trip')), 'its day is over in Kiritimati');
select is((public.ensure_jar((now() at time zone 'Pacific/Honolulu')::date, 'Pacific/Honolulu')).id, (select id from t where k = 'trip'),
          'the same date in Honolulu returns the same jar, not a new one');
select is((select tz from pg_temp.jar('trip')), 'Pacific/Honolulu', 'the jar is re-zoned to the phone''s zone');
select is((select ends_at from pg_temp.jar('trip')),
          (((now() at time zone 'Pacific/Honolulu')::date + 1)::timestamp at time zone 'Pacific/Honolulu'),
          'ends_at moves to the next midnight in Honolulu (24 hours later)');
select tests.reset_role();
insert into t (k, id) values ('trip moment', tests.make_moment((select id from t where k = 'trip'), 'morning', 'checking'));
select is((select is_backfilled from public.moments where id = (select id from t where k = 'trip moment')), false, 'a moment in the extra hours is not Added later');
update t set snap = (select to_jsonb(j) from pg_temp.jar('trip') j) where k = 'trip';

select tests.act_as('outsider');
select is((select to_jsonb(public.ensure_jar((now() at time zone 'Pacific/Honolulu')::date, 'Pacific/Kiritimati'))),
          (select snap from t where k = 'trip'), 'a call where the date is already over (backfill) never re-zones or shortens');
select is((select to_jsonb(public.ensure_jar((now() at time zone 'Pacific/Honolulu')::date, 'Pacific/Honolulu'))),
          (select snap from t where k = 'trip'), 'repeating the call in the same zone changes nothing');

-- Never earlier: the jar's day ends later than today's midnight in the new zone, so it stays as it is.
select tests.reset_role();
update public.jars set ends_at = ends_at + interval '2 days' where id = (select id from t where k = 'trip');
update t set snap = (select to_jsonb(j) from pg_temp.jar('trip') j) where k = 'trip';
select tests.act_as('outsider');
select is((select to_jsonb(public.ensure_jar((now() at time zone 'US/Hawaii')::date, 'US/Hawaii'))),
          (select snap from t where k = 'trip'), 'a zone whose midnight is earlier than ends_at neither re-zones nor moves ends_at earlier');

-- ---------------------------------------------------------------- other users: a call only ever touches the caller's jar
select tests.act_as('reader');
select ok((select user_id = tests.id('reader') and id <> (select id from t where k = 'today')
           from public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Tokyo')),
          'reader gets their own jar for the owner''s date, not the owner''s');
select is((select count(*)::int from public.jars where id = (select id from t where k = 'today')), 0,
          'reader still cannot see the owner''s unpublished jar');
select tests.act_as('blocked');
select ok((select user_id = tests.id('blocked') and id <> (select id from t where k = 'today')
           from public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Asia/Manila')),
          'blocked user gets their own jar');
select tests.act_as('blocker');
select ok((select user_id = tests.id('blocker') and id <> (select id from t where k = 'today')
           from public.ensure_jar((now() at time zone 'Asia/Manila')::date, 'Pacific/Kiritimati')),
          'blocker gets their own jar');
select tests.reset_role();
select is((select to_jsonb(j) from pg_temp.jar('today') j), (select snap from t where k = 'today'),
          'the owner''s jar is unchanged by everyone else''s calls');

-- ---------------------------------------------------------------- suspended accounts can't create jars (D-11)
update public.profiles set status = 'suspended' where id = tests.id('blocker');
select tests.act_as('blocker');
select throws_ok($$select public.ensure_jar((now() at time zone 'Asia/Manila')::date - 5, 'Asia/Manila')$$, '42501', null,
                 'a suspended user cannot create a jar');
select tests.reset_role();
select is((select count(*)::int from public.jars where user_id = tests.id('blocker')), 1, 'the suspended user''s refused call created nothing');

select * from finish();
rollback;
