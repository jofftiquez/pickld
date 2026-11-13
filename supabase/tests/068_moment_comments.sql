-- 0068 (QA round 1 item 2; D-51; FR-SOC-04, FR-SOC-06): each moment has its own comment thread. Who reads
-- and writes a moment thread follows the moment's own visibility (Readers, Everyone, Only me), in a
-- published jar or not, tried as owner, reader, outsider, blocked user and blocker; the jar thread still
-- waits for Publish jar. A moment comment stays in its moment's jar and a reply in its parent's thread;
-- the moment's count covers its thread and the jar's count only the jar thread; delete_comment, notifications
-- (carrying the moment), reports and deleting a moment.
begin;
\ir _helpers.psql
select plan(91);

select tests.world();
create temp table t (k text primary key, id uuid not null default gen_random_uuid());
grant select on t to authenticated, anon, service_role, pickld_moderation;

-- ---------------------------------------------------------------- schema
select col_is_null('public', 'comments', 'moment_id', 'comments.moment_id is nullable (null is the jar thread)');
select fk_ok('public', 'comments', 'moment_id', 'public', 'moments', 'id', 'comments.moment_id references moments');
select col_not_null('public', 'moments', 'comment_count', 'moments.comment_count is not null');
select col_default_is('public', 'moments', 'comment_count', '0', 'moments.comment_count defaults to 0');
select ok(has_column_privilege('authenticated', 'public.moments', 'comment_count', 'select'),
          'signed-in users may read moments.comment_count');

-- ---------------------------------------------------------------- the cast
-- Two Readers jars, published and not, each with a moment per visibility, and a checked comment by someone
-- with no relationship to anyone (the moderator account), so only the moment decides who reads it.
insert into t values ('jar_pub', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('jar_unpub', tests.make_jar('owner', 'readers', published => false, p_days_ago => 2));
create temp table mm (name text primary key, id uuid not null, sees text[] not null, cid uuid not null default gen_random_uuid());
grant select on mm to authenticated, anon, service_role, pickld_moderation;
insert into mm (name, id, sees) values
  ('published readers',    tests.make_moment((select id from t where k = 'jar_pub'), 'morning', 'live', p_visibility => 'readers'),     '{owner,reader}'),
  ('published everyone',   tests.make_moment((select id from t where k = 'jar_pub'), 'afternoon', 'live', p_visibility => 'everyone'),  '{owner,reader,outsider}'),
  ('published only_me',    tests.make_moment((select id from t where k = 'jar_pub'), 'evening', 'live', p_visibility => 'only_me'),     '{owner}'),
  ('unpublished readers',  tests.make_moment((select id from t where k = 'jar_unpub'), 'morning', 'live', p_visibility => 'readers'),   '{owner,reader}'),
  ('unpublished everyone', tests.make_moment((select id from t where k = 'jar_unpub'), 'afternoon', 'live', p_visibility => 'everyone'), '{owner,reader,outsider}'),
  ('unpublished only_me',  tests.make_moment((select id from t where k = 'jar_unpub'), 'evening', 'live', p_visibility => 'only_me'),   '{owner}');
insert into public.comments (id, jar_id, user_id, moment_id, body)
select x.cid, m.jar_id, tests.id('moderator'), x.id, 'lovely ' || x.name
from mm x join public.moments m on m.id = x.id;
-- A checked comment in the published jar's own thread.
insert into public.comments (jar_id, user_id, body)
values ((select id from t where k = 'jar_pub'), tests.id('reader'), 'jar thread');
insert into t values ('jc', (select id from public.comments where body = 'jar thread'));
select tests.act_as_service();
select public.moderation_apply_comment(c, 'approve', 'test') from (select cid as c from mm union all select id from t where k = 'jc') s;
select tests.reset_role();

create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5);

-- 'ok' when `who` may comment on the moment, else the error code. The comment is rolled back either way.
create function pg_temp.try_comment(who text, mid uuid) returns text language plpgsql as $$
declare
  jid uuid := (select jar_id from public.moments where id = mid);
  result text;
