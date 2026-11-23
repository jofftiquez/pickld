-- 0152, 0153, 0181: why, mission, story and features are marketing routes on pickld.me (Why Pickld, Our mission, the story, features), so no profile can take them.
begin;
\ir _helpers.psql
select plan(5);

select tests.world();
select is((select count(*)::int from public.reserved_usernames where name in ('why', 'mission', 'story', 'features')), 4,
          'why, mission, story and features are reserved usernames');
select tests.act_as('outsider');
select throws_ok($$update public.profiles set username = 'why' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'why is refused at save');
select throws_ok($$update public.profiles set username = 'Mission' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'mission is refused in any letter case');
select throws_ok($$update public.profiles set username = 'story' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'story is refused at save');
select throws_ok($$update public.profiles set username = 'features' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'features is refused at save');
select tests.reset_role();

select * from finish();
rollback;
