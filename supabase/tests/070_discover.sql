-- 0070 (QA round 3, piece K; D-100, D-102; FR-EXP-03): discover_moments_page and discover_jars_page, the
-- Moments and Jars lists of Discover. Each shows only Everyone content of active people the caller doesn't
-- read, with no block either way and never the caller's own: tried as a stranger (outsider), reader, owner,
-- blocked user and blocker, with an inactive owner; checking, removed, hidden, Readers and Only me moments
-- stay out; unpublished, Readers and Everyone-moment-less jars stay out, and a jar's count, previews, caption
-- and cover come from its Everyone moments only. Anon is refused; the cursor pages without repeats or gaps.
begin;
\ir _helpers.psql
select plan(70);

select tests.world();
-- Block exclusion is tested on its own: blocked and blocker stop reading owner here.
delete from public.follows where reader_id in (tests.id('blocked'), tests.id('blocker'));
select tests.create_user('gone');   -- an owner who gets suspended
select tests.create_user('pager');  -- 25 Everyone jars and moments for pagination

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from t where k = p_k $$;

-- ---------------------------------------------------------------- schema
select has_function('public', 'discover_moments_page', array['timestamp with time zone', 'uuid'], 'discover_moments_page exists');
select has_function('public', 'discover_jars_page', array['timestamp with time zone', 'uuid'], 'discover_jars_page exists');
select ok(not has_function_privilege('anon', 'public.discover_moments_page(timestamptz, uuid)', 'execute'),
          'anon cannot call discover_moments_page');
select ok(not has_function_privilege('anon', 'public.discover_jars_page(timestamptz, uuid)', 'execute'),
          'anon cannot call discover_jars_page');
select ok(has_function_privilege('authenticated', 'public.discover_moments_page(timestamptz, uuid)', 'execute'),
          'signed-in users can call discover_moments_page');
select ok(has_function_privilege('authenticated', 'public.discover_jars_page(timestamptz, uuid)', 'execute'),
          'signed-in users can call discover_jars_page');
select has_index('public', 'moments', 'moments_everyone_live_added_idx', 'Discover moments have their index');
select has_index('public', 'jars', 'jars_everyone_published_idx', 'Discover jars have their index');

-- ---------------------------------------------------------------- content
-- A published Everyone jar with a moment of each kind.
insert into t values ('jar_pub', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 1));
insert into t values
  ('everyone', tests.make_moment(pg_temp.id('jar_pub'), 'morning', 'live', p_visibility => 'everyone')),
  ('readers',  tests.make_moment(pg_temp.id('jar_pub'), 'afternoon', 'live', p_visibility => 'readers')),
  ('only_me',  tests.make_moment(pg_temp.id('jar_pub'), 'evening', 'live', p_visibility => 'only_me')),
  ('checking', tests.make_moment(pg_temp.id('jar_pub'), 'selfie', 'checking', p_visibility => 'everyone')),
  ('removed',  tests.make_moment(pg_temp.id('jar_pub'), 'whereami', 'removed', p_visibility => 'everyone')),
  ('hidden',   tests.make_moment(pg_temp.id('jar_pub'), 'ootd', 'live', p_visibility => 'everyone'));
-- A report under review hides a moment (0021).
update public.moments set hidden_at = now() where id = pg_temp.id('hidden');
-- The Readers moment is the owner's pick and has the newer caption; Discover falls back to the Everyone one.
update public.moments set caption = 'everyone caption' where id = pg_temp.id('everyone');
update public.moments set caption = 'readers caption' where id = pg_temp.id('readers');
update public.jars set cover_moment_id = pg_temp.id('readers') where id = pg_temp.id('jar_pub');

-- An Everyone jar not published yet, a published Readers jar and a published Everyone jar without an
-- Everyone moment: none is a Discover jar. Their Everyone moments are Discover moments.
insert into t values ('jar_unpub', tests.make_jar('owner', 'everyone', published => false, p_days_ago => 2));
insert into t values ('unpub_everyone', tests.make_moment(pg_temp.id('jar_unpub'), 'morning', 'live', p_visibility => 'everyone'));
insert into t values ('jar_readers', tests.make_jar('owner', 'readers', published => true, p_days_ago => 3));
insert into t values ('readers_jar_everyone', tests.make_moment(pg_temp.id('jar_readers'), 'morning', 'live', p_visibility => 'everyone'));
insert into t values ('jar_none', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 4));
insert into t values ('none_readers', tests.make_moment(pg_temp.id('jar_none'), 'morning', 'live', p_visibility => 'readers'));
insert into t values ('none_checking', tests.make_moment(pg_temp.id('jar_none'), 'afternoon', 'checking', p_visibility => 'everyone'));