begin
  begin
    perform tests.act_as(who);
    insert into public.comments (jar_id, user_id, moment_id, body) values (jid, tests.id(who), mid, 'hi');
    result := 'ok';
    raise exception 'undo' using errcode = 'PT001';
  exception when others then
    result := coalesce(result, sqlstate);
  end;
  perform tests.reset_role();
  return result;
end $$;

create function pg_temp.sees(who text, cid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.comments where id = cid) into r;
  perform tests.reset_role();
  return r;
end $$;

-- ---------------------------------------------------------------- who reads and writes a moment thread
-- 6 moments × 5 roles, reading
select is(pg_temp.sees(r.role, x.cid), r.role = any (x.sees),
          format('%s: %s %s its thread', x.name, r.role, case when r.role = any (x.sees) then 'reads' else 'does not read' end))
from mm x cross join roles r order by x.name, r.ord;
-- 6 moments × 5 roles, writing
select is(pg_temp.try_comment(r.role, x.id), case when r.role = any (x.sees) then 'ok' else '42501' end,
          format('%s: %s %s', x.name, r.role, case when r.role = any (x.sees) then 'may comment' else 'may not comment' end))
from mm x cross join roles r order by x.name, r.ord;

-- the jar thread still waits for Publish jar
select tests.act_as('reader');
select throws_ok(format('insert into public.comments (jar_id, user_id, body) values (%L, auth.uid(), ''hi'')',
                        (select id from t where k = 'jar_unpub')),
                 '42501', null, 'a reader may comment on a moment of an unpublished jar but not on the jar itself');
select is((select count(*) from public.comments where jar_id = (select id from t where k = 'jar_pub') and moment_id is null),
          1::bigint, 'the jar thread holds only the jar''s own comments');
select tests.reset_role();

-- ---------------------------------------------------------------- the thread a comment is in
insert into t (k) values ('reply');
select tests.act_as('owner');
select throws_ok(format('insert into public.comments (jar_id, user_id, moment_id, body) values (%L, auth.uid(), %L, ''hi'')',
                        (select id from t where k = 'jar_pub'), (select id from mm where name = 'unpublished readers')),
                 '23514', null, 'a moment comment must be in the moment''s jar');
select throws_ok(format('insert into public.comments (jar_id, user_id, moment_id, parent_id, body) values (%L, auth.uid(), %L, %L, ''hi'')',
                        (select id from t where k = 'jar_pub'), (select id from mm where name = 'published readers'),
                        (select id from t where k = 'jc')),
                 '23514', null, 'a reply in a moment thread cannot answer a jar-thread comment');
select throws_ok(format('insert into public.comments (jar_id, user_id, parent_id, body) values (%L, auth.uid(), %L, ''hi'')',
                        (select id from t where k = 'jar_pub'), (select cid from mm where name = 'published readers')),
                 '23514', null, 'a jar-thread reply cannot answer a moment comment');
select lives_ok(format('insert into public.comments (id, jar_id, user_id, moment_id, parent_id, body) values (%L, %L, auth.uid(), %L, %L, ''thanks'')',
                       (select id from t where k = 'reply'), (select id from t where k = 'jar_pub'),
                       (select id from mm where name = 'published readers'), (select cid from mm where name = 'published readers')),
                'the owner replies in the moment''s thread');
select tests.reset_role();

-- ---------------------------------------------------------------- counts
create function pg_temp.mcount(p_name text) returns int language sql as $$
  select comment_count from public.moments where id = (select id from mm where name = p_name)
$$;
create function pg_temp.jcount(p_k text) returns int language sql as $$
  select comment_count from public.jars where id = (select id from t where k = p_k)
