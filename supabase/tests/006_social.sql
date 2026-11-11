-- M1-10 (0005): comments (S-3, S-8), reactions on visible targets (S-7), active users only (S-10),
-- like and comment counters (S-6), appeals for your own removed content (S-7).
begin;
\ir _helpers.psql
select plan(52);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values
  ('everyone',    tests.make_jar('owner', 'everyone', published => true)),
  ('readers',     tests.make_jar('owner', 'readers',  published => true, p_days_ago => 1)),
  ('unpublished', tests.make_jar('owner', 'everyone', published => false, p_days_ago => 2)),
  ('only_me',     tests.make_jar('owner', 'only_me',  published => true, p_days_ago => 3)),
  ('outsider_jar', tests.make_jar('outsider', 'everyone', published => true));
insert into t values
  ('m_live',     tests.make_moment((select id from t where k = 'readers'), 'morning', 'live')),
  ('m_private',  tests.make_moment((select id from t where k = 'readers'), 'evening', 'live', p_private => true)),
  ('m_checking', tests.make_moment((select id from t where k = 'readers'), 'afternoon', 'checking')),
  ('m_removed',  tests.make_moment((select id from t where k = 'readers'), 'ootd', 'removed'));

create function pg_temp.jar_counts(p text) returns int[] language sql as $$
  select array[like_count, comment_count] from public.jars where id = (select id from t where k = p)
$$;

-- ---------------------------------------------------------------- comments
select tests.act_as('reader');
select lives_ok($$insert into public.comments (id, jar_id, user_id, body, is_hidden)
                  values ('c1000000-0000-4000-8000-000000000001', (select id from t where k = 'readers'), auth.uid(), 'nice day', false)$$,
                'a reader can comment on a Readers jar');
select tests.reset_role();
select is((select is_hidden from public.comments where id = 'c1000000-0000-4000-8000-000000000001'), true,
          'a new comment starts hidden even if the client says otherwise');
select is(pg_temp.jar_counts('readers'), array[0, 0], 'a hidden comment is not counted');

select tests.act_as('reader');
select throws_ok($$update public.comments set is_hidden = false where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null,
                 'the author cannot unhide their comment');
select throws_ok($$update public.comments set body = 'edited' where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null,
                 'the author cannot edit their comment');
select tests.act_as('owner');
select throws_ok($$update public.comments set body = 'rewritten by owner' where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null,
                 'the jar owner cannot rewrite someone else''s comment');
select throws_ok($$delete from public.comments where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null,
                 'nobody hard-deletes comments directly');

-- moderation (fn:moderate as service_role, through moderation_apply_comment, 0016) unhides it
select tests.act_as_service();
select public.moderation_apply_comment('c1000000-0000-4000-8000-000000000001', 'approve', 'test');
select is(pg_temp.jar_counts('readers'), array[0, 1], 'comment_count rises when the comment passes the check');
select tests.act_as('outsider');
select is((select count(*) from public.comments where id = 'c1000000-0000-4000-8000-000000000001'), 0::bigint,
          'an outsider cannot see comments on a Readers jar');

-- replies
select tests.act_as('owner');
select lives_ok($$insert into public.comments (id, jar_id, user_id, parent_id, body)
                  values ('c1000000-0000-4000-8000-000000000002', (select id from t where k = 'readers'), auth.uid(),
                          'c1000000-0000-4000-8000-000000000001', 'thanks!')$$,
                'the owner can reply to a top-level comment');
select throws_ok($$insert into public.comments (jar_id, user_id, parent_id, body)
                   values ((select id from t where k = 'readers'), auth.uid(), 'c1000000-0000-4000-8000-000000000002', 'deeper')$$,
                 '23514', 'replies can only be one level deep', 'a reply to a reply is refused');
select throws_ok($$insert into public.comments (jar_id, user_id, parent_id, body)
                   values ((select id from t where k = 'everyone'), auth.uid(), 'c1000000-0000-4000-8000-000000000001', 'elsewhere')$$,
                 '23514', 'a reply must be in the same jar as its parent', 'a reply with a parent in another jar is refused');

-- who can comment
select tests.act_as('outsider');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'readers'), auth.uid(), 'hi')$$,
                 '42501', null, 'an outsider cannot comment on a Readers jar');
select lives_ok($$insert into public.comments (id, jar_id, user_id, body)
                  values ('c1000000-0000-4000-8000-000000000003', (select id from t where k = 'everyone'), auth.uid(), 'hello')$$,
                'control: an outsider can comment on an Everyone jar');
select tests.act_as('blocked');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'everyone'), auth.uid(), 'hi')$$,
                 '42501', null, 'a blocked user cannot comment on the blocker''s jar');
select tests.act_as('blocker');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'everyone'), auth.uid(), 'hi')$$,
                 '42501', null, 'a user who blocked the owner cannot comment either');
select tests.act_as('reader');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'unpublished'), auth.uid(), 'hi')$$,
                 '42501', null, 'nobody can comment on an unpublished jar');

-- delete_comment()
select tests.act_as('outsider');
select throws_ok($$select public.delete_comment('c1000000-0000-4000-8000-000000000001')$$, 'P0002', null,
                 'an unrelated user cannot delete a comment');
select tests.act_as('reader');
select throws_ok($$select public.delete_comment('c1000000-0000-4000-8000-000000000003')$$, 'P0002', null,
                 'a reader cannot delete another user''s comment on someone else''s jar');
