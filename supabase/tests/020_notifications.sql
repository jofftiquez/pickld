-- M3-16 (0019): notification triggers and preferences (FR-NOT-02, FR-NOT-03, FR-NOT-04). No notification
-- for blocked actors, private moments or your own actions; unlike and block clean up; prefs are owner-only.
begin;
\ir _helpers.psql
select plan(37);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('m', tests.make_moment((select id from t where k = 'jar'), 'morning'));
insert into t values ('priv', tests.make_moment((select id from t where k = 'jar'), 'evening', p_private => true));

create function pg_temp.n(who text, typ text, actor text default null) returns bigint language sql as $$
  select count(*) from public.notifications
  where user_id = tests.id(who) and type = typ and (actor is null or actor_id = tests.id(actor))
$$;
create function pg_temp.jar() returns uuid language sql as $$ select id from t where k = 'jar' $$;
create function pg_temp.m(k text) returns uuid language sql as $$ select id from t where k = $1 $$;

-- ---------------------------------------------------------------- likes
select tests.act_as('reader');
insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', pg_temp.jar());
insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', pg_temp.m('m'));
select tests.reset_role();
select is(pg_temp.n('owner', 'like', 'reader'), 2::bigint, 'a reader liking the jar and a moment notifies the owner twice');
select is((select moment_id from public.notifications where user_id = tests.id('owner') and type = 'like' and moment_id is not null),
          pg_temp.m('m'), 'the moment like points at the moment');
select is((select jar_id from public.notifications where user_id = tests.id('owner') and type = 'like' and moment_id is not null),
          pg_temp.jar(), 'and at its jar');

select tests.act_as('owner');
insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', pg_temp.jar());
select tests.reset_role();
select is(pg_temp.n('owner', 'like', 'owner'), 0::bigint, 'liking your own jar notifies nobody');

-- Written as the superuser, past RLS, to prove the trigger itself refuses.
insert into public.reactions (user_id, target, target_id) values (tests.id('reader'), 'moment', pg_temp.m('priv'));
select is((select count(*) from public.notifications where moment_id = pg_temp.m('priv')), 0::bigint,
          'a like on a private moment writes no notification');
insert into public.reactions (user_id, target, target_id) values (tests.id('blocked'), 'jar', pg_temp.jar());
select is(pg_temp.n('owner', 'like', 'blocked'), 0::bigint, 'a like from someone the owner blocked writes nothing');
insert into public.reactions (user_id, target, target_id) values (tests.id('blocker'), 'jar', pg_temp.jar());
select is(pg_temp.n('owner', 'like', 'blocker'), 0::bigint, 'a like from someone who blocked the owner writes nothing');

select tests.act_as('reader');
delete from public.reactions where user_id = auth.uid() and target = 'jar';
select tests.reset_role();
select is(pg_temp.n('owner', 'like', 'reader'), 1::bigint, 'unliking the jar removes its unread notification, the moment like stays');

-- ---------------------------------------------------------------- comments and replies
select tests.act_as('reader');
insert into public.comments (id, jar_id, user_id, body)
values ('c3000000-0000-4000-8000-000000000001', pg_temp.jar(), auth.uid(), 'Nice light');
select tests.reset_role();
select is(pg_temp.n('owner', 'comment'), 0::bigint, 'a pending comment notifies nobody (rule 4)');
select tests.act_as_service();
select public.moderation_apply_comment('c3000000-0000-4000-8000-000000000001', 'approve', 'test');
select tests.reset_role();
select is(pg_temp.n('owner', 'comment', 'reader'), 1::bigint, 'once visible, the comment notifies the jar owner');
select is((select comment_id from public.notifications where user_id = tests.id('owner') and type = 'comment'),
          'c3000000-0000-4000-8000-000000000001'::uuid, 'and points at the comment');

-- The owner replies: the reader gets a reply, the owner nothing (their own action).
select tests.act_as('owner');
insert into public.comments (id, jar_id, user_id, parent_id, body)
values ('c3000000-0000-4000-8000-000000000002', pg_temp.jar(), auth.uid(), 'c3000000-0000-4000-8000-000000000001', 'Thanks!');
select tests.act_as_service();
select public.moderation_apply_comment('c3000000-0000-4000-8000-000000000002', 'approve', 'test');
select tests.reset_role();
select is(pg_temp.n('reader', 'reply', 'owner'), 1::bigint, 'the parent author gets a reply');
select is(pg_temp.n('owner', 'comment', 'owner') + pg_temp.n('owner', 'reply', 'owner'), 0::bigint,
          'the owner is not notified of their own reply');

-- An outsider replies to the reader (the jar is readers-only, so as the superuser): reader gets reply, owner gets comment.
insert into public.comments (id, jar_id, user_id, parent_id, body)
values ('c3000000-0000-4000-8000-000000000003', pg_temp.jar(), tests.id('outsider'), 'c3000000-0000-4000-8000-000000000001', 'Agreed');
select tests.act_as_service();
select public.moderation_apply_comment('c3000000-0000-4000-8000-000000000003', 'approve', 'test');
select tests.reset_role();
select is(pg_temp.n('reader', 'reply', 'outsider'), 1::bigint, 'a reply notifies the parent author');
select is(pg_temp.n('owner', 'comment', 'outsider'), 1::bigint, 'and the jar owner, as a comment');

