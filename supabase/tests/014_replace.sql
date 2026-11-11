-- 0013: a removed photo's slot can be filled again (D-27), and Replace (M2-22; FR-JAR-03): a new moment
-- inserted with `replaces`, hidden and not holding the slot until fn:moderate (moderation_apply) approves
-- it, which deletes the old moment in the same transaction. Tried as owner, reader, outsider and blocked user.
begin;
\ir _helpers.psql
select plan(73);

select tests.world();
create temp table t (k text primary key, id uuid not null default gen_random_uuid());
grant select on t to authenticated, anon, service_role, pickld_moderation;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('yesterday', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('other_jar', tests.make_jar('outsider', 'everyone', published => true));
insert into t values ('removed', tests.make_moment((select id from t where k = 'jar'), 'evening', 'removed'));
insert into t values ('old', tests.make_moment((select id from t where k = 'jar'), 'morning', 'live'));
insert into t values ('checking', tests.make_moment((select id from t where k = 'jar'), 'afternoon', 'checking'));
insert into t values ('uploading', tests.make_moment((select id from t where k = 'jar'), 'ootd', 'uploading'));
insert into t values ('outsider_m', tests.make_moment((select id from t where k = 'other_jar'), 'morning', 'live'));
insert into t values ('y_old', tests.make_moment((select id from t where k = 'yesterday'), 'selfie', 'live'));
insert into t values ('cover_jar', tests.make_jar('owner', p_days_ago => 2));
insert into t values ('cover_old', tests.make_moment((select id from t where k = 'cover_jar'), 'whereami', 'live'));
update public.moments set thumb_path = null where id = (select id from t where k = 'cover_old');
update public.moments set photo_path = 'p/old', thumb_path = 't/old' where id = (select id from t where k = 'old');
-- Ids for rows inserted by clients below (a client cannot use insert ... returning *, 0004).
insert into t (k) values ('refill'), ('rep'), ('rep2'), ('rep_bad'), ('rep_removed'), ('rep_y'), ('cover_rep'), ('x');

-- Inserts a moment as the current role with the id reserved in t.
create function pg_temp.put(k text, jar_k text, s slot, replaces_k text default null, by_user text default null)
returns void language sql as $$
  insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, status, replaces)
  values ((select id from t where t.k = put.k), (select id from t where t.k = put.jar_k),
          coalesce(tests.id(put.by_user), auth.uid()), put.s, 'p/' || put.k, 't/' || put.k, 'checking',
          (select id from t where t.k = put.replaces_k))
$$;
create function pg_temp.st(k text) returns text language sql as $$
  select coalesce((select m.status::text from public.moments m where m.id = (select id from t where t.k = st.k)), 'gone')
$$;
create function pg_temp.seen(k text) returns bigint language sql as $$
  select count(*) from public.moments m where m.id = (select id from t where t.k = seen.k)
$$;
create function pg_temp.count_of(jar_k text) returns int language sql as $$
  select moment_count::int from public.jars where id = (select id from t where t.k = count_of.jar_k)
$$;
create function pg_temp.apply(k text, decision text) returns text language sql as $$
  select public.moderation_apply((select id from t where t.k = apply.k),
                                 (select pending_since from public.moments where id = (select id from t where t.k = apply.k)),
                                 decision, 'test', '{}'::jsonb, 'test reason')
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- the schema change
select ok(not exists (select 1 from pg_constraint where conname = 'moments_jar_id_slot_key'),
          '0001''s unique (jar_id, slot) is gone');
select ok((select indexdef ~ 'UNIQUE.*\(jar_id, slot\) WHERE \(\(status <> ''removed''::moment_status\) AND \(replaces IS NULL\)\)'
           from pg_indexes where indexname = 'moments_slot_holder_key'),
          'one moment per slot, not counting removed moments or pending replacements');
select is(pg_temp.count_of('jar'), 3, 'moment_count before: live, checking and uploading (removed not counted)');

