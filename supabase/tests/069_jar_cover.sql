-- 0069 (QA round 1 item 11; D-56, D-75; FR-SOC-03, FR-SOC-01, FR-WEB-01): a jar's cover photo. Only the
-- jar's owner may set or clear jars.cover_moment_id, only to a moment of the same jar (a live one that isn't
-- a pending replacement, from a client). The resolved cover, tried as owner, reader, outsider, blocked user
-- and blocker: the pick when the viewer may see it, else the newest caption, else the first slot, over the
-- moments they see; the fallback when the pick is Readers (for outsiders), Only me, removed or deleted; a
-- Replace keeps the cover. The jar page path (resolved_cover_id), feed_page (cover first in the previews)
-- and public_jar (Everyone moments only).
begin;
\ir _helpers.psql
select plan(66);

select tests.world();
create temp table t (k text primary key, id uuid not null default gen_random_uuid());
grant select on t to authenticated, anon, service_role, pickld_moderation;

-- The cover each viewer gets on the Jar page (a computed column of the jar row, read as them); null when
-- they can't open the jar.
create function tests.cover_for(who text, p_jar uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform tests.act_as(who);
  select public.resolved_cover_id(j) into c from public.jars j where j.id = p_jar;
  perform tests.reset_role();
  return c;
end $$;
-- feed_page's cover and first preview for a viewer, as 'cover/first'; null when the jar isn't in their feed.
create function tests.feed_for(who text, p_jar uuid) returns text language plpgsql as $$
declare c text;
begin
  perform tests.act_as(who);
  select f.cover_moment_id::text || '/' || f.preview_moment_ids[1]::text into c
  from public.feed_page() f where f.jar_id = p_jar;
  perform tests.reset_role();
  return c;
end $$;
-- public_jar's cover, as anon; 'none' when the jar has no cover key (a Readers teaser).
create function tests.public_cover(p_jar uuid) returns text language plpgsql as $$
declare v jsonb;
begin
  perform tests.act_as_anon();
  v := public.public_jar(p_jar);
  perform tests.reset_role();
  return case when v ? 'cover_moment_id' then v ->> 'cover_moment_id' else 'none' end;
end $$;
-- The raw pick, as the superuser.
create function tests.pick(p_jar uuid) returns uuid language sql stable as $$
  select cover_moment_id from public.jars where id = p_jar
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

create function pg_temp.id(p_k text) returns uuid language sql stable as $$ select id from t where k = p_k $$;

-- ---------------------------------------------------------------- schema
select col_is_null('public', 'jars', 'cover_moment_id', 'jars.cover_moment_id is nullable (null is the derived rule)');
select col_hasnt_default('public', 'jars', 'cover_moment_id', 'jars.cover_moment_id has no default: every jar starts with none');
select fk_ok('public', 'jars', 'cover_moment_id', 'public', 'moments', 'id', 'jars.cover_moment_id references moments');
select ok(has_function_privilege('authenticated', 'public.resolved_cover_id(public.jars)', 'execute'),
          'signed-in users may call resolved_cover_id');
select ok(not has_function_privilege('anon', 'public.resolved_cover_id(public.jars)', 'execute'),
          'anon cannot call resolved_cover_id');
select ok(not has_function_privilege('anon', 'public.feed_page(timestamptz, uuid)', 'execute'),
          'feed_page keeps anon out after being re-created');
select ok(has_function_privilege('authenticated', 'public.feed_page(timestamptz, uuid)', 'execute'),
          'and signed-in users in');

-- ---------------------------------------------------------------- the cast
-- An Everyone jar, published, with moments of each visibility; a captioned Everyone one is the derived cover.
insert into t values ('jar', tests.make_jar('owner', 'everyone', published => true));
insert into t values ('jar2', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('ev1', tests.make_moment(pg_temp.id('jar'), 'whereami', 'live', p_visibility => 'everyone'));
insert into t values ('ev2', tests.make_moment(pg_temp.id('jar'), 'ootd', 'live', p_visibility => 'everyone'));
insert into t values ('rd', tests.make_moment(pg_temp.id('jar'), 'morning', 'live', p_visibility => 'readers'));
insert into t values ('om', tests.make_moment(pg_temp.id('jar'), 'evening', 'live', p_visibility => 'only_me'));
insert into t values ('chk', tests.make_moment(pg_temp.id('jar'), 'afternoon', 'checking', p_visibility => 'everyone'));
insert into t values ('other_jar', tests.make_moment(pg_temp.id('jar2'), 'whereami', 'live'));
insert into t values ('rjar', tests.make_jar('reader', 'everyone', published => true));
insert into t values ('readers_m', tests.make_moment(pg_temp.id('rjar'), 'whereami', 'live', p_visibility => 'everyone'));
update public.moments set caption = 'the newest caption' where id = pg_temp.id('ev2');
update public.moments set caption = 'a private caption' where id = pg_temp.id('om');
-- om's caption is newer, but only the owner sees it.
alter table public.moments disable trigger moments_bu;
update public.moments set added_at = now() - interval '1 hour' where id = pg_temp.id('ev2');
alter table public.moments enable trigger moments_bu;

select is(tests.pick(pg_temp.id('jar')), null, 'a jar starts with no pick');

-- ---------------------------------------------------------------- derived cover (no pick)
select is(tests.cover_for('owner', pg_temp.id('jar')), pg_temp.id('om'), 'owner: the newest caption, their Only me one included');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'reader: the newest caption they can see');
select is(tests.cover_for('outsider', pg_temp.id('jar')), pg_temp.id('ev2'), 'outsider: the same Everyone moment');
select is(tests.cover_for('blocked', pg_temp.id('jar')), null, 'blocked user: no jar, no cover');
select is(tests.cover_for('blocker', pg_temp.id('jar')), null, 'blocker: no jar, no cover');
select is(tests.feed_for('reader', pg_temp.id('jar')), pg_temp.id('ev2') || '/' || pg_temp.id('ev2'),
          'feed_page gives the reader the derived cover, first in the previews');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev2')::text, 'public_jar: the derived cover among Everyone moments');
update public.moments set caption = null where id in (pg_temp.id('ev2'), pg_temp.id('om'));
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev1'), 'no caption: the first slot');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev1')::text, 'public_jar: the first slot too');
update public.moments set caption = 'the newest caption' where id = pg_temp.id('ev2');

