-- 0177: Together moments. Only the person tagged right now asks, only the author answers; a request is seen
-- by the two only. An approved one shows on the tagged person's Together page to: the tagged person, the author,
-- a reader of both; not to a reader of the author only (tagged person on Readers), a reader of the tagged person
-- who can't see the moment, an outsider, someone the author blocked, someone blocked with the tagged person, or
-- anon. Everyone settings on both sides let an outsider see it, unless the tagged person is Private (0176). It leaves when the mention goes, the tag is
-- removed, a block lands, the moment turns Only me, is removed or deleted, or either person takes it off; a hidden
-- moment drops off until it's live again. Never joins a jar.
begin;
\ir _helpers.psql
select plan(55);

select tests.world();
select tests.create_user('tagee');   -- mutual reader of owner: the tagged person
select tests.create_user('both');    -- reads owner and tagee
select tests.create_user('tfan');    -- reads tagee only
select tests.create_user('tblock');  -- reads owner; tagee blocks them below
insert into public.follows (reader_id, author_id) values
  (tests.id('owner'), tests.id('tagee')), (tests.id('tagee'), tests.id('owner')),
  (tests.id('both'), tests.id('owner')), (tests.id('both'), tests.id('tagee')),
  (tests.id('tfan'), tests.id('tagee')),
  (tests.id('tblock'), tests.id('owner')),
  (tests.id('blocked'), tests.id('tagee'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true)),
                     ('jar2', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));

-- A live moment of owner's in `p_jar` that tags tagee by a caption mention.
create function pg_temp.tagged_moment(p_key text, p_slot slot, p_jar text default 'jar') returns uuid language plpgsql as $$
declare mid uuid;
begin
  mid := tests.make_moment((select id from t where k = p_jar), p_slot, 'live');
  update public.moments set caption = 'with @t_tagee' where id = mid;
  insert into t values (p_key, mid);
  return mid;
end $$;
create function pg_temp.m(p_key text) returns uuid language sql as $$ select id from t where k = p_key $$;
create function pg_temp.status(p_key text) returns text language sql as $$
  select coalesce((select status from public.together_moments where moment_id = pg_temp.m(p_key) and user_id = tests.id('tagee')), 'none')
$$;
create function pg_temp.page() returns int language sql as $$
  select count(*)::int from public.together_page(tests.id('tagee'))