-- ---------------------------------------------------------------- D-27: refill a removed slot
select tests.act_as('reader');
select throws_ok($$select pg_temp.put('x', 'jar', 'evening')$$, null, null,
                 'a reader cannot fill the owner''s removed slot');
select throws_ok($$select pg_temp.put('x', 'jar', 'evening', by_user => 'owner')$$, '42501', null,
                 'a reader cannot fill it in the owner''s name either');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.put('x', 'jar', 'evening')$$, null, null, 'an outsider cannot fill it');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.put('x', 'jar', 'evening')$$, null, null, 'the blocked user cannot fill it');
select tests.act_as('owner');
select lives_ok($$select pg_temp.put('refill', 'jar', 'evening')$$, 'the owner can fill a removed moment''s slot again');
select is(pg_temp.st('removed') || '/' || pg_temp.st('refill'), 'removed/checking',
          'the removed moment stays (moderation and appeal record) next to the new one');
select throws_ok($$select pg_temp.put('x', 'jar', 'evening')$$, '23505', null,
                 'the refilled slot refuses another moment');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning')$$, '23505', null,
                 'a second moment in a live slot is still refused');
select throws_ok($$select pg_temp.put('x', 'jar', 'afternoon')$$, '23505', null,
                 'a second moment in a checking slot is still refused');
select throws_ok($$select pg_temp.put('x', 'jar', 'ootd')$$, '23505', null,
                 'a second moment in an uploading slot is still refused');
select throws_ok($$update public.moments set slot = 'morning' where id = (select id from t where k = 'refill')$$, '23505', null,
                 'moving a moment onto a filled slot is still refused');
select tests.reset_role();
select is(pg_temp.count_of('jar'), 4, 'the refill counts once; the removed moment still doesn''t');
select tests.act_as_service();
select is(pg_temp.apply('refill', 'approve'), 'live', 'fn:moderate approves the refill');
select tests.act_as('reader');
select is(pg_temp.seen('refill') || '/' || pg_temp.seen('removed'), '1/0', 'reader: sees the live refill, never the removed one');
select tests.act_as('outsider');
select is(pg_temp.seen('refill') || '/' || pg_temp.seen('removed'), '0/0', 'outsider: sees neither (readers jar)');
select tests.act_as('blocked');
select is(pg_temp.seen('refill') || '/' || pg_temp.seen('removed'), '0/0', 'blocked user: sees neither');
select tests.act_as('owner');
select is(pg_temp.seen('refill') || '/' || pg_temp.seen('removed'), '1/1', 'owner: sees both');

-- ---------------------------------------------------------------- Replace: who and what
select tests.act_as('reader');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning', 'old')$$, null, null, 'a reader cannot replace the owner''s moment');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning', 'old', 'owner')$$, '42501', null,
                 'a reader cannot replace it in the owner''s name');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning', 'old')$$, null, null, 'an outsider cannot replace it');
select throws_ok($$select pg_temp.put('x', 'other_jar', 'morning', 'old')$$, '42501',
                 'a replacement must be for your own moment in the same jar and slot',
                 'an outsider cannot replace it from their own jar');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning', 'old')$$, null, null, 'the blocked user cannot replace it');
select tests.act_as('owner');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning', 'outsider_m')$$, '42501', null,
                 'the owner cannot replace someone else''s moment');
select throws_ok($$select pg_temp.put('x', 'jar', 'selfie', 'old')$$, '42501', null,
                 'a replacement must be in the same slot');
select throws_ok($$select pg_temp.put('x', 'yesterday', 'morning', 'old')$$, '42501', null,
                 'a replacement must be in the same jar');
select throws_ok($$select pg_temp.put('rep_removed', 'jar', 'evening', 'removed')$$, '22023',
                 'a removed moment is not replaced: its slot is free', 'a removed moment cannot be replaced');
select tests.reset_role();
select is((select count(*) from public.moments where id = (select id from t where k = 'x')), 0::bigint,
          'none of the refused inserts left a row');