-- Someone who will be suspended.
insert into t values ('jar_gone', tests.make_jar('gone', 'everyone', published => true));
insert into t values ('gone_everyone', tests.make_moment(pg_temp.id('jar_gone'), 'morning', 'live', p_visibility => 'everyone'));

create function pg_temp.sees_moment(who text, mid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.discover_moments_page() where moment_id = mid) into r;
  perform tests.reset_role();
  return r;
end $$;
create function pg_temp.sees_jar(who text, jid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.discover_jars_page() where jar_id = jid) into r;
  perform tests.reset_role();
  return r;
end $$;

-- ---------------------------------------------------------------- moments: who sees an Everyone moment
select is(pg_temp.sees_moment('outsider', pg_temp.id('everyone')), true, 'moments: a stranger sees an Everyone moment');
select is(pg_temp.sees_moment('moderator', pg_temp.id('everyone')), true, 'moments: another stranger (moderator) sees it too');
select is(pg_temp.sees_moment('reader', pg_temp.id('everyone')), false, 'moments: a reader of the owner does not (they read them already)');
select is(pg_temp.sees_moment('owner', pg_temp.id('everyone')), false, 'moments: the owner does not see their own');
select is(pg_temp.sees_moment('blocked', pg_temp.id('everyone')), false, 'moments: someone the owner blocked does not');
select is(pg_temp.sees_moment('blocker', pg_temp.id('everyone')), false, 'moments: someone who blocked the owner does not');

-- ---------------------------------------------------------------- moments: what is never listed
select is(pg_temp.sees_moment('outsider', pg_temp.id('checking')), false, 'moments: a checking moment is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('removed')), false, 'moments: a removed moment is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('hidden')), false, 'moments: a hidden moment is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('readers')), false, 'moments: a Readers moment is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('only_me')), false, 'moments: an Only me moment is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('none_readers')), false, 'moments: a Readers moment of an Everyone jar is not listed');
select is(pg_temp.sees_moment('outsider', pg_temp.id('unpub_everyone')), true,
          'moments: an Everyone moment of a jar not published yet is listed (live moments are visible, D-48)');
select is(pg_temp.sees_moment('outsider', pg_temp.id('readers_jar_everyone')), true,
          'moments: an Everyone moment of a Readers jar is listed');

-- inactive owner
select is(pg_temp.sees_moment('outsider', pg_temp.id('gone_everyone')), true, 'moments: an active owner''s moment is listed');
update public.profiles set status = 'suspended' where id = tests.id('gone');
select is(pg_temp.sees_moment('outsider', pg_temp.id('gone_everyone')), false, 'moments: a suspended owner''s moment is not');
update public.profiles set status = 'active' where id = tests.id('gone');

-- reading someone takes them out of Discover; stopping puts them back
insert into public.follows (reader_id, author_id) values (tests.id('outsider'), tests.id('gone'));
select is(pg_temp.sees_moment('outsider', pg_temp.id('gone_everyone')), false, 'moments: once read, an author leaves Discover');
delete from public.follows where reader_id = tests.id('outsider') and author_id = tests.id('gone');
select is(pg_temp.sees_moment('outsider', pg_temp.id('gone_everyone')), true, 'moments: after unfollowing they are back');

-- a moment changed to Readers leaves at once
update public.moments set visibility = 'readers' where id = pg_temp.id('gone_everyone');
select is(pg_temp.sees_moment('outsider', pg_temp.id('gone_everyone')), false, 'moments: a moment changed to Readers leaves at once');
update public.moments set visibility = 'everyone' where id = pg_temp.id('gone_everyone');

-- ---------------------------------------------------------------- moments: what a row carries
select tests.act_as('outsider');
select is((select author_username || '/' || author_display_name || '/' || slot::text || '/' || visibility::text
           from public.discover_moments_page() where moment_id = pg_temp.id('everyone')),
          't_owner/Owner/morning/everyone', 'moments: author, slot and visibility come along');
select is((select jar_id from public.discover_moments_page() where moment_id = pg_temp.id('everyone')),
          pg_temp.id('jar_pub'), 'moments: the moment''s jar comes along');
select is((select jar_visible from public.discover_moments_page() where moment_id = pg_temp.id('everyone')),
          true, 'moments: a published Everyone jar may be opened');
select is((select jar_visible from public.discover_moments_page() where moment_id = pg_temp.id('unpub_everyone')),
          false, 'moments: an unpublished jar may not');