$$;
create function pg_temp.notes(p_name text, p_type text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = tests.id(p_name) and type = p_type
$$;
create function pg_temp.approve(p_key text) returns void language plpgsql as $$
begin
  perform tests.act_as('tagee');
  perform public.request_together(pg_temp.m(p_key));
  perform tests.act_as('owner');
  perform public.answer_together(pg_temp.m(p_key), tests.id('tagee'), true);
  perform tests.reset_role();
end $$;

-- ---------------------------------------------------------------- schema and privileges
select ok(not has_table_privilege('anon', 'public.together_moments', 'select'), 'anon cannot read together moments');
select ok(not has_table_privilege('authenticated', 'public.together_moments', 'insert'), 'nobody inserts directly');
select ok(not has_table_privilege('authenticated', 'public.together_moments', 'update'), 'nobody updates directly');
select ok(not has_function_privilege('anon', 'public.together_page(uuid, int)', 'execute'), 'anon cannot read a Together page');

-- ---------------------------------------------------------------- asking
select pg_temp.tagged_moment('m', 'morning');
select tests.act_as('reader');
select throws_ok($$ select public.request_together(pg_temp.m('m')) $$, '42501', 'not tagged on that moment',
                 'someone not tagged can''t ask');
select tests.act_as('tagee');
select is(public.request_together(pg_temp.m('m')), 'requested', 'the tagged person asks');
select is(public.request_together(pg_temp.m('m')), 'requested', 'asking again changes nothing');
select tests.reset_role();
select is(pg_temp.notes('owner', 'together_request'), 1, 'the author is told once');

select tests.act_as('tagee');
select is((select count(*)::int from public.together_moments), 1, 'the tagged person sees their request');
select tests.act_as('owner');
select is((select status from public.together_moments where moment_id = pg_temp.m('m')), 'requested',
          'the author sees the request');
select tests.act_as('both');
select is((select count(*)::int from public.together_moments), 0, 'nobody else sees a request');
select is(pg_temp.page(), 0, 'a request isn''t on the Together page');

-- ---------------------------------------------------------------- answering
select tests.act_as('tagee');
select public.answer_together(pg_temp.m('m'), tests.id('tagee'), true);
select tests.act_as('reader');
select public.answer_together(pg_temp.m('m'), tests.id('tagee'), true);
select tests.reset_role();
select is(pg_temp.status('m'), 'requested', 'only the author can answer');
select tests.act_as('owner');
select public.answer_together(pg_temp.m('m'), tests.id('tagee'), true);
select tests.reset_role();
select is(pg_temp.status('m'), 'approved', 'the author approves');
select is(pg_temp.notes('owner', 'together_request'), 0, 'the answered request leaves the author''s notifications');
select is(pg_temp.notes('tagee', 'together_added'), 1, 'the tagged person is told it was added');

-- ---------------------------------------------------------------- who sees it on the Together page
select tests.act_as('tagee');
select is(pg_temp.page(), 1, 'the tagged person sees it');
select tests.act_as('owner');
select is(pg_temp.page(), 1, 'the author sees it');
select tests.act_as('both');
select is(pg_temp.page(), 1, 'a reader of both sees it');
select is((select author_username from public.together_page(tests.id('tagee'))), 't_owner', 'with the author''s name');
select tests.act_as('reader');
select is(pg_temp.page(), 0, 'a reader of the author only doesn''t (the tagged person shares with Readers)');
select tests.act_as('tfan');
select is(pg_temp.page(), 0, 'a reader of the tagged person who can''t see the moment doesn''t');
select tests.act_as('outsider');
select is(pg_temp.page(), 0, 'an outsider doesn''t');
select tests.act_as('blocked');
select is(pg_temp.page(), 0, 'someone the author blocked doesn''t, though they read the tagged person');
select tests.act_as_anon();
select throws_ok($$ select pg_temp.page() $$, '42501', null, 'anon can''t read it');
select tests.reset_role();

update public.profiles set default_visibility = 'everyone' where id = tests.id('tagee');
update public.moments set visibility = 'everyone' where id = pg_temp.m('m');
select tests.act_as('outsider');
select is(pg_temp.page(), 1, 'everyone on both sides: an outsider sees it');
select tests.act_as('reader');
select is(pg_temp.page(), 1, 'and so does a reader of the author only');
select tests.act_as('tblock');
select is(pg_temp.page(), 1, 'control: tblock sees it before the block');
select tests.reset_role();
insert into public.blocks (blocker_id, blocked_id) values (tests.id('tagee'), tests.id('tblock'));
select tests.act_as('tblock');
select is(pg_temp.page(), 0, 'someone blocked with the tagged person doesn''t');
select tests.reset_role();
update public.profiles set is_private = true where id = tests.id('tagee');
select tests.act_as('outsider');
select is(pg_temp.page(), 0, 'a Private tagged person: their Everyone counts as Readers, so an outsider doesn''t (0176)');
select tests.act_as('both');
select is(pg_temp.page(), 1, 'and their reader still does');
select tests.reset_role();
update public.profiles set is_private = false where id = tests.id('tagee');
update public.profiles set default_visibility = 'readers' where id = tests.id('tagee');
update public.moments set visibility = 'readers' where id = pg_temp.m('m');

-- ---------------------------------------------------------------- never in a jar
select is((select count(*)::int from public.jars where user_id = tests.id('tagee')), 0,
          'it never makes or joins a jar for the tagged person');
select is((select jar_count from public.profiles where id = tests.id('tagee')), 0, 'or counts as one');

-- ---------------------------------------------------------------- a hidden moment drops off, then returns
update public.moments set hidden_at = now() where id = pg_temp.m('m');
select tests.act_as('tagee');
select is(pg_temp.page(), 0, 'hidden: off the page, even for the tagged person');
select tests.act_as('owner');
select is(pg_temp.page(), 0, 'and for the author');
select tests.reset_role();
select is(pg_temp.notes('tagee', 'together_added'), 0, 'and its notice goes');
update public.moments set hidden_at = null where id = pg_temp.m('m');
select tests.act_as('both');
select is(pg_temp.page(), 1, 'live again: back on the page');
select tests.reset_role();

-- ---------------------------------------------------------------- it leaves
-- The author takes the mention out.
select pg_temp.tagged_moment('a', 'afternoon');
select pg_temp.approve('a');
select is(pg_temp.status('a'), 'approved', 'control: a is approved');
update public.moments set caption = 'lunch' where id = pg_temp.m('a');
select is(pg_temp.status('a'), 'none', 'the mention goes: it leaves');

-- The tagged person removes their tag.
select pg_temp.tagged_moment('b', 'evening');
select pg_temp.approve('b');
select tests.act_as('tagee');
select public.remove_moment_tag(pg_temp.m('b'));
select tests.reset_role();
select is(pg_temp.status('b'), 'none', 'the tag is removed: it leaves');
select is((select count(*)::int from public.notifications where moment_id = pg_temp.m('b')
           and type in ('together_request', 'together_added')), 0, 'with its notices');

-- Only me.
select pg_temp.tagged_moment('c', 'whereami');
select pg_temp.approve('c');
update public.moments set visibility = 'only_me' where id = pg_temp.m('c');
select is(pg_temp.status('c'), 'none', 'Only me: it leaves');
update public.moments set visibility = 'readers' where id = pg_temp.m('c');
select tests.act_as('tagee');
select is(public.request_together(pg_temp.m('c')), 'requested', 'shared again: it doesn''t come back by itself, it is asked again');
select tests.reset_role();

-- Removed by moderation.
select pg_temp.tagged_moment('d', 'mebusywith');
select pg_temp.approve('d');
select tests.set_status(pg_temp.m('d'), 'removed');
select is(pg_temp.status('d'), 'none', 'removed by moderation: it leaves');

-- Deleted.
select pg_temp.tagged_moment('e', 'whoamiwith');
select pg_temp.approve('e');
delete from public.moments where id = pg_temp.m('e');
select is((select count(*)::int from public.together_moments where moment_id = pg_temp.m('e')), 0, 'deleted: it leaves');

-- The author takes it back: final.
select pg_temp.tagged_moment('f', 'ootd');
select pg_temp.approve('f');
select tests.act_as('owner');
select public.remove_together(pg_temp.m('f'), tests.id('tagee'));
select tests.act_as('tagee');
select is(public.request_together(pg_temp.m('f')), 'declined', 'the author took it back: asking again stays declined');
select is(pg_temp.page(), 1, 'only m is on the page now');
select tests.reset_role();

-- The tagged person takes it off and may ask again.
select pg_temp.tagged_moment('g', 'selfie');
select pg_temp.approve('g');
select tests.act_as('tagee');
select public.remove_together(pg_temp.m('g'), tests.id('tagee'));
select tests.reset_role();
select is(pg_temp.status('g'), 'none', 'the tagged person takes it off');
select is(pg_temp.notes('tagee', 'together_added') + pg_temp.notes('owner', 'together_request'), 1,
          'its notices go (only m''s added notice is left)');
select tests.act_as('tagee');
select is(public.request_together(pg_temp.m('g')), 'requested', 'and can ask again');
select tests.reset_role();

-- Declined.
select pg_temp.tagged_moment('h', 'morning', 'jar2');
select tests.act_as('tagee');
select public.request_together(pg_temp.m('h'));
select tests.act_as('owner');
select public.answer_together(pg_temp.m('h'), tests.id('tagee'), false);
select tests.reset_role();
select is(pg_temp.status('h'), 'declined', 'the author declines');
select is((select count(*)::int from public.notifications where moment_id = pg_temp.m('h')
           and type in ('together_request', 'together_added')), 0,
          'nobody is told about a decline, and the request goes');

-- Not shared: can't ask.
insert into t values ('p', tests.make_moment((select id from t where k = 'jar2'), 'afternoon', 'checking'));
update public.moments set caption = 'with @t_tagee' where id = pg_temp.m('p');
select tests.act_as('tagee');
select throws_ok($$ select public.request_together(pg_temp.m('p')) $$, '42501', null,
                 'a moment still being checked can''t be asked for');
select tests.reset_role();

-- A block takes it off.
select pg_temp.tagged_moment('i', 'evening', 'jar2');
select pg_temp.approve('i');
select is(pg_temp.status('i'), 'approved', 'control: i is approved');
insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner'), tests.id('tagee'));
select is((select count(*)::int from public.together_moments where user_id = tests.id('tagee')), 0,
          'a block takes every together moment and request between the two off');

select * from finish();
rollback;