-- ---------------------------------------------------------------- Replace: pending
select tests.act_as('owner');
select lives_ok($$select pg_temp.put('rep', 'jar', 'morning', 'old')$$, 'the owner can replace their live moment');
select is(pg_temp.st('rep') || '/' || pg_temp.st('old'), 'checking/live', 'the replacement starts checking (rule 4); the old one is live');
select throws_ok($$select pg_temp.put('rep2', 'jar', 'morning', 'old')$$, '23505', null,
                 'only one pending replacement per moment');
select throws_ok($$select pg_temp.put('rep2', 'jar', 'morning', 'rep')$$, '22023', null,
                 'a pending replacement cannot itself be replaced');
select throws_ok($$select pg_temp.put('rep2', 'jar', 'morning')$$, '23505', null,
                 'the slot is still held by the old moment');
select throws_ok($$update public.moments set replaces = null where id = (select id from t where k = 'rep')$$, '42501', null,
                 'the owner cannot detach a replacement to skip the swap');
select throws_ok($$update public.moments set replaces = (select id from t where k = 'checking') where id = (select id from t where k = 'uploading')$$,
                 '42501', null, 'the owner cannot turn an existing moment into a replacement');
select throws_ok($$update public.moments set slot = 'selfie' where id = (select id from t where k = 'old')$$, '42501', null,
                 'a moment being replaced cannot move to another slot');
select throws_ok($$update public.moments set slot = 'selfie' where id = (select id from t where k = 'rep')$$, '42501', null,
                 'a pending replacement cannot move to another slot');
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'rep')$$, '42501', null,
                 'the owner cannot set the replacement live');
select tests.reset_role();
select throws_ok($$select tests.set_status((select id from t where k = 'rep'), 'live')$$, '42501',
                 'a replacement goes live through moderation_apply()',
                 'not even the moderation role can set a replacement live outside moderation_apply()');
select is(pg_temp.count_of('jar'), 4, 'a pending replacement is not counted (the slot counts once)');

-- Readers keep seeing the old photo until the swap.
select tests.act_as('reader');
select is((select string_agg(photo_path, ',') from public.moments where jar_id = (select id from t where k = 'jar') and slot = 'morning'),
          'p/old', 'reader: only the old photo is in the slot while the replacement is pending');
select is((select string_agg(photo_path || '|' || coalesce(pending_photo_path, '-'), ',')
           from public.moment_photo_paths(array[(select id from t where k = 'old'), (select id from t where k = 'rep')])),
          'p/old|-', 'reader: fn:photo-urls signs only the old photo');
select tests.act_as('outsider');
select is(pg_temp.seen('old') + pg_temp.seen('rep'), 0::bigint, 'outsider: sees neither');
select tests.act_as('blocked');
select is(pg_temp.seen('old') + pg_temp.seen('rep'), 0::bigint, 'blocked user: sees neither');
select tests.act_as('owner');
select is(pg_temp.seen('old') + pg_temp.seen('rep'), 2::bigint, 'owner: sees both');
select is((select replaces from public.moments where id = (select id from t where k = 'rep')), (select id from t where k = 'old'),
          'owner: can read replaces to tell the pending replacement apart');
select lives_ok($$select pg_temp.put('cover_rep', 'cover_jar', 'whereami', 'cover_old')$$, 'the owner replaces a moment without a thumbnail');
select is((select coalesce(cover_moment_id::text, 'none') from public.month_jars((now() at time zone 'Asia/Manila')::date - 2)
           where jar_id = (select id from t where k = 'cover_jar')),
          'none', 'month_jars never uses a pending replacement as the cover, even the only photo with a thumbnail');

-- Nobody but moderation_apply() retires the old moment.
select tests.reset_role();
set local role pickld_moderation;
delete from public.moments where id = (select id from t where k = 'checking');
reset role;
select is(pg_temp.st('checking'), 'checking', 'the moderation role cannot delete a moment that has no pending replacement');

