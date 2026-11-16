-- 0151: Mute. A reader who mutes an author stays their reader, but the author's posts leave that reader's Moments
-- and Jars timelines, scrubber days and avatar row; the author's profile and jars still open. Mutes are private
-- to the muter (tried as muter, the muted author, an outsider and anon), and stopping reading ends the mute.
begin;
\ir _helpers.psql
select plan(18);

select tests.world();
create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true, p_days_ago => 2));
insert into t values ('moment', tests.make_moment((select id from t where k = 'jar'), 'morning', 'live'));

create function pg_temp.reader_sees() returns text language plpgsql as $$
declare r text;
begin
  perform tests.act_as('reader');
  select concat_ws('/',
    (select count(*) from public.moments_feed_page() where author_id = tests.id('owner')),
    (select count(*) from public.feed_page() where author_id = tests.id('owner')),
    (select count(*) from public.feed_authors() where author_id = tests.id('owner')),
    (select count(*) from public.moments_feed_days('Asia/Manila')),
    (select count(*) from public.feed_days('Asia/Manila'))) into r;
  perform tests.reset_role();
  return r;
end $$;

-- ---------------------------------------------------------------- schema and privileges
select has_table('public', 'mutes', 'mutes exists');
select ok(not has_table_privilege('anon', 'public.mutes', 'select'), 'anon cannot read mutes');
select ok(not has_table_privilege('authenticated', 'public.mutes', 'update'), 'a mute is never edited, only made or removed');

-- ---------------------------------------------------------------- before
select is(pg_temp.reader_sees(), '1/1/1/1/1', 'before muting, the reader sees the owner everywhere');

-- ---------------------------------------------------------------- muting
select tests.act_as('reader');
select lives_ok($$insert into public.mutes (muter_id, muted_id) values (auth.uid(), tests.id('owner'))$$,
                'a reader mutes an author');
select throws_ok($$insert into public.mutes (muter_id, muted_id) values (tests.id('outsider'), tests.id('owner'))$$,
                 '42501', null, 'nobody mutes for someone else');
select throws_ok($$insert into public.mutes (muter_id, muted_id) values (auth.uid(), auth.uid())$$,
                 '23514', null, 'nobody mutes themselves');
select tests.reset_role();

select is(pg_temp.reader_sees(), '0/0/0/0/0', 'muted: out of Moments, Jars, the avatar row and both scrubbers');
select tests.act_as('reader');
select is((select count(*)::int from public.follows where reader_id = auth.uid() and author_id = tests.id('owner')), 1,
          'muted: still their reader');
select is((select count(*)::int from public.moments where id = (select id from t where k = 'moment')), 1,
          'muted: the moment still opens (profile and jar pages)');
select tests.reset_role();

-- ---------------------------------------------------------------- privacy
select tests.act_as('owner');
select is((select count(*)::int from public.mutes), 0, 'the muted author never sees the mute');
select is((select count(*)::int from public.moments_feed_page() where author_id = tests.id('owner')), 1,
          'the author''s own timeline is unchanged');
select tests.act_as('outsider');
select is((select count(*)::int from public.mutes), 0, 'an outsider never sees it');
delete from public.mutes where muter_id = tests.id('reader');
select tests.act_as('reader');
select is((select count(*)::int from public.mutes), 1, 'the muter still has it after an outsider tried to remove it');
select tests.reset_role();

-- ---------------------------------------------------------------- unmuting and unfollowing
select tests.act_as('reader');
delete from public.mutes where muted_id = tests.id('owner');
select tests.reset_role();
select is(pg_temp.reader_sees(), '1/1/1/1/1', 'unmuted: back everywhere');

select tests.act_as('reader');
insert into public.mutes (muter_id, muted_id) values (auth.uid(), tests.id('owner'));
delete from public.follows where reader_id = auth.uid() and author_id = tests.id('owner');
select is((select count(*)::int from public.mutes), 0, 'stopping reading ends the mute');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'));
select tests.reset_role();
select is(pg_temp.reader_sees(), '1/1/1/1/1', 'reading again starts unmuted');

select tests.act_as('outsider');
select is((select count(*)::int from public.mutes where muter_id = tests.id('reader')), 0, 'and still nobody else sees mutes');
select tests.reset_role();

select * from finish();
rollback;
