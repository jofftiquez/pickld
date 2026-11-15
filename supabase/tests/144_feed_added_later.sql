-- 0144 (FR-SOC-01, FR-SOC-03): feed_page, feed_page_newer and discover_jars_page say when a jar holds a moment
-- added after its day ended (added_later), over exactly the moments that viewer sees: an Only me backfill marks
-- only its owner's card (rule 9). The re-created functions keep anon out.
begin;
\ir _helpers.psql
select plan(14);

select tests.world();

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;

-- ---------------------------------------------------------------- schema
select ok(not has_function_privilege('anon', 'public.feed_page(timestamptz, uuid)', 'execute'), 'anon cannot call feed_page');
select ok(has_function_privilege('authenticated', 'public.feed_page(timestamptz, uuid)', 'execute'), 'signed-in users can call feed_page');
select ok(not has_function_privilege('anon', 'public.feed_page_newer(timestamptz, uuid)', 'execute'), 'anon cannot call feed_page_newer');
select ok(has_function_privilege('authenticated', 'public.feed_page_newer(timestamptz, uuid)', 'execute'),
          'signed-in users can call feed_page_newer');
select ok(not has_function_privilege('anon', 'public.discover_jars_page(timestamptz, uuid)', 'execute'),
          'anon cannot call discover_jars_page');
select ok(has_function_privilege('authenticated', 'public.discover_jars_page(timestamptz, uuid)', 'execute'),
          'signed-in users can call discover_jars_page');

-- ---------------------------------------------------------------- data
-- A jar 30 days back, published today: its moments go in after its day ended, so the server marks them.
insert into t values ('old', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 30));
select tests.make_moment((select id from t where k = 'old'), 'morning', 'live', p_visibility => 'everyone');
-- Today's jar: nothing added later.
insert into t values ('today', tests.make_jar('owner', 'everyone', published => true));
select tests.make_moment((select id from t where k = 'today'), 'morning', 'live', p_visibility => 'everyone');
-- A past jar whose only backfill is Only me: the Readers moment is set back to on time below.
insert into t values ('priv', tests.make_jar('owner', 'readers', published => true, p_days_ago => 40));
insert into t values ('priv_on_time', tests.make_moment((select id from t where k = 'priv'), 'morning', 'live', p_visibility => 'readers'));
select tests.make_moment((select id from t where k = 'priv'), 'evening', 'live', p_visibility => 'only_me');
alter table public.moments disable trigger moments_bu;
update public.moments set is_backfilled = false where id = (select id from t where k = 'priv_on_time');
alter table public.moments enable trigger moments_bu;

select is((select bool_and(is_backfilled) from public.moments where jar_id = (select id from t where k = 'old')), true,
          'the server marks moments of a past jar as added later');

-- ---------------------------------------------------------------- feed_page
select tests.act_as('owner');
select is((select string_agg(case f.jar_id when (select id from t where k = 'old') then 'old'
                                           when (select id from t where k = 'today') then 'today'
                                           else 'priv' end || '=' || f.added_later, ',' order by f.local_date)
           from public.feed_page() f),
          'priv=true,old=true,today=false',
          'owner: a past jar is added later, today''s is not, and their own Only me backfill counts');
select tests.act_as('reader');
select is((select f.added_later from public.feed_page() f where f.jar_id = (select id from t where k = 'old')), true,
          'reader: the past jar is added later');
select is((select f.added_later from public.feed_page() f where f.jar_id = (select id from t where k = 'today')), false,
          'reader: today''s jar is not');
select is((select f.added_later from public.feed_page() f where f.jar_id = (select id from t where k = 'priv')), false,
          'reader: an Only me backfill they can''t see doesn''t mark the jar');

-- ---------------------------------------------------------------- feed_page_newer
select is((select string_agg(f.added_later::text, ',' order by f.local_date)
           from public.feed_page_newer('-infinity', '00000000-0000-0000-0000-000000000000') f),
          'false,true,false',
          'reader, the other way: the same flags as feed_page');

-- ---------------------------------------------------------------- discover_jars_page
select tests.act_as('outsider');
select is((select d.added_later from public.discover_jars_page() d where d.jar_id = (select id from t where k = 'old')), true,
          'Discover: the past Everyone jar is added later');
select is((select d.added_later from public.discover_jars_page() d where d.jar_id = (select id from t where k = 'today')), false,
          'Discover: today''s Everyone jar is not');

select * from finish();
rollback;