select is((select jar_visible from public.discover_moments_page() where moment_id = pg_temp.id('readers_jar_everyone')),
          false, 'moments: a Readers jar may not, for a stranger');
insert into public.reactions (user_id, target, target_id) values (tests.id('outsider'), 'moment', pg_temp.id('everyone'));
select is((select liked::text || '/' || like_count from public.discover_moments_page() where moment_id = pg_temp.id('everyone')),
          'true/1', 'moments: liked and like_count follow the caller''s like');
select tests.act_as('moderator');
select is((select liked from public.discover_moments_page() where moment_id = pg_temp.id('everyone')),
          false, 'moments: liked is the caller''s own like');
select is((select count(*) from public.discover_moments_page() where author_id = tests.id('moderator')), 0::bigint,
          'moments: never the caller''s own');
select tests.reset_role();

-- ---------------------------------------------------------------- jars: who sees an Everyone jar
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_pub')), true, 'jars: a stranger sees a published Everyone jar');
select is(pg_temp.sees_jar('reader', pg_temp.id('jar_pub')), false, 'jars: a reader of the owner does not (they read them already)');
select is(pg_temp.sees_jar('owner', pg_temp.id('jar_pub')), false, 'jars: the owner does not see their own');
select is(pg_temp.sees_jar('blocked', pg_temp.id('jar_pub')), false, 'jars: someone the owner blocked does not');
select is(pg_temp.sees_jar('blocker', pg_temp.id('jar_pub')), false, 'jars: someone who blocked the owner does not');

-- ---------------------------------------------------------------- jars: what is never listed
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_unpub')), false, 'jars: an unpublished jar is not listed');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_readers')), false, 'jars: a Readers jar is not listed');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_none')), false, 'jars: a jar without a live Everyone moment is not listed');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_gone')), true, 'jars: an active owner''s jar is listed');
update public.profiles set status = 'suspended' where id = tests.id('gone');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_gone')), false, 'jars: a suspended owner''s jar is not');
update public.profiles set status = 'active' where id = tests.id('gone');
update public.moments set hidden_at = now() where id = pg_temp.id('gone_everyone');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_gone')), false, 'jars: a jar whose only Everyone moment is hidden is not');
update public.moments set hidden_at = null where id = pg_temp.id('gone_everyone');
update public.jars set visibility = 'only_me' where id = pg_temp.id('jar_gone');
select is(pg_temp.sees_jar('outsider', pg_temp.id('jar_gone')), false, 'jars: a jar switched to Only me leaves at once');
update public.jars set visibility = 'everyone' where id = pg_temp.id('jar_gone');

