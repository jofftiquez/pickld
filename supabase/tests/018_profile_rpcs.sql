-- M3-12 (0017): username_available is case-insensitive and respects reserved words; search_follow_list
-- excludes blocked users and searches by name or username; the author can remove a reader
-- (FR-SOC-07, FR-SOC-09, FR-ACC-03; C-2).
begin;
\ir _helpers.psql
select plan(24);

-- world(): reader, blocked and blocker follow owner; owner blocked "blocked"; "blocker" blocked owner.
-- Blocks drop follows both ways, so owner's readers are just reader. Add more to search through.
select tests.world();
select tests.create_user('mika');
select tests.create_user('aya');
update public.profiles set username = 'mika_reyes', display_name = 'Mika Reyes' where id = tests.id('mika');
update public.profiles set username = 'aya.c', display_name = 'Aya Cruz' where id = tests.id('aya');
insert into public.follows (reader_id, author_id) values
  (tests.id('mika'), tests.id('owner')),
  (tests.id('aya'), tests.id('owner')),
  (tests.id('owner'), tests.id('mika')),   -- owner reads mika back
  (tests.id('reader'), tests.id('mika'));  -- reader also reads mika
-- outsider blocks aya: aya disappears from every list outsider looks at.
insert into public.blocks (blocker_id, blocked_id) values (tests.id('outsider'), tests.id('aya'));

create function pg_temp.names(who text, owner_name text, l text, q text default '') returns text[] language plpgsql as $$
declare r text[];
begin
  perform tests.act_as(who);
  select coalesce(array_agg(username order by username), '{}') into r
  from public.search_follow_list(tests.id(owner_name), l, q);
  perform tests.reset_role();
  return r;
end $$;

-- ---------------------------------------------------------------- username_available
select tests.act_as('reader');
select is(public.username_available('fresh_name'), 'available', 'an unused name is available');
select is(public.username_available('mika_reyes'), 'taken', 'a used name is taken');
select is(public.username_available('MIKA_Reyes'), 'taken', 'taken in any letter case');
select is(public.username_available('settings'), 'reserved', 'a route word is reserved');
select is(public.username_available('Explore'), 'reserved', 'reserved in any letter case');
select is(public.username_available('ab'), 'invalid', 'too short is invalid');
select is(public.username_available('has space'), 'invalid', 'spaces are invalid');
select is(public.username_available(null), 'invalid', 'null is invalid');
select is(public.username_available('T_READER'), 'available', 'your own username (any case) is available to you');
select tests.act_as('mika');
select is(public.username_available('t_reader'), 'taken', 'but taken for everyone else');
-- A blocked or suspended holder still holds the name.
select tests.act_as('owner');
select is(public.username_available('t_blocked'), 'taken', 'a name held by someone you blocked is still taken');
select tests.act_as_anon();
select throws_ok($$select public.username_available('x_y_z')$$, '42501', null, 'anonymous callers cannot probe names');
select tests.reset_role();

-- ---------------------------------------------------------------- search_follow_list
select is(pg_temp.names('owner', 'owner', 'readers'), array['aya.c', 'mika_reyes', 't_reader'],
          'owner sees their readers; blocked and blocker are gone');
select is(pg_temp.names('owner', 'owner', 'authors'), array['mika_reyes'], 'owner sees who they read');
select is(pg_temp.names('outsider', 'owner', 'readers'), array['mika_reyes', 't_reader'],
          'someone who blocked aya does not see aya in anyone''s list');
select is(pg_temp.names('blocked', 'owner', 'readers'), '{}'::text[],
          'a user the owner blocked sees nothing of the owner''s lists');
select is(pg_temp.names('owner', 'owner', 'readers', 'REYES'), array['mika_reyes'], 'search matches the name, any case');
select is(pg_temp.names('owner', 'owner', 'readers', 'aya.'), array['aya.c'], 'search matches the username');
select is(pg_temp.names('owner', 'owner', 'readers', '_'), array['mika_reyes', 't_reader'],
          'an underscore is matched literally, not as a wildcard');
select is(pg_temp.names('owner', 'owner', 'friends'), '{}'::text[], 'an unknown list is empty');

select tests.act_as('reader');
select is((select array[is_following, follows_viewer] from public.search_follow_list(tests.id('owner'), 'readers', 'mika')),
          array[true, false], 'reader sees they read mika (Reading) and mika does not read them');
select tests.act_as('owner');
select is((select array[is_following, follows_viewer] from public.search_follow_list(tests.id('owner'), 'readers', 'mika')),
          array[true, true], 'owner and mika read each other');

-- ---------------------------------------------------------------- remove a reader (existing follows_delete)
select tests.act_as('outsider');
delete from public.follows where author_id = tests.id('owner') and reader_id = tests.id('aya');
select tests.act_as('owner');
select is((select count(*) from public.follows where author_id = auth.uid() and reader_id = tests.id('aya')), 1::bigint,
          'someone else cannot remove the owner''s reader');
delete from public.follows where author_id = auth.uid() and reader_id = tests.id('aya');
select is((select array[reader_count, (select author_count from public.profiles where id = tests.id('aya'))]
           from public.profiles where id = auth.uid()), array[2, 0],
          'the owner removes a reader and both counts follow');

select * from finish();
rollback;
