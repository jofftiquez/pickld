-- 0014 (M3-03; FR-SOC-01): feed_page, feed_authors, mark_feed_seen and feed_seen_at.
-- The feed never returns a jar the caller can't view; tried as owner, reader, outsider, blocked user,
-- blocker and anon. Pagination with the (feed_at, jar_id) cursor stays stable when a newer jar arrives.
begin;
\ir _helpers.psql
select plan(53);

select tests.world();
select tests.create_user('author2');  -- reader follows: 25 jars for pagination
select tests.create_user('author3');  -- reader follows: one old jar
select tests.create_user('author4');  -- reader follows: no jars
select tests.create_user('stranger'); -- nobody follows
insert into public.follows (reader_id, author_id) values
  (tests.id('reader'), tests.id('author2')),
  (tests.id('reader'), tests.id('author3')),
  (tests.id('reader'), tests.id('author4')),
  (tests.id('owner'), tests.id('author2'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon;
-- owner's jars (local dates differ: one jar per day)
insert into t values ('j_pub', tests.make_jar('owner', 'readers', published => true));
insert into t values ('j_everyone', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 1));
insert into t values ('j_unpub', tests.make_jar('owner', 'readers', published => false, p_days_ago => 2));
insert into t values ('j_onlyme', tests.make_jar('owner', 'only_me', published => true, p_days_ago => 3));
insert into t values ('j_hidden', tests.make_jar('owner', 'readers', published => true, p_days_ago => 4));
insert into t values ('m_live', tests.make_moment((select id from t where k = 'j_pub'), 'morning', 'live'));
insert into t values ('m_private', tests.make_moment((select id from t where k = 'j_pub'), 'whereami', 'live', true));
insert into t values ('m_checking', tests.make_moment((select id from t where k = 'j_pub'), 'mebusywith', 'checking'));
insert into t values ('m_removed', tests.make_moment((select id from t where k = 'j_pub'), 'whoamiwith', 'removed'));
update public.moments set caption = case id
    when (select id from t where k = 'm_live') then 'shown caption'
    when (select id from t where k = 'm_private') then 'private caption'
    when (select id from t where k = 'm_checking') then 'unchecked caption'
    else 'removed caption' end
  where jar_id = (select id from t where k = 'j_pub');
insert into t values ('m_ev', tests.make_moment((select id from t where k = 'j_everyone'), 'evening', 'live'));
insert into t values ('m_unpub', tests.make_moment((select id from t where k = 'j_unpub'), 'evening', 'live'));
insert into t values ('m_onlyme', tests.make_moment((select id from t where k = 'j_onlyme'), 'evening', 'live'));
insert into t values ('m_h1', tests.make_moment((select id from t where k = 'j_hidden'), 'morning', 'live', true));
insert into t values ('m_h2', tests.make_moment((select id from t where k = 'j_hidden'), 'evening', 'checking'));
-- stranger's and reader's own jars
insert into t values ('s_readers', tests.make_jar('stranger', 'readers', published => true));
insert into t values ('s_everyone', tests.make_jar('stranger', 'everyone', published => true, p_days_ago => 1));
insert into t values ('r_own', tests.make_jar('reader', 'everyone', published => true));
select tests.make_moment(id, 'morning', 'live') from t where k in ('s_readers', 's_everyone', 'r_own');
-- author2: 25 jars, jar a2_i updated i hours ago; author3: one jar 48 hours ago
insert into t select 'a2_' || i, tests.make_jar('author2', 'readers', published => true, p_days_ago => 10 + i)
  from generate_series(1, 25) i;
insert into t values ('a3', tests.make_jar('author3', 'everyone', published => true, p_days_ago => 5));
select tests.make_moment(id, 'morning', 'live') from t where k like 'a2\_%' or k = 'a3';
-- added_at is server time and fixed after insert (moments_bu); backdate it here to order the feed.
alter table public.moments disable trigger moments_bu;
update public.moments m set added_at = now() - h.hours * interval '1 hour'
  from (select id, case when k = 'a3' then 48 else substr(k, 4)::int end as hours
        from t where k like 'a2\_%' or k = 'a3') h
  where m.jar_id = h.id;
alter table public.moments enable trigger moments_bu;
update public.jars j set published_at = (select max(added_at) from public.moments m where m.jar_id = j.id)
  where j.id in (select id from t where k like 'a2\_%' or k = 'a3');
-- Stale follows across a block (blocks_sync and follows_sync normally prevent them): the feed must
-- still hide the owner from both.
alter table public.follows disable trigger follows_ai;
insert into public.follows (reader_id, author_id) values
  (tests.id('blocked'), tests.id('owner')), (tests.id('blocker'), tests.id('owner'));
alter table public.follows enable trigger follows_ai;

create temp table pg (page int, pos bigint, jar_id uuid, feed_at timestamptz);
grant select, insert on pg to authenticated;

-- ---------------------------------------------------------------- schema and grants
select has_column('public', 'profiles', 'feed_seen_at', 'profiles has feed_seen_at');
select tests.act_as_anon();
select throws_ok($$select * from public.feed_page()$$, '42501', null, 'anon cannot call feed_page');
select throws_ok($$select * from public.feed_authors()$$, '42501', null, 'anon cannot call feed_authors');
select throws_ok($$select public.mark_feed_seen()$$, '42501', null, 'anon cannot call mark_feed_seen');

-- ---------------------------------------------------------------- reader: what is in the feed
select tests.act_as('reader');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'j_pub')), 1::bigint,
          'reader sees a followed author''s published readers jar');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'j_everyone')), 1::bigint,
          'reader sees a followed author''s published everyone jar');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'j_unpub')), 0::bigint,
          'reader does not see an unpublished jar');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'j_onlyme')), 0::bigint,
          'reader does not see an only_me jar');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'j_hidden')), 0::bigint,
          'reader does not see a jar with only private or unchecked moments');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 's_readers')), 0::bigint,
          'reader does not see a readers jar of an author they don''t read');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 's_everyone')), 0::bigint,
          'reader does not see an everyone jar of an author they don''t read');