$$;
select is(pg_temp.mcount('published readers'), 1, 'the moment counts its checked comment, not the reply still being checked');
select is(pg_temp.jcount('jar_pub'), 1, 'the jar counts only its own thread (three checked moment comments aside)');
select is(pg_temp.jcount('jar_unpub'), 0, 'a jar with only moment comments counts none');
select tests.act_as_service();
select public.moderation_apply_comment((select id from t where k = 'reply'), 'approve', 'test');
select tests.reset_role();
select is(pg_temp.mcount('published readers'), 2, 'the checked reply counts on the moment');
select is(pg_temp.jcount('jar_pub'), 1, 'and not on the jar');
select tests.act_as('owner');
select throws_ok(format('update public.moments set comment_count = 9 where id = %L', (select id from mm where name = 'published readers')),
                 '42501', null, 'the owner cannot write the moment''s comment count');
select tests.reset_role();

-- ---------------------------------------------------------------- delete_comment (0005)
select tests.act_as('outsider');
select throws_ok(format('select public.delete_comment(%L)', (select cid from mm where name = 'published everyone')),
                 'P0002', null, 'an outsider cannot delete someone else''s moment comment');
select tests.act_as('owner');
select lives_ok(format('select public.delete_comment(%L)', (select id from t where k = 'reply')),
                'the author deletes their reply in a moment thread');
select is(pg_temp.mcount('published readers'), 1, 'a deleted comment leaves the moment''s count');
select lives_ok(format('select public.delete_comment(%L)', (select cid from mm where name = 'published everyone')),
                'the jar owner deletes someone else''s comment on their moment');
select is(pg_temp.mcount('published everyone'), 0, 'and the count follows');
select tests.reset_role();

-- ---------------------------------------------------------------- notifications (0019)
select is((select count(*) from public.notifications
           where user_id = tests.id('owner') and type = 'comment' and comment_id = (select cid from mm where name = 'published readers')
             and moment_id = (select id from mm where name = 'published readers')
             and jar_id = (select id from t where k = 'jar_pub')),
          1::bigint, 'a checked moment comment notifies the owner and carries the moment and its jar');
select is((select count(*) from public.notifications
           where user_id = tests.id('moderator') and type = 'reply' and comment_id = (select id from t where k = 'reply')
             and moment_id = (select id from mm where name = 'published readers')),
          1::bigint, 'a reply in a moment thread notifies the parent''s author and carries the moment');
select is((select count(*) from public.notifications where comment_id = (select cid from mm where name = 'published only_me')),
          0::bigint, 'a comment on an Only me moment notifies nobody (rule 9)');
select is((select count(*) from public.notifications where comment_id = (select id from t where k = 'jc') and moment_id is null),
          1::bigint, 'a jar-thread comment still notifies without a moment');

-- ---------------------------------------------------------------- reports (0021)
select tests.act_as('reader');
select lives_ok(format('select public.submit_report(''comment'', %L, ''spam'', ''a note'')', (select cid from mm where name = 'unpublished readers')),
                'a reader reports a comment on a moment of an unpublished jar');
select tests.act_as('outsider');
select throws_ok(format('select public.submit_report(''comment'', %L, ''spam'', ''a note'')', (select cid from mm where name = 'unpublished readers')),
                 '42501', 'you can only report something you can see', 'an outsider cannot report a comment on a Readers moment');
select lives_ok(format('select public.submit_report(''comment'', %L, ''spam'', ''a note'')', (select cid from mm where name = 'unpublished everyone')),
                'an outsider reports a comment on an Everyone moment');
select tests.reset_role();

-- ---------------------------------------------------------------- deleting a moment
select tests.act_as('owner');
delete from public.moments where id = (select id from mm where name = 'unpublished everyone');
select tests.reset_role();
select is((select count(*) from public.comments where id = (select cid from mm where name = 'unpublished everyone')),
          0::bigint, 'deleting a moment deletes its thread');
select is((select count(*) from public.comments where id = (select id from t where k = 'jc')), 1::bigint,
          'the jar thread stays');

select * from finish();
rollback;
