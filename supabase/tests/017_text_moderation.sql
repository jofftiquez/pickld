-- M3-10 (0016): comments become visible only through moderation_apply_comment (pickld_moderation), and
-- reserved usernames are refused at save in any letter case (FR-SOC-06, FR-ACC-03; D-22, C-2).
begin;
\ir _helpers.psql
select plan(29);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));

-- A reader's comment, inserted the way the app does it: hidden by the client trigger.
select tests.act_as('reader');
insert into public.comments (id, jar_id, user_id, body)
values ('c2000000-0000-4000-8000-000000000001', (select id from t where k = 'jar'), auth.uid(), 'Love the light');
insert into public.comments (id, jar_id, user_id, body)
values ('c2000000-0000-4000-8000-000000000002', (select id from t where k = 'jar'), auth.uid(), 'Second one');
insert into public.comments (id, jar_id, user_id, body)
values ('c2000000-0000-4000-8000-000000000003', (select id from t where k = 'jar'), auth.uid(), 'Third one');
select tests.reset_role();

create function pg_temp.visible_to(who text, cid uuid) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform tests.act_as(who);
  select count(*) into n from public.comments where id = cid;
  perform tests.reset_role();
  return n;
end $$;
create function pg_temp.comment_count() returns int language sql as $$
  select comment_count from public.jars where id = (select id from t where k = 'jar')
$$;

-- ---------------------------------------------------------------- the function itself
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'moderation_apply_comment'),
          'pickld_moderation/true', 'moderation_apply_comment is security definer, owned by pickld_moderation');

-- ---------------------------------------------------------------- pending: author only
select is(pg_temp.visible_to('reader', 'c2000000-0000-4000-8000-000000000001'), 1::bigint, 'the author sees their pending comment');
select is(pg_temp.visible_to('owner', 'c2000000-0000-4000-8000-000000000001'), 0::bigint, 'the jar owner does not see it yet');
select is(pg_temp.comment_count(), 0, 'a pending comment is not counted');

-- ---------------------------------------------------------------- nobody else unhides (rule 4)
select tests.act_as('reader');
select throws_ok($$select public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'me')$$,
                 '42501', null, 'the author cannot call moderation_apply_comment');
select tests.act_as('owner');
select throws_ok($$select public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'me')$$,
                 '42501', null, 'the jar owner cannot call moderation_apply_comment');
select tests.act_as('outsider');
select throws_ok($$select public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'me')$$,
                 '42501', null, 'an outsider cannot call moderation_apply_comment');
select tests.act_as('blocked');
select throws_ok($$select public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'me')$$,
                 '42501', null, 'a blocked user cannot call moderation_apply_comment');
select tests.act_as_service();
select throws_ok($$update public.comments set is_hidden = false where id = 'c2000000-0000-4000-8000-000000000001'$$,
                 '42501', 'comment visibility can only be set by moderation', 'service_role cannot unhide a comment directly');
select tests.reset_role();
select throws_ok($$update public.comments set is_hidden = false where id = 'c2000000-0000-4000-8000-000000000001'$$,
                 '42501', 'comment visibility can only be set by moderation', 'not even the superuser outside moderation');

-- ---------------------------------------------------------------- approve: visible at once
select tests.act_as_service();
select throws_ok($$select public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'publish', 'test')$$,
                 '22023', null, 'an unknown decision is refused');
select is(public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'test'), 'visible',
          'approve makes the comment visible');
select is(public.moderation_apply_comment('c2000000-0000-4000-8000-000000000001', 'approve', 'test'), 'nothing_to_check',
          'approving again changes nothing');
select is(public.moderation_apply_comment('c2000000-0000-4000-9000-000000000099', 'approve', 'test'), 'not_found',
          'an unknown comment is not_found');
select tests.reset_role();
select is(pg_temp.visible_to('owner', 'c2000000-0000-4000-8000-000000000001'), 1::bigint, 'the jar owner sees it once approved');
select is(pg_temp.visible_to('reader', 'c2000000-0000-4000-8000-000000000001'), 1::bigint, 'the author still sees it');
select is(pg_temp.visible_to('outsider', 'c2000000-0000-4000-8000-000000000001'), 0::bigint, 'an outsider still cannot see a Readers jar''s comment');
select is(pg_temp.visible_to('blocked', 'c2000000-0000-4000-8000-000000000001'), 0::bigint, 'a blocked user still cannot see it');
select is(pg_temp.comment_count(), 1, 'comment_count rises when the comment is approved');

-- ---------------------------------------------------------------- review and remove stay hidden
select tests.act_as_service();
select is(public.moderation_apply_comment('c2000000-0000-4000-8000-000000000002', 'review', 'test', '{"harassment":0.6}', 'borderline'),
          'queued', 'review queues the comment');
select is(public.moderation_apply_comment('c2000000-0000-4000-8000-000000000002', 'approve', 'test'), 'queued',
          'an approve while a human decides is ignored');
select is(public.moderation_apply_comment('c2000000-0000-4000-8000-000000000003', 'remove', 'test', '{"harassment":0.99}', 'harassment'),
          'removed', 'remove refuses the comment');
select tests.reset_role();
select is(pg_temp.visible_to('owner', 'c2000000-0000-4000-8000-000000000002'), 0::bigint, 'a queued comment stays hidden from others');
select is(pg_temp.visible_to('owner', 'c2000000-0000-4000-8000-000000000003'), 0::bigint, 'a removed comment stays hidden from others');
select is((select array_agg(status::text order by status::text) from public.moderation_items
           where comment_id in ('c2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000003')),
          array['pending', 'removed'], 'the queue holds one pending and one decided item');

-- ---------------------------------------------------------------- reserved usernames
select tests.act_as('outsider');
select throws_ok($$update public.profiles set username = 'settings' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'a route word is refused at save');
select throws_ok($$update public.profiles set username = 'PickLD' where id = auth.uid()$$,
                 '23514', 'username_reserved', 'reserved names are refused in any letter case');
select lives_ok($$update public.profiles set username = 'settings_fan' where id = auth.uid()$$,
                'a name that only contains a reserved word is fine');
select tests.reset_role();
select throws_ok($$insert into public.profiles (id, username, display_name, birthday, home_tz)
                   values (tests.id('outsider'), 'admin', 'X', date '1995-05-05', 'Asia/Manila')$$,
                 '23514', 'username_reserved', 'a new profile cannot take a reserved name');

select * from finish();
rollback;
