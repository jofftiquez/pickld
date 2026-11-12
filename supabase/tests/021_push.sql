-- M3-17 (0020): push_take() and the receipt helpers behind fn:send-push (FR-NOT-02, FR-NOT-04).
begin;
\ir _helpers.psql
select plan(27);

select tests.world();
insert into public.push_tokens (user_id, token, platform) values
  (tests.id('owner'), 'ExponentPushToken[owner]', 'ios'),
  (tests.id('reader'), 'ExponentPushToken[reader]', 'android');
-- Quiet hours off unless a test turns them on, so the clock of the test run doesn't matter.
update public.notification_prefs set quiet_hours = false;

create function pg_temp.note(who text, typ text, actor text default null, age interval default interval '2 minutes')
returns uuid language sql as $$
  insert into public.notifications (user_id, type, actor_id, created_at)
  values (tests.id(who), typ, tests.id(actor), now() - age) returning id
$$;
create function pg_temp.result(nid uuid) returns text language sql as $$
  select coalesce(push_result, 'pending') from public.notifications where id = nid
$$;
create temp table taken as select * from public.push_take() limit 0;

-- ---------------------------------------------------------------- due, settled, claimed once
create temp table n (k text primary key, id uuid);
insert into n values ('like', pg_temp.note('owner', 'new_reader', 'reader'));
insert into n values ('fresh', pg_temp.note('owner', 'new_reader', 'outsider', interval '5 seconds'));
insert into n values ('full', pg_temp.note('owner', 'full_jar'));
insert into n values ('notoken', pg_temp.note('outsider', 'new_reader', 'reader'));
insert into n values ('stale', pg_temp.note('reader', 'new_reader', 'outsider', interval '2 days'));

insert into taken select * from public.push_take(interval '60 seconds');
select is((select count(*) from taken), 1::bigint, 'one row is due');
select is((select actor_name || ' ' || array_to_string(tokens, ',') from taken),
          'Reader ExponentPushToken[owner]', 'with the actor''s name and the recipient''s tokens');
select is(pg_temp.result((select id from n where k = 'like')), 'sent', 'it is claimed as sent');
select is(pg_temp.result((select id from n where k = 'fresh')), 'pending', 'a row younger than the settle time waits');
select is(pg_temp.result((select id from n where k = 'full')), 'in_app_only', 'full_jar is never pushed');
select is(pg_temp.result((select id from n where k = 'notoken')), 'no_token', 'nobody to send to');
select is(pg_temp.result((select id from n where k = 'stale')), 'stale', 'a day-old row is not pushed');
select is((select count(*) from public.push_take(interval '60 seconds')), 0::bigint, 'a second run sends nothing twice');

-- ---------------------------------------------------------------- muted
update public.notification_prefs set "like" = false where user_id = tests.id('owner');
insert into n values ('muted', pg_temp.note('owner', 'like', 'reader'));
insert into n values ('notmuted', pg_temp.note('owner', 'comment', 'reader'));
select is((select count(*) from public.push_take(interval '60 seconds')), 1::bigint, 'only the comment is taken');
select is(pg_temp.result((select id from n where k = 'muted')), 'muted', 'a type turned off is muted');

-- ---------------------------------------------------------------- quiet hours
update public.profiles set home_tz = 'Asia/Manila' where id = tests.id('reader');
update public.notification_prefs set quiet_hours = true where user_id = tests.id('reader');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-11 23:30+08'), true, '23:30 local is quiet (22:00–07:00)');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-12 06:59+08'), true, '06:59 local is quiet');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-12 07:00+08'), false, '07:00 local is not');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-11 21:59+08'), false, '21:59 local is not');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-11 15:30+00'), true,
          '15:30 UTC is 23:30 in Manila: the person''s zone decides');
update public.notification_prefs set quiet_start = '09:00', quiet_end = '17:00' where user_id = tests.id('reader');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-12 12:00+08'), true, 'a daytime window works too');
select is(public.in_quiet_hours(tests.id('reader'), '2026-11-12 17:00+08'), false, 'its end is not quiet');

-- A window around now holds the row; turning quiet hours off lets it go.
update public.notification_prefs
set quiet_start = ((now() - interval '1 hour') at time zone 'Asia/Manila')::time,
    quiet_end = ((now() + interval '1 hour') at time zone 'Asia/Manila')::time
where user_id = tests.id('reader');
insert into n values ('quiet', pg_temp.note('reader', 'new_reader', 'owner'));
select is((select count(*) from public.push_take(interval '60 seconds')), 0::bigint, 'nothing goes out in quiet hours');
select is(pg_temp.result((select id from n where k = 'quiet')), 'pending', 'the row waits');
update public.notification_prefs set quiet_hours = false where user_id = tests.id('reader');
select is((select count(*) from public.push_take(interval '60 seconds')), 1::bigint, 'and goes once they end');

-- ---------------------------------------------------------------- friend joined: one a day
insert into n values ('f1', pg_temp.note('reader', 'friend_joined', 'outsider', interval '3 minutes'));
insert into n values ('f2', pg_temp.note('reader', 'friend_joined', 'moderator', interval '2 minutes'));
select is((select count(*) from public.push_take(interval '60 seconds')), 1::bigint, 'one friend_joined push');
select is(pg_temp.result((select id from n where k = 'f1')) || ' ' || pg_temp.result((select id from n where k = 'f2')),
          'sent daily_limit', 'the earlier goes, the later is over the daily limit');
insert into n values ('f3', pg_temp.note('reader', 'friend_joined', 'blocker'));
select is((select count(*) from public.push_take(interval '60 seconds')), 0::bigint,
          'another the same day is not pushed');

-- ---------------------------------------------------------------- retry and receipts
select public.push_retry(array[(select id from n where k = 'f1')]);
select is(pg_temp.result((select id from n where k = 'f1')), 'pending', 'push_retry puts a sent row back');
delete from public.push_tickets; -- function tests leave rows in a shared local database
select public.push_tickets_save(array['t1', 't2'], array['ExponentPushToken[owner]', 'ExponentPushToken[reader]']);
update public.push_tickets set created_at = now() - interval '20 minutes' where ticket_id = 't1';
select is((select array_agg(ticket_id) from public.push_tickets_due()), array['t1'], 'only tickets older than 15 minutes are due');
select is(public.push_receipts_settle(array['t1'], array['ExponentPushToken[owner]']), 1,
          'a DeviceNotRegistered token is deleted');

-- ---------------------------------------------------------------- service role only
select tests.act_as('owner');
select throws_ok($$select * from public.push_take()$$, '42501', null, 'clients cannot take pushes');
select tests.reset_role();

select * from finish();
rollback;