-- ---------------------------------------------------------------- only the owner sets it
select tests.act_as('reader');
update public.jars set cover_moment_id = pg_temp.id('rd') where id = pg_temp.id('jar');
select tests.act_as('outsider');
update public.jars set cover_moment_id = pg_temp.id('rd') where id = pg_temp.id('jar');
select tests.act_as('blocked');
update public.jars set cover_moment_id = pg_temp.id('rd') where id = pg_temp.id('jar');
select tests.act_as('blocker');
update public.jars set cover_moment_id = pg_temp.id('rd') where id = pg_temp.id('jar');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), null, 'reader, outsider, blocked user and blocker cannot set the cover (RLS: no row)');
select tests.act_as('reader');
select throws_ok(format('select public.set_jar_cover(%L, %L)', pg_temp.id('jar'), pg_temp.id('rd')),
                 '42883', null, 'there is no RPC to go around the owner check');

select tests.act_as('owner');
select throws_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('other_jar'), pg_temp.id('jar')),
                 '23514', null, 'owner: a moment of another of their jars is refused');
select throws_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('readers_m'), pg_temp.id('jar')),
                 '23514', null, 'owner: someone else''s moment is refused');
select throws_ok(format('update public.jars set cover_moment_id = %L where id = %L', gen_random_uuid(), pg_temp.id('jar')),
                 '23514', null, 'owner: a moment that doesn''t exist is refused');