-- ---------------------------------------------------------------- Replace: moderation queues it, then approves it
select tests.act_as_service();
select is(pg_temp.apply('rep', 'review'), 'queued', 'review: the replacement waits for a human');
select tests.reset_role();
select is(pg_temp.st('old') || '/' || pg_temp.st('rep'), 'live/checking', 'while queued the old moment stays live');
update public.moderation_items set status = 'kept', decided_at = now() where moment_id = (select id from t where k = 'rep');
select tests.act_as_service();
select is(pg_temp.apply('rep', 'approve'), 'live', 'approve: the replacement goes live');
select tests.reset_role();
select is(pg_temp.st('old') || '/' || pg_temp.st('rep'), 'gone/live', 'in the same transaction the old moment is deleted');
select is((select replaces from public.moments where id = (select id from t where k = 'rep')), null, 'replaces is cleared');
select is(pg_temp.count_of('jar'), 4, 'the slot still counts once');
select tests.act_as('reader');
select is((select string_agg(photo_path, ',') from public.moments where jar_id = (select id from t where k = 'jar') and slot = 'morning'),
          'p/rep', 'reader: now sees only the new photo');
select tests.act_as('outsider');
select is(pg_temp.seen('rep'), 0::bigint, 'outsider: still sees nothing (readers jar)');
select tests.act_as('blocked');
select is(pg_temp.seen('rep'), 0::bigint, 'blocked user: still sees nothing');

-- ---------------------------------------------------------------- Replace: moderation removes it
select tests.act_as('owner');
select lives_ok($$select pg_temp.put('rep2', 'jar', 'morning', 'rep')$$, 'the new moment can itself be replaced');
select tests.act_as_service();
select is(pg_temp.apply('rep2', 'remove'), 'removed', 'remove: the replacement is removed');
select tests.reset_role();
select is(pg_temp.st('rep') || '/' || pg_temp.st('rep2'), 'live/removed', 'the old moment stays live');
select is((select replaces from public.moments where id = (select id from t where k = 'rep2')), (select id from t where k = 'rep'),
          'the removed replacement keeps replaces in its record');
select tests.act_as('reader');
select is(pg_temp.seen('rep') || '/' || pg_temp.seen('rep2'), '1/0', 'reader: still sees the old photo, never the removed one');
select tests.act_as('owner');
select lives_ok($$select pg_temp.put('rep_bad', 'jar', 'morning', 'rep')$$, 'after a removal the owner can try another replacement');

-- ---------------------------------------------------------------- the old moment goes first
-- Moderation removes the old moment: the pending replacement holds the slot itself, still checking.
select tests.reset_role();
select tests.set_status((select id from t where k = 'rep'), 'removed');
select is((select coalesce(replaces::text, 'released') || '/' || status from public.moments where id = (select id from t where k = 'rep_bad')),
          'released/checking', 'when the old moment is removed, its replacement is released and still waits for moderation');
select is(pg_temp.st('rep'), 'removed', 'the removed moment stays');
select is(pg_temp.count_of('jar'), 4, 'the released replacement counts in place of the removed moment');
select tests.act_as('owner');
select throws_ok($$select pg_temp.put('x', 'jar', 'morning')$$, '23505', null, 'the released replacement holds the slot');

-- The owner deletes the old moment: same.
select tests.act_as('owner');
select lives_ok($$select pg_temp.put('rep_y', 'yesterday', 'selfie', 'y_old')$$, 'the owner can replace a moment in an earlier jar');
select ok((select is_backfilled from public.moments where id = (select id from t where k = 'rep_y')),
          'a replacement in a jar whose day has ended gets Added later from the server clock (rule 6)');
delete from public.moments where id = (select id from t where k = 'y_old');
select is((select coalesce(replaces::text, 'released') from public.moments where id = (select id from t where k = 'rep_y')),
          'released', 'when the owner deletes the old moment, its replacement is released');

select * from finish();
rollback;
