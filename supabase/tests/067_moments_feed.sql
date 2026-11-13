-- 0067 (QA round 1, piece 5; D-48, D-53, D-67; FR-SOC-01, FR-SOC-02): moments_feed_page, the Moments timeline,
-- and moment_jar, the jar fields Moment detail needs for a moment whose jar the caller can't open.
-- The timeline never returns a moment the caller can't view: each visibility (Readers, Everyone, Only me),
-- in a published and an unpublished jar, tried as owner, reader, outsider, blocked user, blocker and
-- moderator; checking, removed and hidden moments stay out. The owner sees their own moments, Only me
-- included. Pagination with the (added_at, moment_id) cursor stays stable when a newer moment arrives.
begin;
\ir _helpers.psql
select plan(99);

select tests.world();
select tests.create_user('author2');  -- reader follows: 25 moments for pagination
insert into public.follows (reader_id, author_id) values (tests.id('reader'), tests.id('author2'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;

-- ---------------------------------------------------------------- schema
select has_function('public', 'moments_feed_page', array['timestamp with time zone', 'uuid'], 'moments_feed_page exists');
select ok(not has_function_privilege('anon', 'public.moments_feed_page(timestamptz, uuid)', 'execute'),
          'anon cannot call moments_feed_page');
select ok(has_function_privilege('authenticated', 'public.moments_feed_page(timestamptz, uuid)', 'execute'),
          'signed-in users can call moments_feed_page');
select ok(not has_function_privilege('anon', 'public.moment_jar(uuid)', 'execute'), 'anon cannot call moment_jar');
select has_index('public', 'moments', 'moments_user_live_added_idx', 'the timeline has its index');
select is((select indexdef ~ 'WHERE \(status = ''live''' from pg_indexes where indexname = 'moments_user_live_added_idx'),
          true, 'the index covers live moments only');

-- ---------------------------------------------------------------- the owner's moments
insert into t values ('jar_pub', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('jar_unpub', tests.make_jar('owner', 'readers', published => false));
create temp table mm (name text primary key, id uuid not null, sees text[] not null);
grant select on mm to authenticated, anon, service_role;
insert into mm values
  ('published readers',    tests.make_moment((select id from t where k = 'jar_pub'), 'morning', 'live', p_visibility => 'readers'),    '{owner,reader}'),
  ('published everyone',   tests.make_moment((select id from t where k = 'jar_pub'), 'afternoon', 'live', p_visibility => 'everyone'), '{owner,reader}'),
  ('published only_me',    tests.make_moment((select id from t where k = 'jar_pub'), 'evening', 'live', p_visibility => 'only_me'),    '{owner}'),
  ('published checking',   tests.make_moment((select id from t where k = 'jar_pub'), 'selfie', 'checking', p_visibility => 'everyone'), '{}'),
  ('published removed',    tests.make_moment((select id from t where k = 'jar_pub'), 'whereami', 'removed', p_visibility => 'everyone'), '{}'),
  ('published hidden',     tests.make_moment((select id from t where k = 'jar_pub'), 'ootd', 'live', p_visibility => 'everyone'),       '{}'),
  ('unpublished readers',  tests.make_moment((select id from t where k = 'jar_unpub'), 'morning', 'live', p_visibility => 'readers'),  '{owner,reader}'),
  ('unpublished everyone', tests.make_moment((select id from t where k = 'jar_unpub'), 'afternoon', 'live', p_visibility => 'everyone'), '{owner,reader}'),
  ('unpublished only_me',  tests.make_moment((select id from t where k = 'jar_unpub'), 'evening', 'live', p_visibility => 'only_me'),  '{owner}');
-- A report under review hides a moment (0021); the timeline leaves it out, even for its owner (as feed_page).
update public.moments set hidden_at = now() where id = (select id from mm where name = 'published hidden');

create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5), ('moderator', 6);
grant select on roles to authenticated, anon, service_role;

create function pg_temp.in_feed(who text, mid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.moments_feed_page() where moment_id = mid) into r;
  perform tests.reset_role();
  return r;
end $$;

-- 9 moments × 6 roles. Outsiders and the moderator read nobody: an Everyone moment of someone they don't
-- read is not theirs to see here. Blocked users and blockers keep a stale follow and still see nothing.
select is(pg_temp.in_feed(r.role, x.id), r.role = any (x.sees),
          format('%s: %s %s', x.name, r.role, case when r.role = any (x.sees) then 'sees it' else 'does not see it' end))
from mm x cross join roles r order by x.name, r.ord;

-- ---------------------------------------------------------------- what a row carries
select tests.act_as('owner');
select is((select visibility::text from public.moments_feed_page() where moment_id = (select id from mm where name = 'unpublished only_me')),
          'only_me', 'the owner''s Only me moment comes with its visibility, for the lock');
select is((select author_username || '/' || author_display_name || '/' || slot::text from public.moments_feed_page()
           where moment_id = (select id from mm where name = 'published readers')),
          't_owner/Owner/morning', 'author and slot come along');
select is((select jar_id from public.moments_feed_page() where moment_id = (select id from mm where name = 'published readers')),
          (select id from t where k = 'jar_pub'), 'the moment''s jar comes along');
select is((select jar_tz || '/' || jar_local_date::text from public.moments_feed_page()
           where moment_id = (select id from mm where name = 'published readers')),
          'Asia/Manila/' || ((now() at time zone 'Asia/Manila')::date - 1)::text, 'the jar''s zone and date come along');
select is((select bool_and(jar_visible) from public.moments_feed_page()), true, 'the owner may open every own jar');
select is((select count(*) from public.moments_feed_page() where author_id <> tests.id('owner')), 0::bigint,
          'the owner reads nobody here, so only their own moments show');

-- likes and comment counts
select tests.act_as('reader');
insert into public.reactions (user_id, target, target_id)
values (tests.id('reader'), 'moment', (select id from mm where name = 'unpublished everyone'));
select is((select liked from public.moments_feed_page() where moment_id = (select id from mm where name = 'unpublished everyone')),
          true, 'liked is true for a moment the caller liked');
select is((select like_count from public.moments_feed_page() where moment_id = (select id from mm where name = 'unpublished everyone')),
          1, 'like_count follows the like');
select is((select liked from public.moments_feed_page() where moment_id = (select id from mm where name = 'published everyone')),
          false, 'liked is false otherwise');
select tests.act_as('owner');
select is((select liked from public.moments_feed_page() where moment_id = (select id from mm where name = 'unpublished everyone')),
          false, 'liked is the caller''s own like, not someone else''s');
select tests.reset_role();
update public.jars set comment_count = 3 where id in (select id from t where k in ('jar_pub', 'jar_unpub'));
select tests.act_as('reader');
select is((select comment_count::text || '/' || jar_visible from public.moments_feed_page()
           where moment_id = (select id from mm where name = 'published readers')),
          '3/true', 'a moment of a jar the reader may open carries the jar''s comment count');
select is((select comment_count::text || '/' || jar_visible from public.moments_feed_page()
           where moment_id = (select id from mm where name = 'unpublished readers')),
          '0/false', 'a moment of an unpublished jar carries no count and says the jar is not open to the reader');
select tests.act_as('owner');
select is((select comment_count from public.moments_feed_page() where moment_id = (select id from mm where name = 'unpublished readers')),
          3, 'the owner gets their own jar''s count');

-- changes show at once
update public.moments set visibility = 'only_me' where id = (select id from mm where name = 'published everyone');
select is(pg_temp.in_feed('reader', (select id from mm where name = 'published everyone')), false,
          'a moment changed to Only me leaves the reader''s timeline at once');
select tests.act_as('owner');
update public.moments set visibility = 'everyone' where id = (select id from mm where name = 'published everyone');
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('owner');
select is(pg_temp.in_feed('reader', (select id from mm where name = 'published everyone')), false,
          'a suspended author''s moments leave the timeline');
update public.profiles set status = 'active' where id = tests.id('owner');
delete from public.follows where reader_id = tests.id('reader') and author_id = tests.id('owner');
select is(pg_temp.in_feed('reader', (select id from mm where name = 'published everyone')), false,
          'after unfollowing, even an Everyone moment leaves the timeline');
insert into public.follows (reader_id, author_id) values (tests.id('reader'), tests.id('owner'));

-- ---------------------------------------------------------------- errors
select tests.act_as('reader');
select throws_ok($$select * from public.moments_feed_page(now(), null)$$, '22023', null, 'cursor_at needs cursor_id');
select throws_ok($$select * from public.moments_feed_page(null, gen_random_uuid())$$, '22023', null, 'cursor_id needs cursor_at');
select tests.reset_role();
select set_config('role', 'authenticated', true);
select throws_ok($$select * from public.moments_feed_page()$$, '42501', null, 'a caller without a user is refused');
select tests.act_as_anon();
select throws_ok($$select * from public.moments_feed_page()$$, '42501', null, 'anon is refused');
select tests.reset_role();

-- ---------------------------------------------------------------- pagination
insert into t select 'a2_' || i, tests.make_jar('author2', 'readers', published => (i % 2 = 0), p_days_ago => 10 + i)
  from generate_series(1, 25) i;
insert into t select 'm2_' || substr(k, 4), tests.make_moment(id, 'morning', 'live', p_visibility => 'readers')
  from t where k like 'a2\_%';
-- added_at is server time and fixed after insert (moments_bu); backdate it here to order the timeline.
alter table public.moments disable trigger moments_bu;
update public.moments m set added_at = now() - substr(t.k, 4)::int * interval '1 hour'
  from t where t.k like 'm2\_%' and m.id = t.id;
alter table public.moments enable trigger moments_bu;

create temp table pg (page int, pos bigint, moment_id uuid, added_at timestamptz);
grant select, insert on pg to authenticated;
select tests.act_as('reader');
insert into pg select 1, f.ordinality, f.moment_id, f.added_at from public.moments_feed_page() with ordinality f;
select is((select count(*) from pg where page = 1), 20::bigint, 'page 1 has 20 moments');
select ok((select bool_and(ok) from (
             select (added_at, moment_id) < lag((added_at, moment_id)) over (order by pos) as ok from pg where page = 1) x),
          'page 1 is ordered by added_at desc, then moment id desc');
select is((select array_agg(moment_id order by moment_id) from pg where page = 1 and pos <= 4),
          (select array_agg(id order by id) from mm where 'reader' = any (sees)),
          'the newest moments come first');
select is((select array_agg(moment_id order by pos) from pg where page = 1 and pos between 5 and 20),
          (select array_agg(id order by substr(k, 4)::int) from t where k like 'm2\_%' and substr(k, 4)::int <= 16),
          'then older ones in order, published jar or not');

-- A newer moment goes live between pages.
select tests.reset_role();
insert into t values ('a2_new', tests.make_jar('author2', 'readers', published => false, p_days_ago => 60));
insert into t values ('m2_new', tests.make_moment((select id from t where k = 'a2_new'), 'morning', 'live', p_visibility => 'everyone'));
select tests.act_as('reader');
insert into pg select 2, f.ordinality, f.moment_id, f.added_at
  from pg last, public.moments_feed_page(last.added_at, last.moment_id) with ordinality f
  where last.page = 1 and last.pos = 20;
select is((select count(*) from pg where page = 2), 9::bigint, 'page 2 has the remaining 9 moments');
select is((select count(*) from pg a join pg b on a.moment_id = b.moment_id where a.page = 1 and b.page = 2), 0::bigint,
          'no moment repeats across pages');
select is((select array_agg(moment_id order by moment_id) from pg),
          (select array_agg(id order by id) from (
             select id from mm where 'reader' = any (sees)
             union all select id from t where k ~ '^m2_[0-9]+$') x),
          'together the pages hold every timeline moment, none skipped');
select is((select count(*) from pg where moment_id = (select id from t where k = 'm2_new')), 0::bigint,
          'the newer moment does not shift into later pages');
select is((select count(*) from pg last, public.moments_feed_page(last.added_at, last.moment_id) where last.page = 2 and last.pos = 9),
          0::bigint, 'the page after the last is empty');
select is((select count(*) from public.moments_feed_page() f where f.moment_id = (select id from t where k = 'm2_new')), 1::bigint,
          'a fresh first page shows the newer moment');
select tests.reset_role();

-- ---------------------------------------------------------------- moment_jar
create function pg_temp.jar_row(who text, jid uuid) returns text language plpgsql as $$
declare r text;
begin
  perform tests.act_as(who);
  select j.tz || '/' || j.moment_count || '/' || j.comment_count into r from public.moment_jar(jid) j;
  perform tests.reset_role();
  return r;
end $$;
select is(pg_temp.jar_row('owner', (select id from t where k = 'jar_unpub')),
          'Asia/Manila/' || (select moment_count from public.jars where id = (select id from t where k = 'jar_unpub')) || '/3',
          'moment_jar: the owner gets their unpublished jar with its counts');
select is(pg_temp.jar_row('reader', (select id from t where k = 'jar_unpub')), 'Asia/Manila/0/0',
          'moment_jar: a reader who sees a moment gets an unpublished jar''s zone, without its counts');
select is(pg_temp.jar_row('reader', (select id from t where k = 'jar_pub')),
          'Asia/Manila/' || (select moment_count from public.jars where id = (select id from t where k = 'jar_pub')) || '/3',
          'moment_jar: a jar the reader may open comes with its counts');
select is(pg_temp.jar_row('outsider', (select id from t where k = 'jar_unpub')), 'Asia/Manila/0/0',
          'moment_jar: an outsider who sees an Everyone moment gets the jar''s zone, without its counts');
select is(pg_temp.jar_row('blocked', (select id from t where k = 'jar_pub')), null, 'moment_jar: a blocked user gets nothing');
select is(pg_temp.jar_row('blocker', (select id from t where k = 'jar_pub')), null, 'moment_jar: a blocker gets nothing');
select tests.reset_role();
update public.moments set visibility = 'only_me'
  where id in (select id from mm where name in ('unpublished readers', 'unpublished everyone'));
select is(pg_temp.jar_row('reader', (select id from t where k = 'jar_unpub')), null,
          'moment_jar: a jar whose live moments are all Only me gives the reader nothing');
select is(pg_temp.jar_row('outsider', (select id from t where k = 'jar_unpub')), null,
          'moment_jar: an outsider who sees none of its moments gets nothing');
select is(pg_temp.jar_row('reader', gen_random_uuid()), null, 'moment_jar: an unknown jar gives nothing');

select * from finish();
rollback;
