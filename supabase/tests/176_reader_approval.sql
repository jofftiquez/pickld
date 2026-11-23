-- 0176: Approve who reads you. A Private account, or any account under 18, approves its readers: Be a reader
-- becomes a request the author approves or declines. Tried as the owner, an approved reader, a pending reader,
-- an outsider, a blocked user, a blocker, anon and service_role, for a Private adult, a public adult and a
-- public under-18 account.
begin;
\ir _helpers.psql
select plan(55);

select tests.world();                -- owner, reader (reads owner), outsider, blocked, blocker, moderator
select tests.create_user('pending'); -- asks to read owner once owner is Private
select tests.create_user('pub');     -- public adult
select tests.create_user('minor');   -- public, under 18
select tests.create_user('asker');
update public.profiles set birthday = current_date - interval '15 years' where id = tests.id('minor');

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('everyone', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 1));
insert into t values ('readers', tests.make_jar('owner', 'readers', published => true, p_days_ago => 2));
insert into t values ('m_everyone', tests.make_moment((select id from t where k = 'everyone'), 'morning', 'live'));
insert into t values ('m_readers', tests.make_moment((select id from t where k = 'readers'), 'morning', 'live'));
insert into t values ('minor_jar', tests.make_jar('minor', 'everyone', published => true, p_days_ago => 1));
insert into t values ('m_minor', tests.make_moment((select id from t where k = 'minor_jar'), 'evening', 'live'));

-- What a viewer sees of owner: jars/moments/everyone moment/readers moment.
create function pg_temp.sees(p_name text) returns text language plpgsql as $$
declare r text;
begin
  perform tests.act_as(p_name);
  select concat_ws('/',
    (select count(*) from public.jars where user_id = tests.id('owner')),
    (select count(*) from public.moments where user_id = tests.id('owner')),
    (select count(*) from public.moments where id = (select id from t where k = 'm_everyone')),
    (select count(*) from public.moments where id = (select id from t where k = 'm_readers'))) into r;
  perform tests.reset_role();
  return r;
end $$;

create function pg_temp.reads(p_reader text, p_author text) returns boolean language sql as $$
  select exists (select 1 from public.follows where reader_id = tests.id(p_reader) and author_id = tests.id(p_author))
$$;
create function pg_temp.waits(p_reader text, p_author text) returns boolean language sql as $$
  select exists (select 1 from public.follow_requests where reader_id = tests.id(p_reader) and author_id = tests.id(p_author))
$$;
create function pg_temp.told(p_user text, p_type text, p_actor text) returns int language sql as $$
  select count(*)::int from public.notifications
  where user_id = tests.id(p_user) and type = p_type and actor_id = tests.id(p_actor)
$$;

-- ---------------------------------------------------------------- schema and privileges
select has_table('public', 'follow_requests', 'follow_requests exists');
select ok(not has_table_privilege('anon', 'public.follow_requests', 'select'), 'anon cannot read requests');
select ok(not has_table_privilege('authenticated', 'public.follow_requests', 'insert'),
          'requests are made through Be a reader, never inserted directly');
select ok(not has_table_privilege('authenticated', 'public.follow_requests', 'update'), 'a request is never edited');
select ok(not has_function_privilege('authenticated', 'public.approve_waiting_readers()', 'execute'),
          'only the jobs function approves waiting requests in bulk');
select is((select is_private from public.profiles where id = tests.id('owner')), false, 'accounts start public');

-- ---------------------------------------------------------------- a public adult: unchanged
select tests.act_as('outsider');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('pub'));
select tests.reset_role();
select ok(pg_temp.reads('outsider', 'pub') and not pg_temp.waits('outsider', 'pub'),
          'public adult: Be a reader makes a reader at once');
select is(pg_temp.told('pub', 'new_reader', 'outsider'), 1, 'public adult: told about the new reader as before');
select is(pg_temp.sees('outsider'), '1/1/1/0', 'public owner: an outsider sees Everyone posts only');

-- ---------------------------------------------------------------- turning Private on
select tests.act_as('owner');
select lives_ok($$update public.profiles set is_private = true where id = auth.uid()$$, 'the owner turns Private on');
select tests.act_as('outsider');
update public.profiles set is_private = true where id = tests.id('pub');
select tests.reset_role();
select is((select is_private from public.profiles where id = tests.id('pub')), false,
          'nobody turns Private on for someone else');
select ok(pg_temp.reads('reader', 'owner'), 'existing readers stay approved');

-- ---------------------------------------------------------------- asking
select tests.act_as('pending');
select lives_ok($$insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'))
                  on conflict do nothing$$, 'Be a reader on a Private account goes through');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner')) on conflict do nothing;
select throws_ok($$insert into public.follows (reader_id, author_id) values (tests.id('asker'), tests.id('owner'))$$,
                 '42501', null, 'nobody asks for someone else');
select tests.reset_role();
select ok(not pg_temp.reads('pending', 'owner'), 'Private: asking does not make a reader');
select ok(pg_temp.waits('pending', 'owner'), 'Private: it makes one request (asking twice is the same request)');
select is(pg_temp.told('owner', 'reader_request', 'pending'), 1, 'the owner is told someone wants to read them');
select is(pg_temp.told('owner', 'new_reader', 'pending'), 0, 'and not that they started reading');
select is((select reader_count from public.profiles where id = tests.id('owner')), 1,
          'a request is not counted as a reader');

select tests.act_as('blocked');
select throws_ok($$insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'))$$,
                 'P0001', 'blocked', 'a blocked user cannot ask');
select tests.act_as('blocker');
select throws_ok($$insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'))$$,
                 'P0001', 'blocked', 'someone who blocked the owner cannot ask');
select tests.reset_role();

