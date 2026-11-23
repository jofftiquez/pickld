-- 0178, 0179: the Close friends audience. Only current readers can be on the list, which only its owner reads
-- and writes; a close-friends moment or jar is seen by the owner and their close friends, tried as owner,
-- close friend, reader, outsider, blocked user, blocker and moderator; readers who aren't close friends can't
-- tell it exists (visible_count, the Jars feed's count, cover and order, notifications, tags, the shared web
-- page); taking someone off the list, or their unfollow, takes their view and notifications away at once; and
-- nobody can ask who is on someone else's list.
begin;
\ir _helpers.psql
select plan(72);

select tests.world();
select tests.create_user('friend');  -- reads owner, owner reads back, on owner's list
select tests.create_user('pal');     -- reads owner, owner reads back, not on the list
insert into public.follows (reader_id, author_id) values
  (tests.id('friend'), tests.id('owner')), (tests.id('owner'), tests.id('friend')),
  (tests.id('pal'), tests.id('owner')), (tests.id('owner'), tests.id('pal')),
  (tests.id('owner'), tests.id('reader'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role, pickld_moderation;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select id from t where k = p_k $$;

create function pg_temp.sees(who text, mid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.moments where id = mid) into r;
  perform tests.reset_role();
  return r;
end $$;
create function pg_temp.sees_jar(who text, jid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.jars where id = jid) into r;
  perform tests.reset_role();
  return r;
end $$;
-- The caller's Jars feed row for a jar, as text: count|cover is a close-friends moment|feed_at offset in hours.
create function pg_temp.feed(who text, jid uuid) returns text language plpgsql as $$
declare r text;
begin
  perform tests.act_as(who);
  select format('%s|%s|%s', f.visible_count, (f.cover_moment_id = pg_temp.id('cf_m'))::text,
                round(extract(epoch from now() - f.feed_at) / 3600))
  into r from public.feed_page() f where f.jar_id = jid;
  perform tests.reset_role();
  return coalesce(r, 'absent');
end $$;
create function pg_temp.notes(p_name text, p_moment uuid) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = tests.id(p_name) and moment_id = p_moment
$$;
create function pg_temp.mention(p_name text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'mention', 'id', 'm-' || p_name, 'x', 0.5, 'y', 0.5, 'scale', 0.3, 'rotation', 0,
                            'userId', tests.id(p_name)::text, 'username', 'x', 'color', 'white')
$$;
create function pg_temp.stickers(p_moment uuid) returns text language sql as $$
  select coalesce(string_agg(o ->> 'username', ',' order by o ->> 'username'), '')
  from public.moments m, jsonb_array_elements(m.edits -> 'overlays') o
  where m.id = p_moment and o ->> 'type' = 'mention'
$$;

-- ---------------------------------------------------------------- schema and privileges
select has_table('public', 'close_friends', 'close_friends exists');
select ok(not has_table_privilege('anon', 'public.close_friends', 'select'), 'anon cannot read close friends');
select ok(not has_table_privilege('authenticated', 'public.close_friends', 'update'), 'nobody updates a list row');
select ok(not has_function_privilege('authenticated', 'public.close_friend_of(uuid, uuid)', 'execute'),
          'clients cannot call the unchecked close_friend_of');
select ok(not has_function_privilege('anon', 'public.is_close_friend(uuid, uuid)', 'execute'),
          'anon cannot call is_close_friend');

-- ---------------------------------------------------------------- who can be on the list
select tests.act_as('owner');
insert into public.close_friends (owner_id, friend_id) values (auth.uid(), tests.id('friend'));
select lives_ok($$ insert into public.close_friends (owner_id, friend_id) values (auth.uid(), tests.id('reader')) $$,
                'the owner adds a reader');
select throws_ok($$ insert into public.close_friends (owner_id, friend_id) values (auth.uid(), tests.id('outsider')) $$,
                 '42501', null, 'someone who doesn''t read you can''t be added');
select throws_ok($$ insert into public.close_friends (owner_id, friend_id) values (auth.uid(), tests.id('blocked')) $$,
                 '42501', null, 'someone you blocked can''t be added');
select throws_ok($$ insert into public.close_friends (owner_id, friend_id) values (auth.uid(), auth.uid()) $$,
                 '42501', null, 'you can''t add yourself');
delete from public.close_friends where friend_id = tests.id('reader');
-- Someone waiting for a Private account's approval (0176) isn't a reader yet, so can't be added.
select tests.reset_role();
select tests.create_user('priv');
select tests.create_user('asker');
update public.profiles set is_private = true where id = tests.id('priv');
select tests.act_as('asker');
insert into public.follows (reader_id, author_id) values (auth.uid(), tests.id('priv'));
select tests.act_as('priv');
select throws_ok($$ insert into public.close_friends (owner_id, friend_id) values (auth.uid(), tests.id('asker')) $$,
                 '42501', null, 'someone still waiting for approval can''t be added');
select tests.act_as('owner');
select is((select count(*)::int from public.close_friends), 1, 'the owner reads their list');
select tests.act_as('reader');
select throws_ok($$ insert into public.close_friends (owner_id, friend_id) values (tests.id('owner'), auth.uid()) $$,
                 '42501', null, 'nobody adds themselves to someone else''s list');
select tests.act_as('friend');
select is((select count(*)::int from public.close_friends), 0, 'a close friend can''t read the owner''s list');
delete from public.close_friends where owner_id = tests.id('owner');
select tests.reset_role();
select is((select count(*)::int from public.close_friends), 1, 'and can''t take themselves off it');

-- ---------------------------------------------------------------- nobody can probe someone else's list
select tests.act_as('reader');
select is(public.is_close_friend(tests.id('owner'), tests.id('friend')), false,
          'a reader asking about someone else''s membership gets false');
select tests.act_as('friend');
select is(public.is_close_friend(tests.id('owner'), tests.id('friend')), true, 'a close friend learns their own membership');
select tests.act_as('owner');
select is(public.is_close_friend(tests.id('owner'), tests.id('friend')), true, 'the owner asks about their list');
select tests.reset_role();

-- ---------------------------------------------------------------- who sees a close-friends moment
-- A published Readers jar with a Readers moment and a close-friends one; a published close-friends jar.
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('r_m', tests.make_moment(pg_temp.id('jar'), 'morning', 'live', p_visibility => 'readers'));
insert into t values ('cf_m', tests.make_moment(pg_temp.id('jar'), 'evening', 'live', p_visibility => 'close_friends'));
insert into t values ('cf_jar', tests.make_jar('owner', 'close_friends', published => true, p_days_ago => 2));
insert into t values ('cf_jar_m', tests.make_moment(pg_temp.id('cf_jar'), 'morning', 'live', p_visibility => 'close_friends'));

create temp table roles (role text primary key, ord int, sees boolean);
grant select on roles to authenticated;
insert into roles values ('owner', 1, true), ('friend', 2, true), ('reader', 3, false), ('pal', 4, false),
  ('outsider', 5, false), ('blocked', 6, false), ('blocker', 7, false), ('moderator', 8, false);
select is(pg_temp.sees(r.role, pg_temp.id('cf_m')), r.sees,
          format('close-friends moment: %s %s', r.role, case when r.sees then 'sees it' else 'does not see it' end))
from roles r order by r.ord;
select is(pg_temp.sees_jar(r.role, pg_temp.id('cf_jar')), r.sees,
          format('close-friends jar: %s %s', r.role, case when r.sees then 'sees it' else 'does not see it' end))
from roles r order by r.ord;
select is((select is_private from public.moments where id = pg_temp.id('cf_m')), false, 'is_private stays Only me only');

-- can_view_moment takes any viewer and a row anyone can build, but can't be used to ask about someone else's list.
create temp table probe as select * from public.moments where id in (pg_temp.id('r_m'), pg_temp.id('cf_jar_m'));
grant select on probe to authenticated;
select tests.act_as('reader');
select is((select public.can_view_moment(tests.id('friend'), row(p.*)::public.moments) from probe p where p.id = pg_temp.id('r_m')),
          true, 'can_view_moment still answers for other viewers on Readers moments');
select is((select public.can_view_moment(tests.id('friend'), row(p.*)::public.moments) from probe p where p.id = pg_temp.id('cf_jar_m')),
          false, 'a reader can''t use can_view_moment to learn who is a close friend');
select tests.reset_role();

-- Likes and reports follow who sees it.
select tests.act_as('reader');
select throws_ok(format($$ insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', %L) $$,
                        pg_temp.id('cf_m')), '42501', null, 'a reader can''t like a close-friends moment');
select tests.act_as('friend');
select lives_ok(format($$ insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', %L) $$,
                       pg_temp.id('cf_m')), 'a close friend can');
select tests.reset_role();

-- ---------------------------------------------------------------- readers who aren't close friends can't tell
select is((select visible_count::int from public.jars where id = pg_temp.id('jar')), 1,
          'visible_count leaves the close-friends moment out, like Only me');
-- The Readers moment went in 2 hours ago, the close-friends one 1 hour ago, the jar was published 3 hours ago.
set local session_replication_role = replica;
update public.moments set added_at = now() - interval '2 hours' where id = pg_temp.id('r_m');
update public.moments set added_at = now() - interval '1 hour' where id = pg_temp.id('cf_m');
update public.jars set published_at = now() - interval '3 hours', cover_moment_id = pg_temp.id('cf_m')
where id = pg_temp.id('jar');
set local session_replication_role = origin;
select is(pg_temp.feed('reader', pg_temp.id('jar')), '1|false|2',
          'Jars feed, reader: counts 1, not the close-friends cover, and not moved up by it');
select is(pg_temp.feed('pal', pg_temp.id('jar')), '1|false|2', 'Jars feed, mutual reader off the list: the same');
select is(pg_temp.feed('friend', pg_temp.id('jar')), '2|true|1', 'Jars feed, close friend: counts 2, the cover, moved up');
select is(pg_temp.feed('owner', pg_temp.id('jar')), '2|true|1', 'Jars feed, owner: the same');
select is(pg_temp.feed('reader', pg_temp.id('cf_jar')), 'absent', 'a reader''s Jars feed has no close-friends jar');
select is(pg_temp.feed('friend', pg_temp.id('cf_jar')) <> 'absent', true, 'a close friend''s has it');
select tests.act_as('reader');
select is((select round(extract(epoch from now() - latest_at) / 3600)::int from public.feed_authors()
           where author_id = tests.id('owner')), 2, 'the reader''s author row isn''t moved up by it');
select is((select sum(n)::int from public.feed_days('Asia/Manila')), 1,
          'the reader''s scrubber counts only the Readers jar');
select is((select count(*)::int from public.moments_feed_page() f where f.moment_id = pg_temp.id('cf_m')), 0,
          'the reader''s Moments feed doesn''t have it');
select tests.act_as('friend');
select is((select sum(n)::int from public.feed_days('Asia/Manila')), 2, 'the close friend''s counts both jars');
select is((select count(*)::int from public.moments_feed_page() f where f.moment_id = pg_temp.id('cf_m')), 1,
          'the close friend''s Moments feed does');
select tests.act_as('reader');
select is((select visible_count::int from public.moment_jar(pg_temp.id('jar'))), 1, 'moment_jar gives the reader the reader count');
select tests.reset_role();

-- Never on pickld.me.
select tests.act_as_anon();
select is(public.public_jar(pg_temp.id('cf_jar')), null, 'the shared web page doesn''t find a close-friends jar');
select is((public.public_jar(pg_temp.id('jar')) ->> 'visible_count')::int, 1,
          'a Readers jar''s teaser count leaves the close-friends moment out');
select tests.reset_role();

-- ---------------------------------------------------------------- notifications
select public.notify(tests.id('reader'), 'reply', tests.id('pal'), pg_temp.id('jar'), pg_temp.id('cf_m'));
select public.notify(tests.id('friend'), 'reply', tests.id('pal'), pg_temp.id('jar'), pg_temp.id('cf_m'));
select is(pg_temp.notes('reader', pg_temp.id('cf_m')), 0, 'a reader off the list is never told about a close-friends moment');
select is(pg_temp.notes('friend', pg_temp.id('cf_m')), 1, 'a close friend is');
select is(pg_temp.notes('owner', pg_temp.id('cf_m')), 1, 'the owner is told of the close friend''s like');
select public.notify(tests.id('reader'), 'comment', tests.id('pal'), pg_temp.id('cf_jar'));
select public.notify(tests.id('friend'), 'comment', tests.id('pal'), pg_temp.id('cf_jar'));
select is((select count(*)::int from public.notifications where jar_id = pg_temp.id('cf_jar') and user_id = tests.id('reader')), 0,
          'a reader off the list is never told about a close-friends jar');
select is((select count(*)::int from public.notifications where jar_id = pg_temp.id('cf_jar') and user_id = tests.id('friend')), 1,
          'a close friend is');

-- ---------------------------------------------------------------- tags
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, status, visibility, edits, caption)
values (pg_temp.id('jar'), auth.uid(), 'afternoon', 'p/cf', 't/cf', 'checking', 'close_friends',
        jsonb_build_object('v', 1, 'filter', 'original', 'overlays', jsonb_build_array(pg_temp.mention('friend'), pg_temp.mention('pal'))),
        'with @t_pal');
select tests.reset_role();
insert into t select 'cf_tag', id from public.moments where jar_id = pg_temp.id('jar') and slot = 'afternoon';
select is(pg_temp.stickers(pg_temp.id('cf_tag')), 't_friend', 'on a close-friends moment only a close friend''s sticker is kept');
select is((select string_agg(u.name, ',' order by u.name) from public.moment_tags mt join tests.users u on u.id = mt.tagged_id
           where mt.moment_id = pg_temp.id('cf_tag')), 'friend', 'and the caption doesn''t tag someone off the list');
select tests.set_status(pg_temp.id('cf_tag'), 'live');
select is(pg_temp.notes('friend', pg_temp.id('cf_tag')), 1, 'the tagged close friend is told');

-- A Readers moment tagging the pal turns close friends: the pal's tag notification goes and they can't see the tag.
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, status, caption)
values (pg_temp.id('jar'), auth.uid(), 'selfie', 'p/rt', 't/rt', 'checking', 'with @t_pal');
select tests.reset_role();
insert into t select 'r_tag', id from public.moments where jar_id = pg_temp.id('jar') and slot = 'selfie';
select tests.set_status(pg_temp.id('r_tag'), 'live');
select is(pg_temp.notes('pal', pg_temp.id('r_tag')), 1, 'a tag on a Readers moment tells the pal');
select tests.act_as('owner');
update public.moments set visibility = 'close_friends' where id = pg_temp.id('r_tag');
select tests.reset_role();
select is(pg_temp.notes('pal', pg_temp.id('r_tag')), 0, 'turning it close friends takes the pal''s tag notification back');
select tests.act_as('pal');
select is((select count(*)::int from public.moment_tags where moment_id = pg_temp.id('r_tag')), 0,
          'and the pal doesn''t see their tag on it');
