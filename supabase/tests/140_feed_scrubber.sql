-- 0140 (FR-SOC-01): the date scrubber's functions on the Moments and Jars timelines.
-- moments_feed_days and feed_days count exactly what moments_feed_page and feed_page show, per day in the
-- caller's zone; moments_feed_page_newer and feed_page_newer page back up through exactly the same rows. Both
-- are checked against a full walk of the existing pages as owner, reader, outsider, blocked user, blocker and
-- moderator, so a moment or jar someone can't see never shows up in a count or a newer page.
begin;
\ir _helpers.psql
select plan(48);

select tests.world();
select tests.create_user('author2');  -- reader follows: 25 moments and jars over five days, for paging
insert into public.follows (reader_id, author_id) values (tests.id('reader'), tests.id('author2'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;

-- ---------------------------------------------------------------- schema
select ok(not has_function_privilege('anon', 'public.moments_feed_days(text)', 'execute'), 'anon cannot call moments_feed_days');
select ok(has_function_privilege('authenticated', 'public.moments_feed_days(text)', 'execute'), 'signed-in users can call moments_feed_days');
select ok(not has_function_privilege('anon', 'public.feed_days(text)', 'execute'), 'anon cannot call feed_days');
select ok(has_function_privilege('authenticated', 'public.feed_days(text)', 'execute'), 'signed-in users can call feed_days');
select ok(not has_function_privilege('anon', 'public.moments_feed_page_newer(timestamptz, uuid)', 'execute'),
          'anon cannot call moments_feed_page_newer');
select ok(has_function_privilege('authenticated', 'public.moments_feed_page_newer(timestamptz, uuid)', 'execute'),
          'signed-in users can call moments_feed_page_newer');
select ok(not has_function_privilege('anon', 'public.feed_page_newer(timestamptz, uuid)', 'execute'), 'anon cannot call feed_page_newer');
select ok(has_function_privilege('authenticated', 'public.feed_page_newer(timestamptz, uuid)', 'execute'),
          'signed-in users can call feed_page_newer');

-- ---------------------------------------------------------------- data
-- The owner: a published and an unpublished jar with every visibility and status the pages filter on.
insert into t values ('jar_pub', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('jar_unpub', tests.make_jar('owner', 'readers', published => false));
select tests.make_moment((select id from t where k = 'jar_pub'), 'morning', 'live', p_visibility => 'readers');
select tests.make_moment((select id from t where k = 'jar_pub'), 'afternoon', 'live', p_visibility => 'everyone');
select tests.make_moment((select id from t where k = 'jar_pub'), 'evening', 'live', p_visibility => 'only_me');
select tests.make_moment((select id from t where k = 'jar_pub'), 'selfie', 'checking', p_visibility => 'everyone');
select tests.make_moment((select id from t where k = 'jar_pub'), 'whereami', 'removed', p_visibility => 'everyone');
insert into t values ('hidden', tests.make_moment((select id from t where k = 'jar_pub'), 'ootd', 'live', p_visibility => 'everyone'));
update public.moments set hidden_at = now() where id = (select id from t where k = 'hidden');
select tests.make_moment((select id from t where k = 'jar_unpub'), 'morning', 'live', p_visibility => 'readers');
select tests.make_moment((select id from t where k = 'jar_unpub'), 'evening', 'live', p_visibility => 'only_me');
-- An owner-only jar on day X (UTC): added 20:00 UTC, which is X + 1 in Manila.
insert into t values ('jar_x', tests.make_jar('owner', 'only_me', published => true, p_days_ago => 30));
insert into t values ('m_x', tests.make_moment((select id from t where k = 'jar_x'), 'morning', 'live'));

-- author2: jar and moment i added i × 5 hours ago, so several share a day (one jar per date, so the jars'
-- own dates are spread out; the timelines sort by added_at and feed_at).
insert into t select 'a2_' || i, tests.make_jar('author2', 'readers', published => true, p_days_ago => 10 + i)
  from generate_series(1, 25) i;
insert into t select 'm2_' || substr(k, 4), tests.make_moment(id, 'morning', 'live', p_visibility => 'readers')
  from t where k like 'a2\_%';
-- added_at is server time and fixed after insert (moments_bu); backdate it here to order the timelines.
alter table public.moments disable trigger moments_bu;
update public.moments m set added_at = now() - substr(t.k, 4)::int * interval '5 hours'
  from t where t.k like 'm2\_%' and m.id = t.id;
update public.moments set added_at = (((now() at time zone 'UTC')::date - 30)::timestamp + interval '20 hours') at time zone 'UTC'
  where id = (select id from t where k = 'm_x');
alter table public.moments enable trigger moments_bu;
update public.jars j set published_at = (select max(added_at) from public.moments m where m.jar_id = j.id)
  where j.id in (select id from t where k like 'a2\_%' or k = 'jar_x');

-- ---------------------------------------------------------------- walks
-- Every row `fn` returns for `who`, following its cursor from (c_at, c_id) until a short page, in order.
create function pg_temp.walk(who text, fn text, c_at timestamptz default null, c_id uuid default null)
returns table (pos int, id uuid, at timestamptz) language plpgsql as $$
declare
  ids uuid[] := '{}';
  ats timestamptz[] := '{}';
  r record;
  got int;
  q text := case when fn like 'moments%' then format('select moment_id as id, added_at as at from public.%I($1, $2)', fn)
                 else format('select jar_id as id, feed_at as at from public.%I($1, $2)', fn) end;
begin
  perform tests.act_as(who);
  loop
    got := 0;
    for r in execute q using c_at, c_id loop
      ids := ids || r.id;
      ats := ats || r.at;
      c_at := r.at;
      c_id := r.id;
      got := got + 1;
    end loop;
    exit when got < 20;
  end loop;
  perform tests.reset_role();
  return query select o::int, u.i, u.a from unnest(ids, ats) with ordinality u(i, a, o);
end $$;

create function pg_temp.days(who text, fn text, tz text) returns text language plpgsql as $$
declare r text;
begin
  perform tests.act_as(who);
  execute format('select string_agg(day || '':'' || n, '','' order by day desc) from public.%I($1)', fn) into r using tz;
  perform tests.reset_role();
  return r;
end $$;

create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5), ('moderator', 6);

-- ---------------------------------------------------------------- days match the pages
select is(pg_temp.days(r.role, 'moments_feed_days', 'Asia/Manila'),
          (select string_agg(d || ':' || n, ',' order by d desc)
           from (select (w.at at time zone 'Asia/Manila')::date d, count(*) n from pg_temp.walk(r.role, 'moments_feed_page') w group by 1) x),
          format('moments_feed_days: %s counts exactly the moments the timeline shows them, per Manila day', r.role))
from roles r order by r.ord;
select is(pg_temp.days(r.role, 'feed_days', 'Asia/Manila'),
          (select string_agg(d || ':' || n, ',' order by d desc)
           from (select (w.at at time zone 'Asia/Manila')::date d, count(*) n from pg_temp.walk(r.role, 'feed_page') w group by 1) x),
          format('feed_days: %s counts exactly the jars the timeline shows them, per Manila day', r.role))
from roles r order by r.ord;
select ok((select count(*) from pg_temp.walk('reader', 'moments_feed_page')) > 20, 'the reader''s timeline spans pages');
select ok((select count(*) from pg_temp.walk('reader', 'feed_page')) > 20, 'the reader''s jars span pages');

-- ---------------------------------------------------------------- the caller's zone decides the day
select ok(pg_temp.days('owner', 'moments_feed_days', 'UTC') ~ (((now() at time zone 'UTC')::date - 30)::text || ':1'),
          'a moment added 20:00 UTC counts on that day in UTC');
select ok(pg_temp.days('owner', 'moments_feed_days', 'Asia/Manila') ~ (((now() at time zone 'UTC')::date - 29)::text || ':1')
          and pg_temp.days('owner', 'moments_feed_days', 'Asia/Manila') !~ (((now() at time zone 'UTC')::date - 30)::text || ':'),
          'and on the next day in Manila');

select tests.act_as('owner');
select throws_ok($$ select * from public.moments_feed_days('Mars/Olympus') $$, '22023', 'unknown time zone',
                 'moments_feed_days refuses an unknown zone');
select throws_ok($$ select * from public.moments_feed_days('+08:00') $$, '22023', 'unknown time zone',
                 'moments_feed_days refuses an offset (rule 7)');
select throws_ok($$ select * from public.feed_days('Mars/Olympus') $$, '22023', 'unknown time zone',
                 'feed_days refuses an unknown zone');
select throws_ok($$ select * from public.feed_days(null) $$, '22023', 'unknown time zone', 'feed_days refuses no zone');
select throws_ok($$ select * from public.moments_feed_page_newer(null, null) $$, '22023', 'a cursor is required',
                 'moments_feed_page_newer needs a cursor');
select throws_ok($$ select * from public.feed_page_newer(now(), null) $$, '22023', 'a cursor is required',
                 'feed_page_newer needs a whole cursor');
select tests.reset_role();

-- ---------------------------------------------------------------- newer pages walk back up the same rows
-- From the bottom row up, the newer pages give every row above it, nearest first: the down walk reversed.
select is((select array_agg(u.id order by u.pos)
           from (select * from pg_temp.walk(r.role, 'moments_feed_page') order by pos desc limit 1) b,
                pg_temp.walk(r.role, 'moments_feed_page_newer', b.at, b.id) u),
          (select array_agg(d.id order by d.pos desc) from pg_temp.walk(r.role, 'moments_feed_page') d
           where d.pos < (select max(pos) from pg_temp.walk(r.role, 'moments_feed_page'))),
          format('moments_feed_page_newer: %s pages back up through exactly the timeline''s moments', r.role))
from roles r order by r.ord;
select is((select array_agg(u.id order by u.pos)
           from (select * from pg_temp.walk(r.role, 'feed_page') order by pos desc limit 1) b,
                pg_temp.walk(r.role, 'feed_page_newer', b.at, b.id) u),
          (select array_agg(d.id order by d.pos desc) from pg_temp.walk(r.role, 'feed_page') d
           where d.pos < (select max(pos) from pg_temp.walk(r.role, 'feed_page'))),
          format('feed_page_newer: %s pages back up through exactly the timeline''s jars', r.role))
from roles r order by r.ord;

create temp table w (kind text, pos int, id uuid, at timestamptz);
grant select on w to authenticated;
insert into w select 'm', * from pg_temp.walk('reader', 'moments_feed_page');
insert into w select 'j', * from pg_temp.walk('reader', 'feed_page');
select tests.act_as('reader');
select is((select array_agg(f.moment_id order by o) from w, public.moments_feed_page_newer(w.at, w.id) with ordinality f(moment_id, jar_id, author_id, author_username, author_display_name, author_avatar_path, slot, caption, captured_at, added_at, is_backfilled, visibility, edits, like_count, liked, comment_count, jar_tz, jar_local_date, jar_visible, o)
           where w.kind = 'm' and w.pos = 25),
          (select array_agg(id order by pos desc) from w where kind = 'm' and pos between 5 and 24),
          'one newer moments page from row 25 is rows 24 to 5, nearest first');
select is((select array_agg(f.jar_id order by o) from w, public.feed_page_newer(w.at, w.id) with ordinality f(jar_id, author_id, author_username, author_display_name, author_avatar_path, local_date, visibility, published_at, feed_at, visible_count, like_count, comment_count, preview_moment_ids, preview_thumb_paths, last_caption, is_new, cover_moment_id, o)
           where w.kind = 'j' and w.pos = 23),
          (select array_agg(id order by pos desc) from w where kind = 'j' and pos between 3 and 22),
          'one newer jars page from row 23 is rows 22 to 3, nearest first');
select is((select count(*) from w, public.moments_feed_page_newer(w.at, w.id) where w.kind = 'm' and w.pos = 1), 0::bigint,
          'nothing is newer than the newest moment');
select is((select count(*) from w, public.feed_page_newer(w.at, w.id) where w.kind = 'j' and w.pos = 1), 0::bigint,
          'nothing is newer than the newest jar');

-- ---------------------------------------------------------------- jumping to a day
-- The app's anchor: the next day's Manila midnight with the largest id starts the older pages at that day.
select is((select (f.added_at at time zone 'Asia/Manila')::date
           from public.moments_feed_page(((((now() - interval '50 hours') at time zone 'Asia/Manila')::date + 1)::timestamp) at time zone 'Asia/Manila',
                                         'ffffffff-ffff-ffff-ffff-ffffffffffff') f limit 1),
          (select max((at at time zone 'Asia/Manila')::date) from w
           where kind = 'm' and (at at time zone 'Asia/Manila')::date <= ((now() - interval '50 hours') at time zone 'Asia/Manila')::date),
          'a moments page anchored after a day starts with that day''s newest moment');
select is((select (f.feed_at at time zone 'Asia/Manila')::date
           from public.feed_page(((((now() - interval '50 hours') at time zone 'Asia/Manila')::date + 1)::timestamp) at time zone 'Asia/Manila',
                                 'ffffffff-ffff-ffff-ffff-ffffffffffff') f limit 1),
          (select max((at at time zone 'Asia/Manila')::date) from w
           where kind = 'j' and (at at time zone 'Asia/Manila')::date <= ((now() - interval '50 hours') at time zone 'Asia/Manila')::date),
          'a jars page anchored after a day starts with that day''s newest jar');
select tests.reset_role();

select * from finish();
rollback;
