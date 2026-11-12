-- M4-12 (0025; FR-WEB-01, FR-PUB-03, FR-PUB-05; C-6, D-9, D-11): public_profile() and public_jar() for the
-- shared-link site, called as anon. Only live, non-private, unhidden moments of published Everyone jars
-- come back; Readers jars give a teaser with no moments; Only me, unpublished, missing and inactive
-- authors all give null.
begin;
\ir _helpers.psql
select plan(37);

select tests.create_user('owner');
select tests.create_user('susp');
select tests.create_user('gone');

create temp table k (name text primary key, id uuid not null);
grant select on k to anon, authenticated;

-- Everyone jar (today): one live public moment and five that must stay out.
insert into k select 'everyone', tests.make_jar('owner', 'everyone', published => true);
insert into k select 'live', tests.make_moment((select id from k where name = 'everyone'), 'morning', 'live');
insert into k select 'private', tests.make_moment((select id from k where name = 'everyone'), 'afternoon', 'live', p_private => true);
insert into k select 'checking', tests.make_moment((select id from k where name = 'everyone'), 'evening', 'checking');
insert into k select 'removed', tests.make_moment((select id from k where name = 'everyone'), 'selfie', 'removed');
insert into k select 'hidden', tests.make_moment((select id from k where name = 'everyone'), 'ootd', 'live');
update public.moments set hidden_at = now() where id = (select id from k where name = 'hidden');
update public.moments set caption = 'hello world' where id = (select id from k where name = 'live');
update public.moments set caption = 'secret private' where id = (select id from k where name = 'private');

-- Readers jar with a live public moment, Only me and unpublished Everyone jars, and an Everyone jar
-- with nothing visible.
insert into k select 'readers', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1);
insert into k select 'readers_m', tests.make_moment((select id from k where name = 'readers'), 'morning', 'live');
update public.moments set caption = 'readers secret' where id = (select id from k where name = 'readers_m');
insert into k select 'only_me', tests.make_jar('owner', 'only_me', published => true, p_days_ago => 2);
select tests.make_moment((select id from k where name = 'only_me'), 'morning', 'live');
insert into k select 'unpublished', tests.make_jar('owner', 'everyone', published => false, p_days_ago => 3);
select tests.make_moment((select id from k where name = 'unpublished'), 'morning', 'live');
insert into k select 'empty', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 4);
select tests.make_moment((select id from k where name = 'empty'), 'morning', 'live', p_private => true);

-- Authors suspended by moderation (D-11) and deleted, each with a live Everyone jar.
insert into k select 'susp_jar', tests.make_jar('susp', 'everyone', published => true);
select tests.make_moment((select id from k where name = 'susp_jar'), 'morning', 'live');
insert into k select 'gone_jar', tests.make_jar('gone', 'everyone', published => true);
select tests.make_moment((select id from k where name = 'gone_jar'), 'morning', 'live');
update public.profiles set status = 'suspended' where id = tests.id('susp');
update public.profiles set status = 'deleted' where id = tests.id('gone');