select throws_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('chk'), pg_temp.id('jar')),
                 '42501', null, 'owner: a moment still being checked is refused');
select throws_ok(format('update public.jars set cover_moment_id = %L, moment_count = 8 where id = %L', pg_temp.id('rd'), pg_temp.id('jar')),
                 '42501', 'only visibility and published_at can be changed', 'owner: the cover doesn''t open the other columns');
select throws_ok(format('insert into public.jars (user_id, local_date, tz, cover_moment_id) values (%L, (now() at time zone ''Asia/Manila'')::date - 9, ''Asia/Manila'', %L)',
                        tests.id('owner'), pg_temp.id('rd')),
                 '23514', null, 'a new jar cannot start with another jar''s moment as its cover');
select lives_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('rd'), pg_temp.id('jar')),
                'owner: a live moment of the jar is fine');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), pg_temp.id('rd'), 'and is stored');

-- ---------------------------------------------------------------- a Readers pick
select is(tests.cover_for('owner', pg_temp.id('jar')), pg_temp.id('rd'), 'owner sees their pick');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('rd'), 'reader sees the Readers pick');
select is(tests.cover_for('outsider', pg_temp.id('jar')), pg_temp.id('ev2'), 'outsider can''t see it: the derived cover');
select is(tests.cover_for('blocked', pg_temp.id('jar')), null, 'blocked user still gets nothing');
select is(tests.cover_for('blocker', pg_temp.id('jar')), null, 'blocker still gets nothing');
select is(tests.feed_for('reader', pg_temp.id('jar')), pg_temp.id('rd') || '/' || pg_temp.id('rd'),
          'feed_page: the reader''s cover is the pick, first in the previews');
select is(tests.feed_for('owner', pg_temp.id('jar')), pg_temp.id('rd') || '/' || pg_temp.id('rd'), 'and the owner''s');
select is(tests.feed_for('outsider', pg_temp.id('jar')), null, 'not in the outsider''s feed (they don''t read the owner)');
select is(tests.feed_for('blocked', pg_temp.id('jar')), null, 'nor the blocked user''s');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev2')::text, 'public_jar: a Readers pick falls back to an Everyone moment');
select tests.act_as('reader');
select is((select count(*) from public.feed_page() f, unnest(f.preview_moment_ids) p
           where f.jar_id = pg_temp.id('jar') and p = pg_temp.id('om')), 0::bigint,
          'the reader''s previews still leave out the Only me moment');
select tests.reset_role();

-- ---------------------------------------------------------------- an Everyone pick
select tests.act_as('owner');
update public.jars set cover_moment_id = pg_temp.id('ev1') where id = pg_temp.id('jar');
select tests.reset_role();
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev1'), 'Everyone pick: the reader sees it');
select is(tests.cover_for('outsider', pg_temp.id('jar')), pg_temp.id('ev1'), 'and the outsider');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev1')::text, 'and the web page');

-- ---------------------------------------------------------------- the pick made Only me
select tests.act_as('owner');
update public.moments set visibility = 'only_me' where id = pg_temp.id('ev1');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), pg_temp.id('ev1'), 'making the pick Only me keeps it');
select is(tests.cover_for('owner', pg_temp.id('jar')), pg_temp.id('ev1'), 'owner still sees their pick');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'reader falls back to the derived cover');
select is(tests.cover_for('outsider', pg_temp.id('jar')), pg_temp.id('ev2'), 'so does the outsider');
select is(tests.feed_for('reader', pg_temp.id('jar')), pg_temp.id('ev2') || '/' || pg_temp.id('ev2'), 'and the reader''s feed card');
select is(tests.feed_for('owner', pg_temp.id('jar')), pg_temp.id('ev1') || '/' || pg_temp.id('ev1'), 'the owner''s feed card keeps the pick');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev2')::text, 'the web page falls back');
select ok((select public.public_jar(pg_temp.id('jar'))::text not like '%' || pg_temp.id('ev1') || '%'),
          'and never mentions the Only me pick');