-- ---------------------------------------------------------------- jars: counts and previews from Everyone moments only
select tests.act_as('outsider');
select is((select visible_count from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')), 1,
          'jars: the count is the Everyone moments only');
select is((select preview_moment_ids from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          array[pg_temp.id('everyone')], 'jars: the previews are the Everyone moments only');
select is((select array_length(preview_thumb_paths, 1) from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          1, 'jars: one thumb path per preview');
select is((select cover_moment_id from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          pg_temp.id('everyone'), 'jars: a Readers pick falls back to an Everyone cover');
select is((select last_caption from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          'everyone caption', 'jars: the last caption is an Everyone moment''s');
select is((select feed_at = published_at and not is_new and author_username = 't_owner'
           from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          true, 'jars: feed_at is published_at, nothing is new, the author comes along');
select is((select count(*) from public.discover_jars_page() where author_id = tests.id('outsider')), 0::bigint,
          'jars: never the caller''s own');
select tests.reset_role();
update public.jars set cover_moment_id = pg_temp.id('everyone') where id = pg_temp.id('jar_pub');
select tests.act_as('outsider');
select is((select cover_moment_id from public.discover_jars_page() where jar_id = pg_temp.id('jar_pub')),
          pg_temp.id('everyone'), 'jars: an Everyone pick is the cover');
select tests.reset_role();

-- ---------------------------------------------------------------- errors
select tests.act_as('outsider');
select throws_ok($$select * from public.discover_moments_page(now(), null)$$, '22023', null, 'moments: cursor_at needs cursor_id');
select throws_ok($$select * from public.discover_jars_page(null, gen_random_uuid())$$, '22023', null, 'jars: cursor_id needs cursor_at');
select tests.reset_role();
select set_config('role', 'authenticated', true);
select throws_ok($$select * from public.discover_moments_page()$$, '42501', null, 'moments: a caller without a user is refused');
select throws_ok($$select * from public.discover_jars_page()$$, '42501', null, 'jars: a caller without a user is refused');
select tests.act_as_anon();
select throws_ok($$select * from public.discover_moments_page()$$, '42501', null, 'moments: anon is refused');
select throws_ok($$select * from public.discover_jars_page()$$, '42501', null, 'jars: anon is refused');
select tests.reset_role();

-- ---------------------------------------------------------------- pagination
insert into t select 'pj_' || i, tests.make_jar('pager', 'everyone', published => true, p_days_ago => 10 + i)
  from generate_series(1, 25) i;
insert into t select 'pm_' || substr(k, 4), tests.make_moment(id, 'morning', 'live', p_visibility => 'everyone')
  from t where k like 'pj\_%';
-- added_at and published_at are server time; backdate them here so the pager's rows sort below the rest.
alter table public.moments disable trigger moments_bu;
update public.moments m set added_at = now() - substr(t.k, 4)::int * interval '1 hour'
  from t where t.k like 'pm\_%' and m.id = t.id;
alter table public.moments enable trigger moments_bu;
update public.jars j set published_at = now() - substr(t.k, 4)::int * interval '1 hour'
  from t where t.k like 'pj\_%' and j.id = t.id;

-- What the stranger must get. The seed data may add other people's public rows, so the pages are walked
-- to the end and must contain all of these, rather than exactly these.
create temp table want (kind text, id uuid);
grant select on want to authenticated;
insert into want select 'moment', id from t
  where k in ('everyone', 'unpub_everyone', 'readers_jar_everyone', 'gone_everyone') or k like 'pm\_%';
insert into want select 'jar', id from t where k in ('jar_pub', 'jar_gone') or k like 'pj\_%';

create temp table pg (kind text, page int, pos bigint, id uuid, at timestamptz);
grant select, insert on pg to authenticated;
select tests.act_as('outsider');
do $$
declare
  p int;
  n int;
  c_at timestamptz;
  c_id uuid;
begin
  p := 1; c_at := null; c_id := null;
  loop
    insert into pg select 'moment', p, f.ordinality, f.moment_id, f.added_at
      from public.discover_moments_page(c_at, c_id) with ordinality f;
    get diagnostics n = row_count;
    exit when n < 20 or p >= 50;
    select at, id into c_at, c_id from pg where kind = 'moment' and page = p and pos = 20;
    p := p + 1;
  end loop;
  p := 1; c_at := null; c_id := null;
  loop
    insert into pg select 'jar', p, f.ordinality, f.jar_id, f.feed_at
      from public.discover_jars_page(c_at, c_id) with ordinality f;
    get diagnostics n = row_count;
    exit when n < 20 or p >= 50;
    select at, id into c_at, c_id from pg where kind = 'jar' and page = p and pos = 20;
    p := p + 1;
  end loop;
end $$;

select is((select count(*) from pg where kind = 'moment' and page = 1), 20::bigint, 'moments: page 1 has 20');
select ok((select bool_and(ok) from (
             select (at, id) < lag((at, id)) over (order by page, pos) as ok from pg where kind = 'moment') x),
          'moments: every page is ordered by added_at desc, then id desc, and continues the one before');
select is((select count(*) - count(distinct id) from pg where kind = 'moment'), 0::bigint,
          'moments: no moment repeats across pages');
select is((select array_agg(w.id order by w.id) from want w
           where w.kind = 'moment' and not exists (select 1 from pg where pg.kind = 'moment' and pg.id = w.id)),
          null::uuid[], 'moments: together the pages hold every Discover moment, none skipped');
select is((select count(*) from (select at, id from pg where kind = 'moment' order by page desc, pos desc limit 1) last,
                  public.discover_moments_page(last.at, last.id)),
          0::bigint, 'moments: the page after the last is empty');

select is((select count(*) from pg where kind = 'jar' and page = 1), 20::bigint, 'jars: page 1 has 20');
select ok((select bool_and(ok) from (
             select (at, id) < lag((at, id)) over (order by page, pos) as ok from pg where kind = 'jar') x),
          'jars: every page is ordered by published_at desc, then id desc, and continues the one before');
select is((select count(*) - count(distinct id) from pg where kind = 'jar'), 0::bigint,
          'jars: no jar repeats across pages');
select is((select array_agg(w.id order by w.id) from want w
           where w.kind = 'jar' and not exists (select 1 from pg where pg.kind = 'jar' and pg.id = w.id)),
          null::uuid[], 'jars: together the pages hold every Discover jar, none skipped');
select tests.reset_role();

select * from finish();
rollback;