select throws_ok(format($$ select public.request_together(%L) $$, pg_temp.id('r_tag')), '42501', null,
                 'or ask to show it on their Together page');
select tests.act_as('owner');
select is((select count(*)::int from public.moment_tags where moment_id = pg_temp.id('r_tag')), 1,
          'the tag stays for the owner');
select tests.reset_role();

-- ---------------------------------------------------------------- the profile default
update public.profiles set default_visibility = 'close_friends' where id = tests.id('owner');
insert into t values ('jar_today', tests.make_jar('owner', 'readers'));
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path)
values (pg_temp.id('jar_today'), auth.uid(), 'morning', 'p/d', 't/d');
select tests.reset_role();
select is((select visibility::text from public.moments where jar_id = pg_temp.id('jar_today')), 'close_friends',
          'a new moment starts at a close-friends default');

-- ---------------------------------------------------------------- taking someone off the list
select tests.act_as('owner');
delete from public.close_friends where friend_id = tests.id('friend');
select tests.reset_role();
select is(pg_temp.sees('friend', pg_temp.id('cf_m')), false, 'taken off the list: they no longer see past close-friends moments');
select is(pg_temp.sees_jar('friend', pg_temp.id('cf_jar')), false, 'or close-friends jars');
select is(pg_temp.notes('friend', pg_temp.id('cf_m')) + pg_temp.notes('friend', pg_temp.id('cf_tag')), 0,
          'and their notifications about them go');
select is((select count(*)::int from public.notifications where jar_id = pg_temp.id('cf_jar') and user_id = tests.id('friend')), 0,
          'including jar notifications');

-- An unfollow takes them off the list.
insert into public.close_friends (owner_id, friend_id) values (tests.id('owner'), tests.id('friend'));
select tests.act_as('friend');
delete from public.follows where reader_id = auth.uid() and author_id = tests.id('owner');
select tests.reset_role();
select is((select count(*)::int from public.close_friends where friend_id = tests.id('friend')), 0,
          'stopping reading takes them off the list');

select * from finish();
rollback;