-- An owner may pick an Only me moment for themselves (D-75).
select tests.act_as('owner');
select lives_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('om'), pg_temp.id('jar')),
                'owner may pick an Only me moment');
select tests.reset_role();
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'which readers never get');
select tests.act_as('owner');
update public.moments set visibility = 'everyone' where id = pg_temp.id('ev1');
update public.jars set cover_moment_id = pg_temp.id('ev1') where id = pg_temp.id('jar');
select tests.reset_role();

-- ---------------------------------------------------------------- the pick removed or hidden
select tests.set_status(pg_temp.id('ev1'), 'removed');
select is(tests.cover_for('owner', pg_temp.id('jar')), pg_temp.id('ev2'), 'removed pick: the owner falls back too');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'and the reader');
select is(tests.public_cover(pg_temp.id('jar')), pg_temp.id('ev2')::text, 'and the web page');
select is(tests.feed_for('reader', pg_temp.id('jar')), pg_temp.id('ev2') || '/' || pg_temp.id('ev2'), 'and the feed card');
update public.jars set cover_moment_id = pg_temp.id('rd') where id = pg_temp.id('jar');
update public.moments set hidden_at = now() where id = pg_temp.id('rd');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'a pick hidden under a report: readers fall back');
update public.moments set hidden_at = null where id = pg_temp.id('rd');

-- ---------------------------------------------------------------- the pick deleted
select tests.act_as('owner');
delete from public.moments where id = pg_temp.id('rd');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), null, 'deleting the pick clears it');
select is(tests.cover_for('owner', pg_temp.id('jar')), pg_temp.id('ev2'), 'owner: the derived cover again');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('ev2'), 'reader: the derived cover again');

-- ---------------------------------------------------------------- clearing
select tests.act_as('owner');
update public.jars set cover_moment_id = pg_temp.id('ev2') where id = pg_temp.id('jar');
select lives_ok(format('update public.jars set cover_moment_id = null where id = %L', pg_temp.id('jar')),
                'owner may clear the cover');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), null, 'and it is gone');
select tests.act_as('owner');
update public.jars set cover_moment_id = pg_temp.id('ev2') where id = pg_temp.id('jar');
select tests.act_as('reader');
update public.jars set cover_moment_id = null where id = pg_temp.id('jar');
select tests.reset_role();
select is(tests.pick(pg_temp.id('jar')), pg_temp.id('ev2'), 'a reader cannot clear it');

-- ---------------------------------------------------------------- a Replace keeps the cover (0013)
insert into t (k) values ('repl');
select tests.act_as('owner');
insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, replaces, status)
values (pg_temp.id('repl'), pg_temp.id('jar'), tests.id('owner'), 'ootd', 'p/r', 't/r', pg_temp.id('ev2'), 'checking');
select throws_ok(format('update public.jars set cover_moment_id = %L where id = %L', pg_temp.id('repl'), pg_temp.id('jar')),
                 '42501', null, 'a pending replacement cannot be picked');
select tests.reset_role();
-- fn:moderate approving the replacement deletes the old moment, then lets the new one go live (0013).
select public.moderation_apply(pg_temp.id('repl'), null, 'approve', 'test', '{"sexual":0.1}'::jsonb, 'test reason');
select is(tests.pick(pg_temp.id('jar')), pg_temp.id('repl'), 'the cover moves to the replacement when it takes over');
select is(tests.cover_for('reader', pg_temp.id('jar')), pg_temp.id('repl'), 'and the reader sees the new photo as the cover');

-- ---------------------------------------------------------------- a Readers jar on the web
select is(tests.public_cover(pg_temp.id('jar2')), 'none', 'a Readers teaser carries no cover');

select * from finish();
rollback;
