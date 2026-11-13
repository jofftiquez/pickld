-- M1-08 (0003): jar column guard (S-5), IANA zones and future dates (S-9), ends_at (D-1), visible_count (D-9).
begin;
\ir _helpers.psql
select plan(44);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => false));

-- ---------------------------------------------------------------- S-5 owner may change only visibility and published_at
select tests.act_as('owner');
select lives_ok($$update public.jars set visibility = 'everyone' where id = (select id from t where k = 'jar')$$, 'owner can change visibility');
select lives_ok($$update public.jars set published_at = '2001-01-01' where id = (select id from t where k = 'jar')$$, 'owner can publish');
select ok((select published_at > now() - interval '1 minute' from public.jars where id = (select id from t where k = 'jar')),
          'published_at is stamped with server time, not the client value');
select throws_ok($$update public.jars set published_at = null where id = (select id from t where k = 'jar')$$, '42501', null,
                 'a published jar cannot be unpublished by clearing published_at');
select throws_ok($$update public.jars set moment_count = 8 where id = (select id from t where k = 'jar')$$, '42501',
                 'only visibility and published_at can be changed', 'owner cannot fake moment_count');
select throws_ok($$update public.jars set visible_count = 8 where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot fake visible_count');
select throws_ok($$update public.jars set like_count = 99 where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot fake like_count');
select throws_ok($$update public.jars set comment_count = 99 where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot fake comment_count');
select throws_ok($$update public.jars set local_date = local_date - 1 where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot change local_date');
select throws_ok($$update public.jars set tz = 'Asia/Tokyo' where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot change tz');
select throws_ok($$update public.jars set ends_at = ends_at + interval '1 day' where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot change ends_at');
select throws_ok($$update public.jars set created_at = now() - interval '1 year' where id = (select id from t where k = 'jar')$$, '42501', null, 'owner cannot change created_at');
select throws_ok($$update public.jars set user_id = (select id from tests.users where name = 'outsider') where id = (select id from t where k = 'jar')$$,
                 '42501', null, 'owner cannot give the jar away');

select tests.act_as('reader');
update public.jars set visibility = 'only_me' where id = (select id from t where k = 'jar');
select tests.reset_role();
select is((select visibility::text from public.jars where id = (select id from t where k = 'jar')), 'everyone', 'reader cannot change the owner''s jar');

-- ---------------------------------------------------------------- client insert: counters and ends_at are server-set
select tests.act_as('owner');
select lives_ok($$insert into public.jars (user_id, local_date, tz, moment_count, like_count, comment_count, visible_count, ends_at)
                  values (auth.uid(), (now() at time zone 'Asia/Manila')::date - 10, 'Asia/Manila', 8, 50, 50, 8, '2100-01-01')$$,
                'owner can create a jar for a past date');
select is((select array[moment_count, like_count, comment_count, visible_count]::int[] from public.jars
           where user_id = tests.id('owner') and local_date = (now() at time zone 'Asia/Manila')::date - 10),
          array[0, 0, 0, 0], 'forged counters are reset on insert');
select is((select ends_at from public.jars where user_id = tests.id('owner') and local_date = (now() at time zone 'Asia/Manila')::date - 10),
          (((now() at time zone 'Asia/Manila')::date - 9)::timestamp at time zone 'Asia/Manila'),
          'a client-supplied ends_at is replaced by next local midnight');
select throws_ok(format('insert into public.jars (user_id, local_date, tz) values (%L, current_date - 20, ''Asia/Manila'')', tests.id('outsider')),
                 '42501', null, 'a user cannot create a jar for someone else');

-- ---------------------------------------------------------------- S-9 zones
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 30, 'Mars/Olympus_Mons')$$,
                 '22023', null, 'an unknown zone is refused');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 31, '+08:00')$$, '22023', null, 'an offset is refused');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 32, 'PST')$$, '22023', null, 'an abbreviation is refused');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 33, 'PST8PDT')$$, '22023', null, 'a POSIX rule is refused');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 34, 'posix/Asia/Manila')$$, '22023', null, 'posix/ aliases are refused');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 35, '')$$, '22023', null, 'an empty zone is refused');
select lives_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 36, 'America/Argentina/Buenos_Aires')$$,
                'a three-part IANA name is accepted');
select lives_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 37, 'UTC')$$, 'UTC is accepted');

-- Future dates are judged in the jar's own zone, not the server's.
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), (now() at time zone 'Pacific/Kiritimati')::date + 1, 'Pacific/Kiritimati')$$,
                 '22023', 'jar date is in the future for its time zone', 'tomorrow in the jar''s zone is refused');
-- As the reader, who has no jar yet: the owner's Manila jar above often has the same local date.
select tests.act_as('reader');
select lives_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), (now() at time zone 'Pacific/Kiritimati')::date, 'Pacific/Kiritimati')$$,
                'today in UTC+14 is accepted even when it is already tomorrow in UTC');