select tests.act_as('owner');
select lives_ok($$select public.delete_comment('c1000000-0000-4000-8000-000000000001')$$, 'the jar owner can delete a reader''s comment');
select is((select count(*) from public.comments where id = 'c1000000-0000-4000-8000-000000000001'), 0::bigint, 'a deleted comment disappears');
select is(pg_temp.jar_counts('readers'), array[0, 0], 'comment_count drops when a comment is deleted');
select tests.act_as('outsider');
select lives_ok($$select public.delete_comment('c1000000-0000-4000-8000-000000000003')$$, 'the author can delete their own comment');
select tests.reset_role();
select ok((select deleted_at is not null from public.comments where id = 'c1000000-0000-4000-8000-000000000003'), 'delete is a soft delete');
select tests.act_as_anon();
select throws_ok($$select public.delete_comment('c1000000-0000-4000-8000-000000000002')$$, '42501', null, 'anon cannot call delete_comment');

-- ---------------------------------------------------------------- reactions
select tests.act_as('reader');
select lives_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'readers'))$$,
                'a reader can like a Readers jar');
select is(pg_temp.jar_counts('readers'), array[1, 0], 'like_count rises on like');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'readers'))$$,
                 '23505', null, 'one like per user per jar');
delete from public.reactions where user_id = auth.uid() and target = 'jar' and target_id = (select id from t where k = 'readers');
select is(pg_temp.jar_counts('readers'), array[0, 0], 'like_count drops on unlike');

select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'unpublished'))$$,
                 '42501', null, 'liking an unpublished jar is refused');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'only_me'))$$,
                 '42501', null, 'liking an Only me jar is refused');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_private'))$$,
                 '42501', null, 'liking a private moment is refused');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_checking'))$$,
                 '42501', null, 'liking a checking moment is refused');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_removed'))$$,
                 '42501', null, 'liking a removed moment is refused');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', gen_random_uuid())$$,
                 '42501', null, 'liking a jar that doesn''t exist is refused');
select lives_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_live'))$$,
                'a reader can like a live moment');
select tests.reset_role();
select is((select like_count from public.moments where id = (select id from t where k = 'm_live')), 1, 'moment like_count rises');

select tests.act_as('outsider');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'readers'))$$,
                 '42501', null, 'an outsider cannot like a Readers jar');
select is((select count(*) from public.reactions where target = 'moment' and target_id = (select id from t where k = 'm_live')), 0::bigint,
          'an outsider cannot see likes on a moment they can''t view');
select lives_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'everyone'))$$,
                'control: an outsider can like an Everyone jar');
select tests.act_as('blocked');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'everyone'))$$,
                 '42501', null, 'a blocked user cannot like the blocker''s jar');
select tests.act_as('blocker');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'jar', (select id from t where k = 'everyone'))$$,
                 '42501', null, 'a user who blocked the owner cannot like their jar');

-- ---------------------------------------------------------------- suspended users can't write (D-11)
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('outsider');
select tests.act_as('outsider');
select throws_ok($$insert into public.jars (user_id, local_date, tz) values (auth.uid(), current_date - 9, 'Asia/Manila')$$, '42501', null,
                 'a suspended user cannot create a jar');
select throws_ok($$insert into public.moments (jar_id, user_id, slot, status) values ((select id from t where k = 'outsider_jar'), auth.uid(), 'selfie', 'checking')$$,
                 '42501', null, 'a suspended user cannot add a moment');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'everyone'), auth.uid(), 'hi')$$,
                 '42501', null, 'a suspended user cannot comment');
select throws_ok($$insert into public.reactions (user_id, target, target_id) values (auth.uid(), 'moment', (select id from t where k = 'm_live'))$$,
                 '42501', null, 'a suspended user cannot like');
select throws_ok(format('insert into public.follows (reader_id, author_id) values (auth.uid(), %L)', tests.id('owner')),
                 '42501', null, 'a suspended user cannot follow');
select tests.act_as('reader');
select throws_ok(format('insert into public.follows (reader_id, author_id) values (auth.uid(), %L)', tests.id('outsider')),
                 '42501', null, 'nobody can follow a suspended user');
select tests.reset_role();
update public.profiles set status = 'deleted' where id = tests.id('reader');
select tests.act_as('reader');
select throws_ok($$insert into public.comments (jar_id, user_id, body) values ((select id from t where k = 'readers'), auth.uid(), 'hi')$$,
                 '42501', null, 'a deleted user cannot comment');

-- ---------------------------------------------------------------- appeals
select tests.reset_role();
insert into public.moderation_items (id, moment_id, source, status) values
  ('d1000000-0000-4000-8000-000000000001', (select id from t where k = 'm_removed'), 'auto_check', 'removed'),
  ('d1000000-0000-4000-8000-000000000002', (select id from t where k = 'm_checking'), 'auto_check', 'pending');
select tests.act_as('blocker');
select throws_ok($$insert into public.appeals (moderation_item_id, user_id, message) values ('d1000000-0000-4000-8000-000000000001', auth.uid(), 'mine?')$$,
                 '42501', null, 'a user cannot appeal someone else''s removal');
select tests.act_as('owner');
select throws_ok($$insert into public.appeals (moderation_item_id, user_id, message) values ('d1000000-0000-4000-8000-000000000002', auth.uid(), 'early')$$,
                 '42501', null, 'an item that wasn''t removed cannot be appealed');
select lives_ok($$insert into public.appeals (moderation_item_id, user_id, message) values ('d1000000-0000-4000-8000-000000000001', auth.uid(), 'it was fine')$$,
                'the owner can appeal their removed moment');

select * from finish();
rollback;
