-- 0120: paging for the console's queue and account search (FR-MOD-02, FR-MOD-07). Only moderators can page
-- either list; owner, reader, outsider, blocked and anon are refused. Pages follow the order (oldest first by
-- default, newest first on request; accounts by the chosen sort with an exact username first), every account
-- row carries the match count, and mod_queue() and mod_user_search() still return what they did.
begin;
\ir _helpers.psql
select plan(30);

-- Open items already in the database would shift the pages; set them aside (rolled back at the end).
update public.moderation_items set status = 'kept', decided_at = now() where status in ('pending', 'escalated');

select tests.world();
select tests.create_user('pga');
select tests.create_user('pgb');
select tests.create_user('pgc');
select tests.create_user('pg');
update public.profiles set created_at = now() - interval '3 days' where id = tests.id('pga');
update public.profiles set created_at = now() - interval '2 days' where id = tests.id('pgb');
update public.profiles set created_at = now() - interval '1 day' where id = tests.id('pgc');

create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'everyone', published => true));
insert into t values ('a', tests.make_moment((select id from t where k = 'jar'), 'morning', 'checking'));
insert into t values ('b', tests.make_moment((select id from t where k = 'jar'), 'afternoon', 'checking'));
insert into t values ('c', tests.make_moment((select id from t where k = 'jar'), 'evening', 'checking'));
insert into public.moderation_items (moment_id, source, scores, created_at)
select (select id from t where k = v.k), 'auto_check', '{}', now() - v.age
from (values ('a', interval '3 hours'), ('b', interval '2 hours'), ('c', interval '1 hour')) v(k, age);

create function pg_temp.moments(p_limit int, p_offset int, p_newest boolean default false) returns text[]
language sql as $$
  select coalesce(array_agg(t.k order by q.n), '{}')
  from (select moment_id, row_number() over () as n
        from public.mod_queue_page('all', p_limit, p_offset, p_newest)) q
  join t on t.id = q.moment_id
$$;
create function pg_temp.people(p_query text, p_sort text, p_limit int, p_offset int) returns uuid[]
language sql as $$
  select coalesce(array_agg(s.id order by s.n), '{}')
  from (select id, row_number() over () as n from public.mod_user_search_page(p_query, p_sort, p_limit, p_offset)) s
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- who can call them
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_queue_page'),
          'pickld_moderation/true', 'mod_queue_page is security definer, owned by pickld_moderation');
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_queue'),
          'pickld_moderation/true', 'mod_queue keeps its owner');
select ok((select prosecdef from pg_proc where proname = 'mod_user_search_page'), 'mod_user_search_page is security definer');
select ok(not has_schema_privilege('pickld_moderation', 'public', 'create'), 'pickld_moderation still cannot create objects');

select tests.act_as_anon();
select throws_ok($$select * from public.mod_queue_page()$$, '42501', null, 'anon cannot page the queue');
select throws_ok($$select * from public.mod_user_search_page('')$$, '42501', null, 'anon cannot page accounts');
select tests.act_as('owner');
select throws_ok($$select * from public.mod_queue_page()$$, '42501', 'moderators only', 'the owner cannot page the queue');
select throws_ok($$select * from public.mod_user_search_page('')$$, '42501', 'moderators only', 'the owner cannot page accounts');
select tests.act_as('reader');
select throws_ok($$select * from public.mod_queue_page()$$, '42501', 'moderators only', 'a reader cannot page the queue');
select throws_ok($$select * from public.mod_user_search_page('')$$, '42501', 'moderators only', 'a reader cannot page accounts');
select tests.act_as('outsider');
select throws_ok($$select * from public.mod_queue_page()$$, '42501', 'moderators only', 'an outsider cannot page the queue');
select throws_ok($$select * from public.mod_user_search_page('')$$, '42501', 'moderators only', 'an outsider cannot page accounts');
select tests.act_as('blocked');
select throws_ok($$select * from public.mod_queue_page()$$, '42501', 'moderators only', 'a blocked user cannot page the queue');
select throws_ok($$select * from public.mod_user_search_page('')$$, '42501', 'moderators only', 'a blocked user cannot page accounts');

-- ---------------------------------------------------------------- the queue
select tests.act_as('moderator');
select is(pg_temp.moments(2, 0), array['a', 'b'], 'page 1 of 2: the two oldest');
select is(pg_temp.moments(2, 2), array['c'], 'page 2 of 2: the rest');
select is(pg_temp.moments(2, 4), '{}'::text[], 'past the end: nothing');
select is(pg_temp.moments(2, 0, true), array['c', 'b'], 'newest first on request');
select is(pg_temp.moments(2, -5), array['a', 'b'], 'a negative offset reads as 0');
select is((select array_agg(t.k order by q.n)
           from (select moment_id, row_number() over () as n from public.mod_queue()) q join t on t.id = q.moment_id),
          array['a', 'b', 'c'], 'mod_queue still lists every open item, oldest first');
select throws_ok($$select * from public.mod_queue_page('nope')$$, '22023', null, 'an unknown filter is refused');

-- ---------------------------------------------------------------- accounts
-- (A report opens a queue item too, so it comes after the queue checks.)
select tests.reset_role();
insert into public.reports (reporter_id, target, target_id, reason)
values (tests.id('reader'), 'profile', tests.id('pgb'), 'spam');
select tests.act_as('moderator');
select is((select array_agg(distinct total) from public.mod_user_search_page('t_pg', 'newest', 2, 0)), array[4],
          'every row carries the number of matches');
select is(pg_temp.people('t_pg', 'oldest', 10, 0),
          array[tests.id('pg'), tests.id('pga'), tests.id('pgb'), tests.id('pgc')],
          'the exact username comes first, then the oldest');
select is(pg_temp.people('t_pg', 'oldest', 2, 2), array[tests.id('pgb'), tests.id('pgc')], 'the second page');
select is(pg_temp.people('t_pg', 'reports', 2, 0), array[tests.id('pg'), tests.id('pgb')],
          'most open reports after the exact match');
select is(pg_temp.people('t_pga', 'username', 5, 0), array[tests.id('pga')], 'a search narrows the matches');
select is((select array_agg(id) from public.mod_user_search('t_pg')),
          pg_temp.people('t_pg', 'newest', 50, 0), 'mod_user_search is the newest-first page');
select is((select count(*)::int from public.mod_user_search_page('t_pg', 'newest', 2, 10)), 0, 'past the end: nothing');
select throws_ok($$select * from public.mod_user_search_page('', 'nope')$$, '22023', null, 'an unknown sort is refused');
select throws_ok($$select * from public.mod_user_search_page(repeat('x', 255))$$, '22023', null,
                 'a query over 254 characters is refused');

select * from finish();
rollback;