select tests.act_as('owner');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), (now() at time zone 'Pacific/Pago_Pago')::date + 1, 'Pacific/Pago_Pago')$$,
                 '22023', null, 'tomorrow in UTC-11 is refused even when it is already that date in UTC');

-- ---------------------------------------------------------------- D-1 ends_at, DST
select tests.reset_role();
insert into t values
  ('ny_fall',   tests.make_jar('outsider', p_tz => 'America/New_York', p_days_ago => (now() at time zone 'America/New_York')::date - date '2026-11-01')),
  ('ny_spring', tests.make_jar('outsider', p_tz => 'America/New_York', p_days_ago => (now() at time zone 'America/New_York')::date - date '2026-03-08')),
  ('santiago',  tests.make_jar('outsider', p_tz => 'America/Santiago', p_days_ago => (now() at time zone 'America/Santiago')::date - date '2026-09-05')),
  ('manila',    tests.make_jar('blocked', p_tz => 'Asia/Manila',      p_days_ago => (now() at time zone 'Asia/Manila')::date - date '2026-11-01'));
select is((select ends_at from public.jars where id = (select id from t where k = 'manila')), timestamptz '2026-11-01 16:00:00+00',
          'Manila jar for Nov 1 ends at Manila midnight (16:00 UTC)');
select is((select ends_at from public.jars where id = (select id from t where k = 'ny_fall')), timestamptz '2026-11-02 05:00:00+00',
          'New York jar on the fall-back day ends at midnight EST');
select is((select ends_at - (local_date::timestamp at time zone tz) from public.jars where id = (select id from t where k = 'ny_fall')),
          interval '25 hours', 'the fall-back day is 25 hours long');
select is((select ends_at - (local_date::timestamp at time zone tz) from public.jars where id = (select id from t where k = 'ny_spring')),
          interval '23 hours', 'the spring-forward day is 23 hours long');
select is((select ends_at from public.jars where id = (select id from t where k = 'santiago')), timestamptz '2026-09-06 04:00:00+00',
          'Santiago jar ends at the first instant of the next day when local midnight does not exist (DST jump at 00:00)');

-- ends_at only moves later, even for the server
select tests.act_as_service();
select throws_ok($$update public.jars set ends_at = ends_at - interval '1 minute' where id = (select id from t where k = 'manila')$$,
                 '22023', 'ends_at can only move later', 'the server cannot move ends_at earlier');
select lives_ok($$update public.jars set ends_at = ends_at + interval '8 hours' where id = (select id from t where k = 'manila')$$,
                'the server can move ends_at later (westward travel)');
select is((select public.jar_ends_at(j) from public.jars j where id = (select id from t where k = 'manila')), timestamptz '2026-11-02 00:00:00+00',
          'jar_ends_at() follows the stored ends_at');
select throws_ok($$update public.jars set tz = 'Nowhere/Land' where id = (select id from t where k = 'manila')$$, '22023', null,
                 'the server cannot set an invalid zone either');

-- ---------------------------------------------------------------- D-9 visible_count vs moment_count
select tests.reset_role();
insert into t values ('counted', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 1));
insert into t values ('m_private', tests.make_moment((select id from t where k = 'counted'), 'selfie', 'live', p_private => true));
insert into t values ('m_checking', tests.make_moment((select id from t where k = 'counted'), 'ootd', 'checking'));
select tests.make_moment((select id from t where k = 'counted'), 'morning', 'live');
select tests.make_moment((select id from t where k = 'counted'), 'evening', 'removed');
select is((select array[moment_count, visible_count]::int[] from public.jars where id = (select id from t where k = 'counted')), array[3, 1],
          'moment_count counts live+private+checking (3); visible_count only live public (1)');

select tests.act_as('owner');
update public.moments set visibility = 'readers' where id = (select id from t where k = 'm_private');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'counted')), 2, 'making a moment public raises visible_count');
select tests.set_status((select id from t where k = 'm_checking'), 'live');
select is((select array[moment_count, visible_count]::int[] from public.jars where id = (select id from t where k = 'counted')), array[3, 3],
          'a checking moment going live raises visible_count only');
select tests.set_status((select id from t where k = 'm_checking'), 'removed');
select is((select array[moment_count, visible_count]::int[] from public.jars where id = (select id from t where k = 'counted')), array[2, 2],
          'removing a live moment lowers both counts');

-- Readers see visible_count; the owner's jar_count counts only jars with at least one moment (FR-JAR-08).
select tests.act_as('reader');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'counted')), 2, 'a reader reads visible_count');
select tests.reset_role();
select is((select jar_count from public.profiles where id = tests.id('owner')), 1,
          'jar_count ignores the empty jars (only the jar with moments counts)');

select * from finish();
rollback;