-- A comment by someone the owner blocked (written past RLS) notifies nobody.
insert into public.comments (id, jar_id, user_id, body)
values ('c3000000-0000-4000-8000-000000000004', pg_temp.jar(), tests.id('blocked'), 'hey');
select tests.act_as_service();
select public.moderation_apply_comment('c3000000-0000-4000-8000-000000000004', 'approve', 'test');
select tests.reset_role();
select is((select count(*) from public.notifications where actor_id = tests.id('blocked')), 0::bigint,
          'a blocked person''s comment notifies nobody');

-- ---------------------------------------------------------------- removed and appeal decided
select tests.set_status(pg_temp.m('m'), 'removed');
select is(pg_temp.n('owner', 'removed'), 1::bigint, 'a removed moment notifies its owner');
select is((select actor_id from public.notifications where user_id = tests.id('owner') and type = 'removed'), null,
          'with no actor');
select tests.set_status(pg_temp.m('priv'), 'removed');
select is(pg_temp.n('owner', 'removed'), 2::bigint, 'the owner hears about their own private moment''s removal');
select is((select count(*) from public.notifications where moment_id = pg_temp.m('priv') and user_id <> tests.id('owner')),
          0::bigint, 'and nobody else does');

insert into public.moderation_items (id, moment_id, source, status) values
  ('d3000000-0000-4000-8000-000000000001', pg_temp.m('m'), 'auto_check', 'removed');
insert into public.appeals (id, moderation_item_id, user_id, message) values
  ('e3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', tests.id('owner'), 'it was fine');
select is(pg_temp.n('owner', 'appeal_decided'), 0::bigint, 'an open appeal notifies nobody');
update public.appeals set status = 'overturned' where id = 'e3000000-0000-4000-8000-000000000001';
select is(pg_temp.n('owner', 'appeal_decided'), 1::bigint, 'a decided appeal notifies its author');
select is((select moment_id from public.notifications where user_id = tests.id('owner') and type = 'appeal_decided'),
          pg_temp.m('m'), 'pointing at the moment');

-- ---------------------------------------------------------------- friend joined
select tests.act_as('reader');
select throws_ok($$select public.notify_friend_joined(tests.id('outsider'), array[auth.uid()])$$, '42501', null,
                 'clients cannot write friend_joined');
select tests.act_as_service();
select is(public.notify_friend_joined(tests.id('outsider'), array[tests.id('reader'), tests.id('owner'), tests.id('outsider')]),
          2, 'friend_joined goes to each match except the new user');
select is(public.notify_friend_joined(tests.id('outsider'), array[tests.id('reader')]), 0, 'and only once per pair');
select is(public.notify_friend_joined(tests.id('blocked'), array[tests.id('owner')]), 0, 'never between blocked people');
select tests.reset_role();
update public.profiles set created_at = now() - interval '8 days' where id = tests.id('moderator');
select tests.act_as_service();
select is(public.notify_friend_joined(tests.id('moderator'), array[tests.id('reader')]), 0,
          'an account older than 7 days is not announced');
select tests.reset_role();

-- ---------------------------------------------------------------- notify() is not callable
select tests.act_as('reader');
select throws_ok($$select public.notify(tests.id('owner'), 'like', auth.uid())$$, '42501', null,
                 'clients cannot call notify()');
select throws_ok($$insert into public.notifications (user_id, type) values (auth.uid(), 'like')$$, '42501', null,
                 'clients cannot insert notifications');
select tests.reset_role();
select throws_ok($$insert into public.notifications (user_id, type) values (tests.id('owner'), 'poke')$$, '23514', null,
                 'unknown types are refused');

-- ---------------------------------------------------------------- blocking clears
insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner'), tests.id('outsider'));
select is((select count(*) from public.notifications
           where (user_id = tests.id('owner') and actor_id = tests.id('outsider'))
              or (user_id = tests.id('outsider') and actor_id = tests.id('owner'))), 0::bigint,
          'blocking deletes the notifications between the two, both ways');

-- ---------------------------------------------------------------- preferences
select is((select count(*) from public.notification_prefs where user_id = tests.id('owner')), 1::bigint,
          'a new profile gets a prefs row');
select is((select quiet_hours::text || ' ' || quiet_start::text || ' ' || quiet_end::text
           from public.notification_prefs where user_id = tests.id('owner')),
          'true 22:00:00 07:00:00', 'quiet hours are on, 10 PM to 7 AM, by default');
select tests.act_as('owner');
update public.notification_prefs set "like" = false, quiet_start = '23:00' where user_id = auth.uid();
select is((select "like"::text || ' ' || quiet_start::text from public.notification_prefs where user_id = auth.uid()),
          'false 23:00:00', 'the owner turns likes off and moves quiet hours');
select tests.act_as('reader');
select is((select count(*) from public.notification_prefs where user_id = tests.id('owner')), 0::bigint,
          'nobody else can read them');
update public.notification_prefs set "like" = true where user_id = tests.id('owner');
select tests.reset_role();
select is((select "like" from public.notification_prefs where user_id = tests.id('owner')), false,
          'nor change them');

select * from finish();
rollback;
