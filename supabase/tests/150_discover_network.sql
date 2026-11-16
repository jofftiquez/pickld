-- 0150 (AGENTS.md "Product principles", rule 15): Discover goes through the caller's network first, says who
-- connects them ("Read by @name"), leaves out under-18 accounts and people who turned Show me in Discover off,
-- and nothing ranks by reader count. Paging crosses from the network to the rest without repeats or gaps.
begin;
\ir _helpers.psql
select plan(23);

-- viewer reads alpha and friend. Both read fof; friend also reads teen and shy. stranger is outside the network.
select tests.create_user('zviewer');
select tests.create_user('zalpha');
select tests.create_user('zfriend');
select tests.create_user('zfof');
select tests.create_user('zteen');
select tests.create_user('zshy');
select tests.create_user('zstranger');
update public.profiles set birthday = current_date - interval '16 years' where id = tests.id('zteen');
update public.profiles set discoverable = false where id = tests.id('zshy');
insert into public.follows (reader_id, author_id) values
  (tests.id('zviewer'), tests.id('zalpha')),
  (tests.id('zviewer'), tests.id('zfriend')),
  (tests.id('zalpha'), tests.id('zfof')),
  (tests.id('zfriend'), tests.id('zfof')),
  (tests.id('zfriend'), tests.id('zteen')),
  (tests.id('zfriend'), tests.id('zshy'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from t where k = p_k $$;

-- One published Everyone jar with one Everyone moment each. The stranger's is the newest, fof's the oldest.
create function pg_temp.post(who text, ago interval) returns void language plpgsql as $$
declare jid uuid := tests.make_jar(who, 'everyone', published => true);
begin
  insert into t values ('jar_' || who, jid);
  insert into t values ('m_' || who, tests.make_moment(jid, 'morning', 'live', p_visibility => 'everyone'));
  update public.moments set added_at = now() - ago where id = pg_temp.id('m_' || who);
  update public.jars set published_at = now() - ago where id = jid;
end $$;
select pg_temp.post('zstranger', interval '1 minute');
select pg_temp.post('zteen', interval '2 minutes');
select pg_temp.post('zshy', interval '3 minutes');
select pg_temp.post('zfof', interval '1 hour');

-- ---------------------------------------------------------------- schema
select has_column('public', 'profiles', 'discoverable', 'profiles has discoverable');
select col_default_is('public', 'profiles', 'discoverable', 'true', 'everyone starts in Discover');
select ok(not has_function_privilege('authenticated', 'public.discover_via(uuid, uuid)', 'execute'),
          'discover_via is internal');

-- ---------------------------------------------------------------- in_discover
select tests.act_as('zviewer');
select is(public.in_discover(tests.id('zfof')), true, 'an active adult is in Discover');
select is(public.in_discover(tests.id('zteen')), false, 'an under-18 account is not');
select is(public.in_discover(tests.id('zshy')), false, 'someone who turned Show me in Discover off is not');
select tests.act_as('zteen');
select lives_ok($$update public.profiles set discoverable = false where id = auth.uid()$$,
                'the owner can turn Show me in Discover off');
select is((select discoverable from public.my_profile()), false, 'and reads it back');
select lives_ok($$update public.profiles set discoverable = true where id = auth.uid()$$, 'and on again');
select tests.reset_role();

-- ---------------------------------------------------------------- moments
select tests.act_as('zviewer');
select results_eq(
  $$select author_username, in_network, via_username from public.discover_moments_page()
    where author_id in (select id from tests.users where name like 'z%')$$,
  $$values ('t_zfof'::text, true, 't_zalpha'::text), ('t_zstranger', false, null)$$,
  'moments: the network first even when older, named by the first author by username; teen and shy left out');
select tests.reset_role();
-- A block between alpha and fof: alpha no longer connects them, friend does.
insert into public.blocks (blocker_id, blocked_id) values (tests.id('zalpha'), tests.id('zfof'));
select tests.act_as('zviewer');
select is((select via_username from public.discover_moments_page() where author_id = tests.id('zfof')), 't_zfriend',
          'moments: an author blocked with the poster never names them');
select tests.reset_role();
-- A block also ends follows either way (blocks_sync): put alpha's back.
delete from public.blocks where blocker_id = tests.id('zalpha');
insert into public.follows (reader_id, author_id) values (tests.id('zalpha'), tests.id('zfof'));
-- A block between viewer and friend and alpha: fof drops to Beyond your network.
insert into public.blocks (blocker_id, blocked_id) values
  (tests.id('zviewer'), tests.id('zalpha')), (tests.id('zfriend'), tests.id('zviewer'));
select tests.act_as('zviewer');
select is((select in_network::text || '/' || coalesce(via_username, '-') from public.discover_moments_page()
           where author_id = tests.id('zfof')), 'false/-',
          'moments: authors blocked with the caller connect nobody');
select tests.reset_role();
delete from public.blocks where blocker_id in (tests.id('zviewer'), tests.id('zfriend'));
insert into public.follows (reader_id, author_id) values
  (tests.id('zviewer'), tests.id('zalpha')), (tests.id('zviewer'), tests.id('zfriend'));

select tests.act_as('zstranger');
select is((select count(*)::int from public.discover_moments_page()
           where author_id in (tests.id('zteen'), tests.id('zshy'))), 0,
          'moments: teen and shy are left out for strangers too');
select tests.reset_role();

-- ---------------------------------------------------------------- jars
select tests.act_as('zviewer');
select results_eq(
  $$select author_username, in_network, via_username from public.discover_jars_page()
    where author_id in (select id from tests.users where name like 'z%')$$,
  $$values ('t_zfof'::text, true, 't_zalpha'::text), ('t_zstranger', false, null)$$,
  'jars: the network first, teen and shy left out');
select tests.reset_role();

-- ---------------------------------------------------------------- suggestions and search
select tests.act_as('zviewer');
select results_eq($$select username, mutual_count from public.suggested_authors()$$,
                  $$values ('t_zfof'::text, 2)$$,
                  'suggestions: friends of friends in Discover only (not teen, not shy)');
select is((select count(*)::int from public.search_people('t_zteen')), 1, 'search still finds a teen by username');
select is((select count(*)::int from public.search_people('t_zshy')), 1, 'search still finds someone out of Discover');
select tests.reset_role();

-- Two people who match equally well; the one with more readers no longer comes first.
select tests.create_user('zqa');
select tests.create_user('zqb');
update public.profiles set display_name = 'Kiko Zq' where id in (tests.id('zqa'), tests.id('zqb'));
insert into public.follows (reader_id, author_id) values
  (tests.id('zalpha'), tests.id('zqb')), (tests.id('zfriend'), tests.id('zqb')), (tests.id('zfof'), tests.id('zqb'));
select tests.act_as('zviewer');
select is((select array_agg(username) from public.search_people('kiko zq')), array['t_zqa', 't_zqb'],
          'search: equal matches by username, not reader count');
select tests.reset_role();
insert into public.follows (reader_id, author_id) values
  (tests.id('zstranger'), tests.id('zalpha')), (tests.id('zstranger'), tests.id('zfriend'));
select tests.act_as('zstranger');
-- fof (2 readers) and qb (3 readers) both have 2 mutual authors: username decides, not reader count.
select is((select array_agg(username) from public.suggested_authors()), array['t_zfof', 't_zqb'],
          'suggestions: most mutual first, then username, not reader count');
select tests.reset_role();

-- ---------------------------------------------------------------- paging across the boundary
-- 13 network moments (fof) and 13 beyond (stranger), interleaved in time: page 1 holds 13 network then 7 beyond.
delete from public.follows where reader_id = tests.id('zstranger');
create function pg_temp.many(who text, odd int) returns void language plpgsql as $$
declare jid uuid; s slot; n int := 0; d int;
begin
  for d in 1..2 loop
    jid := tests.make_jar(who, 'everyone', published => true, p_days_ago => d);
    foreach s in array enum_range(null::slot) loop
      exit when n >= 13;
      insert into t values (who || n, tests.make_moment(jid, s, 'live', p_visibility => 'everyone'));
      update public.moments set added_at = now() - make_interval(mins => 10 + 2 * n + odd) where id = pg_temp.id(who || n);
      n := n + 1;
    end loop;
  end loop;
end $$;
select pg_temp.many('zfof', 0);
select pg_temp.many('zstranger', 1);

create temp table pg (page int, pos bigint, id uuid, at timestamptz, net boolean);
grant all on pg to authenticated;
select tests.act_as('zviewer');
do $$
declare p int := 1; n int; c_at timestamptz; c_id uuid; c_net boolean;
begin
  loop
    insert into pg select p, f.ordinality, f.moment_id, f.added_at, f.in_network
      from public.discover_moments_page(c_at, c_id, c_net) with ordinality f
      where f.author_id in (select id from tests.users where name like 'z%');
    get diagnostics n = row_count;
    exit when p >= 10 or not exists (select 1 from public.discover_moments_page(c_at, c_id, c_net) offset 19);
    select f.added_at, f.moment_id, f.in_network into c_at, c_id, c_net
      from public.discover_moments_page(c_at, c_id, c_net) f offset 19 limit 1;
    p := p + 1;
  end loop;
end $$;
select is((select count(*)::int from pg where id in (select id from t where k ~ '^z(fof|stranger)[0-9]+$')), 26,
          'paging: every moment of both groups shows up');
select is((select count(*) - count(distinct id) from pg), 0::bigint, 'paging: nothing repeats');
select ok((select bool_and(ok) from (
             select (net, at, id) < lag((net, at, id)) over (order by page, pos) as ok from pg) x),
          'paging: the network first, each part newest first, every page continuing the one before');
select is((select count(*)::int from pg where page = 1 and net), 14, 'paging: page 1 starts with the network (13 + the first fof)');
select tests.reset_role();

select * from finish();
rollback;