-- ---------------------------------------------------------------- who sees the request
select tests.act_as('pending');
select is((select count(*)::int from public.follow_requests), 1, 'the pending reader sees their own request');
select tests.act_as('owner');
select is((select array_agg(username) from public.reader_requests()), array['t_pending'],
          'the owner sees it on their Requests card');
select tests.act_as('outsider');
select is((select count(*)::int from public.follow_requests), 0, 'an outsider never sees it');
delete from public.follow_requests;
select tests.act_as('reader');
select is((select count(*)::int from public.reader_requests()), 0, 'a reader never sees the owner''s requests');
select tests.act_as_anon();
select throws_ok($$select count(*) from public.follow_requests$$, '42501', null, 'anon cannot read requests');
select tests.reset_role();
select ok(pg_temp.waits('pending', 'owner'), 'an outsider cannot remove someone else''s request');

-- ---------------------------------------------------------------- what each viewer sees of a Private account
select is(pg_temp.sees('owner'), '2/2/1/1', 'Private: the owner sees everything');
select tests.act_as('outsider');
select is((select is_private from public.profiles where id = tests.id('owner')), true,
          'Private: anyone signed in can tell, so the profile shows locked');
select tests.reset_role();
select is(pg_temp.sees('reader'), '2/2/1/1', 'Private: an approved reader sees Readers and Everyone posts');
select is(pg_temp.sees('pending'), '0/0/0/0', 'Private: a pending reader sees no posts');
select is(pg_temp.sees('outsider'), '0/0/0/0', 'Private: an outsider sees no posts, Everyone ones included');
select is(pg_temp.sees('blocked'), '0/0/0/0', 'Private: a blocked user sees nothing');
select tests.act_as('pending');
select is((select count(*)::int from public.profiles where id = tests.id('owner')), 1,
          'Private: the profile header still opens, so people can ask');
select ok(not public.in_discover(tests.id('owner')), 'Private: out of Discover and suggestions');
select tests.act_as_anon();
select is(jsonb_array_length(public.public_profile('t_owner') -> 'jars'), 0, 'Private: the shared profile page has no jars');
select ok((public.public_jar((select id from t where k = 'everyone')) ->> 'readers_only')::boolean
          and not public.public_jar((select id from t where k = 'everyone')) ? 'moments',
          'Private: a shared Everyone jar link is a teaser without moments');
select tests.reset_role();

-- ---------------------------------------------------------------- approving
select tests.act_as('pending');
select is(public.approve_reader(tests.id('pending')), false, 'nobody approves their own request');
select tests.act_as('outsider');
select is(public.approve_reader(tests.id('pending')), false, 'an outsider cannot approve it');
select tests.act_as('owner');
select is(public.approve_reader(tests.id('pending')), true, 'the owner approves');
select tests.reset_role();
select ok(pg_temp.reads('pending', 'owner') and not pg_temp.waits('pending', 'owner'),
          'approved: now a reader, request gone');
select is(pg_temp.told('pending', 'reader_approved', 'owner'), 1, 'approved: the reader is told');
select is(pg_temp.told('owner', 'reader_request', 'pending') + pg_temp.told('owner', 'new_reader', 'pending'), 0,
          'approved: the owner''s request notification goes, and no "started reading" repeats it');
select is(pg_temp.sees('pending'), '2/2/1/1', 'approved: sees what readers see');

-- ---------------------------------------------------------------- declining, cancelling, asking again, blocking
select tests.act_as('asker');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'));
select tests.act_as('owner');
delete from public.follow_requests where reader_id = tests.id('asker');
select tests.reset_role();
select ok(not pg_temp.waits('asker', 'owner') and not pg_temp.reads('asker', 'owner'), 'declined: request gone');
select is((select count(*)::int from public.notifications where user_id = tests.id('asker')) +
          pg_temp.told('owner', 'reader_request', 'asker'), 0, 'declined: silent, and the owner''s notification goes');

select tests.act_as('asker');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'));
select ok(pg_temp.waits('asker', 'owner'), 'after a decline they can ask again');
delete from public.follow_requests where author_id = tests.id('owner');
select ok(not pg_temp.waits('asker', 'owner'), 'the reader cancels their own request');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'));
select tests.act_as('owner');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.id('asker'));
select tests.reset_role();
select ok(not pg_temp.waits('asker', 'owner'), 'blocking removes the request');

-- ---------------------------------------------------------------- Readers & authors rows
select tests.act_as('outsider');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('owner'));
select is((select requested from public.search_follow_list(tests.id('pending'), 'authors') where id = tests.id('owner')),
          true, 'a list row shows Requested to the person waiting');
select tests.reset_role();

-- ---------------------------------------------------------------- turning Private off approves who is waiting
select tests.act_as('owner');
update public.profiles set is_private = false where id = auth.uid();
select tests.reset_role();
select ok(pg_temp.reads('outsider', 'owner') and pg_temp.told('outsider', 'reader_approved', 'owner') = 1,
          'Private off: waiting requests are approved and told');

-- ---------------------------------------------------------------- under 18, public
select tests.act_as('outsider');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('minor'));
select is((select count(*)::int from public.moments where id = (select id from t where k = 'm_minor')), 1,
          'under 18, public: Everyone posts stay visible while waiting');
select tests.reset_role();
select ok(pg_temp.waits('outsider', 'minor') and not pg_temp.reads('outsider', 'minor'),
          'under 18: readers need approval even without Private');
update public.profiles set birthday = current_date - interval '18 years' where id = tests.id('minor');
select tests.act_as_service();
select is(public.approve_waiting_readers(), 1, 'turning 18 without Private: the jobs function approves who waits');
select tests.reset_role();
select ok(pg_temp.reads('outsider', 'minor'), 'and they become readers');

select * from finish();
rollback;