-- Expected values, read before switching to anon (anon can't read the tables).
create temp table x (name text primary key, t text);
insert into x values
  ('live_photo', (select photo_path from public.moments where id = (select id from k where name = 'live'))),
  ('readers_photo', (select photo_path from public.moments where id = (select id from k where name = 'readers_m'))),
  ('readers_date', (select local_date::text from public.jars where id = (select id from k where name = 'readers')));
grant select on x to anon, authenticated;

create temp table r (name text primary key, v jsonb);
grant select, insert on r to anon, authenticated;

-- ---------------------------------------------------------------- grants
select ok(has_function_privilege('anon', 'public.public_profile(text)', 'execute'), 'anon may call public_profile');
select ok(has_function_privilege('anon', 'public.public_jar(uuid)', 'execute'), 'anon may call public_jar');

select tests.act_as_anon();
insert into r select 'everyone', public.public_jar((select id from k where name = 'everyone'));
insert into r select 'readers', public.public_jar((select id from k where name = 'readers'));
insert into r select 'profile', public.public_profile('t_owner');

-- ---------------------------------------------------------------- public_jar: Everyone
select is((select v ->> 'visibility' from r where name = 'everyone'), 'everyone', 'Everyone jar is returned to anon');
select is((select (v ->> 'readers_only')::boolean from r where name = 'everyone'), false, 'and is not readers-only');
select is((select array_agg((m ->> 'id')::uuid) from r, jsonb_array_elements(v -> 'moments') m where name = 'everyone'),
          array[(select id from k where name = 'live')],
          'only the live, public, unhidden moment (no private, checking, removed or hidden ones)');
select is((select (v ->> 'visible_count')::int from r where name = 'everyone'), 1, 'visible_count counts only that moment');
select is((select v -> 'moments' -> 0 ->> 'caption' from r where name = 'everyone'), 'hello world', 'with its caption');
select is((select v -> 'moments' -> 0 ->> 'photo_path' from r where name = 'everyone'),
          (select t from x where name = 'live_photo'),
          'and its photo key');
select is((select v -> 'moments' -> 0 ->> 'slot' from r where name = 'everyone'), 'morning', 'and its slot');
select ok((select v::text not like '%secret private%' from r where name = 'everyone'), 'no private caption anywhere');
select is((select v -> 'author' ->> 'username' from r where name = 'everyone'), 't_owner', 'author public fields');
select ok((select not (v -> 'author' ? 'birthday') and not (v -> 'author' ? 'home_tz')
              and not (v -> 'author' ? 'jar_count') from r where name = 'everyone'),
          'author has no birthday, home zone or jar count');

-- ---------------------------------------------------------------- public_jar: Readers teaser
select is((select (v ->> 'readers_only')::boolean from r where name = 'readers'), true, 'Readers jar is a teaser');
select is((select v ->> 'local_date' from r where name = 'readers'),
          (select t from x where name = 'readers_date'),
          'teaser has the date');
select is((select (v ->> 'visible_count')::int from r where name = 'readers'), 1, 'teaser has the visible count');
select is((select v -> 'author' ->> 'username' from r where name = 'readers'), 't_owner', 'teaser has the author');
select ok((select not (v ? 'moments') from r where name = 'readers'), 'teaser has no moments');
select ok((select v::text not like '%readers secret%' from r where name = 'readers'), 'teaser has no captions');
select ok((select v::text not like '%' || (select id from k where name = 'readers_m') || '%'
              and v::text not like '%' || (select t from x where name = 'readers_photo') || '%'
           from r where name = 'readers'),
          'teaser has no moment ids or photo keys');

-- ---------------------------------------------------------------- public_jar: null cases
select is(public.public_jar((select id from k where name = 'only_me')), null::jsonb, 'Only me jar is null');
select is(public.public_jar((select id from k where name = 'unpublished')), null::jsonb, 'unpublished jar is null');
select is(public.public_jar((select id from k where name = 'susp_jar')), null::jsonb, 'suspended author''s jar is null');
select is(public.public_jar((select id from k where name = 'gone_jar')), null::jsonb, 'deleted author''s jar is null');
select is(public.public_jar(gen_random_uuid()), null::jsonb, 'unknown jar is null');
select is(public.public_jar((select id from k where name = 'empty')) -> 'moments', '[]'::jsonb,
          'Everyone jar with only a private moment has no moments');

-- ---------------------------------------------------------------- public_profile
select is((select v -> 'profile' ->> 'id' from r where name = 'profile'), tests.id('owner')::text, 'profile by username');
select ok((select not (v -> 'profile' ? 'birthday') and not (v -> 'profile' ? 'home_tz')
              and not (v -> 'profile' ? 'default_visibility') and not (v -> 'profile' ? 'feed_seen_at')
              and not (v -> 'profile' ? 'jar_count')
           from r where name = 'profile'),
          'profile has no birthday or other private fields');
select is((select array_agg((j ->> 'id')::uuid) from r, jsonb_array_elements(v -> 'jars') j where name = 'profile'),
          array[(select id from k where name = 'everyone')],
          'jars: only published Everyone jars with something visible (no Readers, Only me, unpublished or empty)');
select is((select array_agg((m ->> 'id')::uuid) from r, jsonb_array_elements(v -> 'jars' -> 0 -> 'moments') m where name = 'profile'),
          array[(select id from k where name = 'live')], 'jar moments: only the live public one');
select is((select (v -> 'jars' -> 0 ->> 'visible_count')::int from r where name = 'profile'), 1, 'jar visible_count');
select ok((select v::text not like '%secret%' from r where name = 'profile'), 'no private or Readers captions in the profile');
select is(public.public_profile('T_OWNER') -> 'profile' ->> 'id', tests.id('owner')::text, 'username is case-insensitive');
select is(public.public_profile('t_susp'), null::jsonb, 'suspended profile is null');
select is(public.public_profile('t_gone'), null::jsonb, 'deleted profile is null');
select is(public.public_profile('nobody_here'), null::jsonb, 'unknown username is null');

-- ---------------------------------------------------------------- signed in: same answer
select tests.act_as('owner');
select is(public.public_jar((select id from k where name = 'only_me')), null::jsonb, 'even the owner gets null for Only me');
select is(public.public_jar((select id from k where name = 'everyone')), (select v from r where name = 'everyone'),
          'a signed-in caller gets what anon gets');

select * from finish();
rollback;