select is((select count(*) from public.feed_page() where author_id = tests.id('reader')), 0::bigint,
          'reader does not see their own jar');
select is((select preview_thumb_paths from public.feed_page() where jar_id = (select id from t where k = 'j_pub')),
          (select array[thumb_path] from public.moments where id = (select id from t where k = 'm_live')),
          'previews hold only live, non-private thumbnails');
select is((select preview_moment_ids from public.feed_page() where jar_id = (select id from t where k = 'j_pub')),
          array[(select id from t where k = 'm_live')], 'preview ids hold only live, non-private moments');
select is((select visible_count from public.feed_page() where jar_id = (select id from t where k = 'j_pub')), 1,
          'visible_count counts only live, non-private moments');
select is((select last_caption from public.feed_page() where jar_id = (select id from t where k = 'j_pub')),
          'shown caption', 'last_caption comes only from live, non-private moments');
select is((select author_username || '/' || author_display_name from public.feed_page()
           where jar_id = (select id from t where k = 'j_pub')), 't_owner/Owner', 'author fields come along');
select is((select visibility::text || '/' || local_date::text from public.feed_page()
           where jar_id = (select id from t where k = 'j_everyone')),
          'everyone/' || ((now() at time zone 'Asia/Manila')::date - 1)::text, 'visibility and local date come along');
select is((select count(*) from public.feed_page()), 20::bigint, 'a page holds 20 jars');

-- ---------------------------------------------------------------- others
select tests.act_as('outsider');
select is((select count(*) from public.feed_page()), 0::bigint, 'outsider (reads nobody) has an empty feed');
select is((select count(*) from public.feed_authors()), 0::bigint, 'outsider has no avatar row');
select tests.act_as('blocked');
select is((select count(*) from public.feed_page() where author_id = tests.id('owner')), 0::bigint,
          'blocked user never sees the owner''s jars, even with a stale follow');
select is((select count(*) from public.feed_authors() where author_id = tests.id('owner')), 0::bigint,
          'blocked user never sees the owner in the avatar row');
select tests.act_as('blocker');
select is((select count(*) from public.feed_page() where author_id = tests.id('owner')), 0::bigint,
          'blocker never sees the owner''s jars, even with a stale follow');
select is((select count(*) from public.feed_authors() where author_id = tests.id('owner')), 0::bigint,
          'blocker never sees the owner in the avatar row');
select tests.act_as('owner');
select ok((select count(*) from public.feed_page()) > 0, 'owner sees the jars of authors they read');
select is((select count(*) from public.feed_page() where author_id = tests.id('owner')), 0::bigint,
          'owner never sees their own jars in the feed');
select is((select count(*) from public.feed_page() where author_id <> tests.id('author2')), 0::bigint,
          'owner sees only the authors they read');

-- ---------------------------------------------------------------- pagination
select tests.act_as('reader');
select throws_ok($$select * from public.feed_page(now(), null)$$, '22023', null, 'cursor_at needs cursor_id');
insert into pg select 1, f.ordinality, f.jar_id, f.feed_at from public.feed_page() with ordinality f;
select is((select count(*) from pg where page = 1), 20::bigint, 'page 1 has 20 jars');
select ok((select bool_and(ok) from (
             select (feed_at, jar_id) < lag((feed_at, jar_id)) over (order by pos) as ok from pg where page = 1) x),
          'page 1 is ordered by feed_at desc, then jar id desc');
