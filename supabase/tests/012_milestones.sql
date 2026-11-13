-- M2-27 (0010): milestones, the Milestones pack and the full-jar notification are granted by the database,
-- once each, counting only jars with moments (FR-STK-05, FR-JAR-07, FR-JAR-08; D-8, D-9).
begin;
\ir _helpers.psql
select plan(38);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;

-- n moments in the first n slots of a jar (status checking: the owner's count includes it, D-9).
create function pg_temp.fill(p_jar uuid, n int) returns void language sql as $$
  select tests.make_moment(p_jar, s, 'checking') from unnest((enum_range(null::slot))[1:n]) s
$$;
-- p_count jars for p_owner, p_from to p_from + p_count - 1 days ago, each with p_moments moments.
create function pg_temp.jars(p_owner text, p_from int, p_count int, p_moments int) returns void language sql as $$
  select pg_temp.fill(tests.make_jar(p_owner, p_days_ago => d), p_moments) from generate_series(p_from, p_from + p_count - 1) d
$$;
create function pg_temp.keys(p_user text) returns text[] language sql as $$
  select coalesce(array_agg(key order by key), '{}') from public.milestones where user_id = tests.id(p_user)
$$;
create function pg_temp.has_pack(p_user text) returns boolean language sql as $$
  select exists (select 1 from public.owned_packs o join public.sticker_packs p on p.id = o.pack_id
                 where o.user_id = tests.id(p_user) and p.slug = 'milestones' and o.source = 'earned')
$$;
create function pg_temp.full_notes(p_jar uuid) returns int language sql as $$
  select count(*)::int from public.notifications where jar_id = p_jar and type = 'full_jar'
$$;

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('authenticated', 'public.grant_milestones(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.grant_milestones(uuid)', 'execute'),
          'clients cannot call grant_milestones');
select ok(not has_table_privilege('authenticated', 'public.milestones', 'insert')
          and not has_table_privilege('authenticated', 'public.owned_packs', 'insert'),
          'clients have no insert privilege on milestones or owned_packs');

-- ---------------------------------------------------------------- first full jar
insert into t values ('today', tests.make_jar('owner'));
select pg_temp.fill((select id from t where k = 'today'), 7);
select is(pg_temp.keys('owner'), '{}'::text[], '7 of 8 grants nothing');
select ok(not pg_temp.has_pack('owner'), 'no Milestones pack yet');
select is(pg_temp.full_notes((select id from t where k = 'today')), 0, 'no full-jar notification at 7');

select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, status) select id, auth.uid(), 'evening', 'checking' from t where k = 'today';
select tests.reset_role();
select is(pg_temp.keys('owner'), array['first_full_jar'], 'the 8th moment (added by the owner) grants first_full_jar');
select ok(pg_temp.has_pack('owner'), 'and the Milestones pack, as earned');
select is(pg_temp.full_notes((select id from t where k = 'today')), 1, 'and one full_jar notification for that jar');
select is((select user_id from public.notifications where jar_id = (select id from t where k = 'today') and type = 'full_jar'),
          tests.id('owner'), 'the notification goes to the owner');
create temp table first_at as select achieved_at from public.milestones where user_id = tests.id('owner') and key = 'first_full_jar';

-- Dropping below 8 and filling again: still once.
select tests.act_as('owner');
delete from public.moments where jar_id = (select id from t where k = 'today') and slot = 'evening';
select tests.reset_role();
select is((select moment_count::int from public.jars where id = (select id from t where k = 'today')), 7, 'the jar is back to 7');
select is(pg_temp.keys('owner'), array['first_full_jar'], 'a milestone is not revoked when the jar drops below 8');
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, status) select id, auth.uid(), 'evening', 'checking' from t where k = 'today';
select tests.reset_role();
select is(pg_temp.full_notes((select id from t where k = 'today')), 1, 'refilling the same jar writes no second notification');
select is((select count(*)::int from public.milestones where user_id = tests.id('owner') and key = 'first_full_jar'), 1,
          'first_full_jar is granted once');
select is((select achieved_at from public.milestones where user_id = tests.id('owner') and key = 'first_full_jar'),
          (select achieved_at from first_at), 'and keeps its first achieved_at');
select is((select count(*)::int from public.owned_packs where user_id = tests.id('owner')), 1, 'the pack is owned once');

-- ---------------------------------------------------------------- removed moments don't fill a jar
insert into t values ('with_removed', tests.make_jar('owner', p_days_ago => 1));
-- 6 moments, one removed, then a 7th: 8 slots used, but only 7 count.
select pg_temp.fill((select id from t where k = 'with_removed'), 6);
select tests.make_moment((select id from t where k = 'with_removed'), 'afternoon', 'removed');
select tests.make_moment((select id from t where k = 'with_removed'), 'evening', 'checking');
select is((select moment_count::int || '/' || is_full from public.jars where id = (select id from t where k = 'with_removed')), '7/false',
          'a removed moment does not count toward a full jar');