select is((select array_agg(jar_id order by jar_id) from pg where page = 1 and pos <= 2),
          (select array_agg(id order by id) from t where k in ('j_pub', 'j_everyone')),
          'the newest updates come first');
select is((select array_agg(jar_id order by pos) from pg where page = 1 and pos between 3 and 20),
          (select array_agg(id order by substr(k, 4)::int) from t where k like 'a2\_%' and substr(k, 4)::int <= 18),
          'then older updates in order');

-- A newer jar arrives between pages.
select tests.reset_role();
insert into t values ('a2_new', tests.make_jar('author2', 'readers', published => true, p_days_ago => 60));
select tests.make_moment((select id from t where k = 'a2_new'), 'morning', 'live');
select tests.act_as('reader');
insert into pg select 2, f.ordinality, f.jar_id, f.feed_at
  from pg last, public.feed_page(last.feed_at, last.jar_id) with ordinality f
  where last.page = 1 and last.pos = 20;
select is((select count(*) from pg where page = 2), 8::bigint, 'page 2 has the remaining 8 jars');
select is((select count(*) from pg a join pg b on a.jar_id = b.jar_id where a.page = 1 and b.page = 2), 0::bigint,
          'no jar repeats across pages');
select is((select array_agg(jar_id order by jar_id) from pg),
          (select array_agg(id order by id) from t where k in ('j_pub', 'j_everyone', 'a3') or k ~ '^a2_[0-9]+$'),
          'together the pages hold every feed jar, none skipped');
select is((select count(*) from pg where jar_id = (select id from t where k = 'a2_new')), 0::bigint,
          'the newer jar does not shift into later pages');
select is((select count(*) from pg last, public.feed_page(last.feed_at, last.jar_id) where last.page = 2 and last.pos = 8),
          0::bigint, 'the page after the last is empty');
select is((select count(*) from public.feed_page() where jar_id = (select id from t where k = 'a2_new')), 1::bigint,
          'a fresh first page shows the newer jar');

-- ---------------------------------------------------------------- feed_seen_at and new flags
select is((select count(*) from public.feed_page() where not is_new), 0::bigint,
          'before the feed was ever opened every jar is new');
select is((select string_agg(u.name || ':' || f.has_new, ',' order by u.name)
           from public.feed_authors() f join tests.users u on u.id = f.author_id),
          'author2:true,author3:true,author4:false,owner:true',
          'avatar row: every author the reader reads; authors without a jar are never new');
select throws_ok($$update public.profiles set feed_seen_at = now() where id = auth.uid()$$, '42501', null,
                 'the owner cannot set feed_seen_at directly');
select is(public.mark_feed_seen(), now(), 'mark_feed_seen uses the server clock');
select tests.reset_role();
select is((select feed_seen_at from public.profiles where id = tests.id('reader')), now(), 'feed_seen_at is stored');
select tests.act_as('reader');
select is((select feed_seen_at from public.my_profile()), now(), 'the owner reads feed_seen_at through my_profile');
select is((select count(*) from public.feed_page() where is_new), 0::bigint, 'after marking, nothing is new');
select is((select count(*) from public.feed_authors() where has_new), 0::bigint, 'after marking, no avatar has a ring');
select tests.act_as('outsider');
select throws_ok($$select feed_seen_at from public.profiles where id = tests.id('reader')$$, '42501', null,
                 'others cannot read feed_seen_at');
select lives_ok($$select public.mark_feed_seen()$$, 'outsider marks their own feed');
select tests.reset_role();
-- The reader last looked 5 hours 30 minutes ago.
update public.profiles set feed_seen_at = now() - interval '5 hours 30 minutes' where id = tests.id('reader');
select tests.act_as('reader');
select is((select count(*) from public.feed_page() where is_new), 8::bigint,
          'jars updated since feed_seen_at are new (3 now, 5 within the last 5 hours)');
select is((select string_agg(u.name || ':' || f.has_new, ',' order by f.ordinality)
           from public.feed_authors() with ordinality f join tests.users u on u.id = f.author_id),
          'author2:true,owner:true,author3:false,author4:false',
          'avatar row: authors with a new jar first, then by latest update');

-- ---------------------------------------------------------------- suspended author (D-11)
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('owner');
select tests.act_as('reader');
select is((select count(*) from public.feed_page() where author_id = tests.id('owner')), 0::bigint,
          'a suspended author''s jars leave the feed');
select is((select count(*) from public.feed_authors() where author_id = tests.id('owner')), 0::bigint,
          'a suspended author leaves the avatar row');

select * from finish();
rollback;