select is(pg_temp.full_notes((select id from t where k = 'with_removed')), 0, 'so there is no full-jar notification');

-- ---------------------------------------------------------------- 7 full jars
select pg_temp.jars('owner', 2, 5, 8);  -- 6 full jars now
select is(pg_temp.keys('owner'), array['first_full_jar', 'jars_7'], '6 full jars: no full_jars_7 yet (7 jars with moments: jars_7, 0060)');
delete from public.moments where jar_id = (select id from t where k = 'with_removed') and slot = 'afternoon';  -- frees the slot
select tests.make_moment((select id from t where k = 'with_removed'), 'afternoon', 'live');
select is((select moment_count::int from public.jars where id = (select id from t where k = 'with_removed')), 8, 'the 7th jar fills');
select is(pg_temp.keys('owner'), array['first_full_jar', 'full_jars_7', 'jars_7'], '7 full jars grants full_jars_7');
select is((select count(*)::int from public.notifications where user_id = tests.id('owner') and type = 'full_jar'), 7,
          'one full_jar notification per full jar');

-- ---------------------------------------------------------------- jar counts include only jars with moments (FR-JAR-08)
-- 7 jars with moments so far. 22 more with one moment = 29; 5 empty jars must not make it 30.
select pg_temp.jars('owner', 10, 22, 1);
select pg_temp.jars('owner', 40, 5, 0);
select is((select count(*)::int from public.jars where user_id = tests.id('owner')), 34, '34 jars exist');
select is((select jar_count from public.profiles where id = tests.id('owner')), 29, 'jar_count is 29 (only jars with moments)');
select ok(not ('jars_30' = any (pg_temp.keys('owner'))), 'empty jars do not count toward 30 jars');
select tests.make_moment((select id from public.jars where user_id = tests.id('owner') and moment_count = 0 order by local_date limit 1),
                         'morning', 'checking');
select ok('jars_30' = any (pg_temp.keys('owner')), 'the first moment in an empty jar makes it the 30th: jars_30');

-- ---------------------------------------------------------------- 100 jars and 1 year (365 jars)
select pg_temp.jars('owner', 100, 69, 1);  -- 99
select ok(not ('jars_100' = any (pg_temp.keys('owner'))), '99 jars: no jars_100');
select pg_temp.jars('owner', 169, 1, 1);   -- 100
select ok('jars_100' = any (pg_temp.keys('owner')), '100 jars grants jars_100');
select pg_temp.jars('owner', 170, 264, 1); -- 364
select ok(not ('one_year' = any (pg_temp.keys('owner'))), '364 jars: no one_year');
select pg_temp.jars('owner', 434, 1, 1);   -- 365
select is(pg_temp.keys('owner'), array['first_full_jar', 'full_jars_7', 'jars_100', 'jars_200', 'jars_30', 'jars_50', 'jars_7', 'one_year'],
          '365 jars grants one_year: every jar-count milestone (0060 adds jars_7, jars_50, jars_200), each once');

-- ---------------------------------------------------------------- others
-- The reader fills their own jar: their milestone, not the owner's, and the owner's rows stay hidden.
insert into t values ('reader_jar', tests.make_jar('reader'));
select pg_temp.fill((select id from t where k = 'reader_jar'), 8);
select is(pg_temp.keys('reader'), array['first_full_jar'], 'the reader earns their own first_full_jar');
select tests.act_as('reader');
select is((select count(*)::int from public.milestones where user_id <> auth.uid()), 0, 'a reader cannot see the owner''s milestones');
select is((select count(*)::int from public.notifications where user_id <> auth.uid()), 0, 'or the owner''s notifications');
select throws_ok($$insert into public.milestones (user_id, key) values (auth.uid(), 'jars_100')$$, '42501', null,
                 'a reader cannot grant themselves a milestone');
select tests.act_as('outsider');
select is((select count(*)::int from public.milestones) + (select count(*)::int from public.owned_packs), 0,
          'an outsider sees no milestones or owned packs');
select throws_ok($$insert into public.owned_packs (user_id, pack_id, source)
                   select auth.uid(), id, 'earned' from public.sticker_packs where slug = 'milestones'$$, '42501', null,
                 'an outsider cannot grant themselves the Milestones pack');
select tests.act_as('blocked');
select is((select count(*)::int from public.milestones) + (select count(*)::int from public.notifications where type = 'full_jar'), 0,
          'the blocked user sees none of the owner''s milestones or full-jar notifications');
select throws_ok($$select public.grant_milestones(auth.uid())$$, '42501', null, 'the blocked user cannot call grant_milestones');
select tests.act_as('owner');
select is((select array_agg(key order by key) from public.milestones),
          array['first_full_jar', 'full_jars_7', 'jars_100', 'jars_200', 'jars_30', 'jars_50', 'jars_7', 'one_year'], 'the owner reads their own milestones');

select * from finish();
rollback;
