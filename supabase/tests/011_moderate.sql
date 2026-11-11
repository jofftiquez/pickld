-- M2-19 (0011): only fn:moderate (moderation_apply, role pickld_moderation) sets live or removed;
-- approve, swap, review, remove and stale proposals (FR-SAF-03, FR-PUB-07, FR-JAR-03; D-22).
begin;
\ir _helpers.psql
select plan(55);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('c1', tests.make_moment((select id from t where k = 'jar'), 'whereami', 'checking'));
insert into t values ('c2', tests.make_moment((select id from t where k = 'jar'), 'mebusywith', 'checking'));
insert into t values ('c3', tests.make_moment((select id from t where k = 'jar'), 'whoamiwith', 'checking'));
insert into t values ('c4', tests.make_moment((select id from t where k = 'jar'), 'ootd', 'checking'));
insert into t values ('live', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'live'));
insert into t values ('live2', tests.make_moment((select id from t where k = 'jar'), 'morning', 'live'));
insert into t values ('uploading', tests.make_moment((select id from t where k = 'jar'), 'afternoon', 'uploading'));
insert into t values ('removed', tests.make_moment((select id from t where k = 'jar'), 'evening', 'removed'));

create function pg_temp.status(k text) returns text language sql as $$
  select m.status::text from public.moments m join t on t.id = m.id where t.k = status.k
$$;
create function pg_temp.apply(k text, decision text, pending timestamptz default null) returns text language sql as $$
  select public.moderation_apply((select id from t where t.k = apply.k), pending, decision, 'test', '{"sexual":0.1}'::jsonb, 'test reason')
$$;
grant execute on all functions in schema pg_temp to service_role;

-- ---------------------------------------------------------------- the role itself
select ok((select not rolcanlogin from pg_roles where rolname = 'pickld_moderation'), 'pickld_moderation cannot log in');
select ok(not pg_has_role('authenticator', 'pickld_moderation', 'member')
          and not pg_has_role('authenticated', 'pickld_moderation', 'member')
          and not pg_has_role('anon', 'pickld_moderation', 'member')
          and not pg_has_role('service_role', 'pickld_moderation', 'member'),
          'no API role (authenticator, authenticated, anon, service_role) can become pickld_moderation');
-- (SET ROLE checks the session user, which is postgres under pgTAP, so membership is what proves this.)
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'moderation_apply'),
          'pickld_moderation/true', 'moderation_apply is security definer, owned by pickld_moderation');
select ok(not has_schema_privilege('pickld_moderation', 'public', 'create'), 'pickld_moderation cannot create objects');

-- ---------------------------------------------------------------- clients cannot set live or removed (rule 4)
select tests.act_as('owner');
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'c1')$$,
                 '42501', 'status can only be set by the server', 'owner cannot set their checking moment live');
select throws_ok($$update public.moments set status = 'removed' where id = (select id from t where k = 'c1')$$,
                 '42501', 'status can only be set by the server', 'owner cannot set removed');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'approve', 'me')$$,
                 '42501', null, 'owner cannot call moderation_apply');

select tests.act_as('reader');
update public.moments set status = 'live' where id = (select id from t where k = 'c1');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'approve', 'me')$$,
                 '42501', null, 'reader cannot call moderation_apply');
select tests.act_as('outsider');
update public.moments set status = 'live' where id = (select id from t where k = 'c1');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'approve', 'me')$$,
                 '42501', null, 'outsider cannot call moderation_apply');
select tests.act_as('blocked');
update public.moments set status = 'live' where id = (select id from t where k = 'c1');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'approve', 'me')$$,
                 '42501', null, 'blocked user cannot call moderation_apply');
select tests.act_as('moderator');
update public.moments set status = 'removed' where id = (select id from t where k = 'live');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'remove', 'me')$$,
                 '42501', null, 'a moderator account cannot call moderation_apply either');
select tests.act_as_anon();
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'c1')$$,
                 '42501', null, 'anon cannot update moments');
select throws_ok($$select public.moderation_apply((select id from t where k = 'c1'), null, 'approve', 'me')$$,
                 '42501', null, 'anon cannot call moderation_apply');
select tests.reset_role();
select is(pg_temp.status('c1') || '/' || pg_temp.status('live'), 'checking/live',
          'reader, outsider, blocked user and moderator updates change nothing');

-- Other server code (service_role, the postgres owner) is refused too.
select tests.act_as_service();
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'c1')$$,
                 '42501', 'status can only be set by the server', 'service_role cannot set live directly');
select throws_ok($$update public.moments set status = 'removed' where id = (select id from t where k = 'live')$$,
                 '42501', 'status can only be set by the server', 'service_role cannot set removed directly');
select tests.reset_role();
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'c1')$$,
                 '42501', 'status can only be set by the server', 'the postgres owner cannot set live directly');

-- ---------------------------------------------------------------- approve: checking → live
select tests.act_as('reader');
select is((select count(*) from public.moments where id = (select id from t where k = 'c1')), 0::bigint,
          'a reader cannot see a checking moment');
select tests.act_as_service();
select throws_ok($$select pg_temp.apply('c1', 'publish')$$, '22023', null, 'an unknown decision is refused');
select is(pg_temp.apply('c1', 'approve'), 'live', 'approve: a checking moment goes live');
select is(pg_temp.apply('c1', 'approve'), 'nothing_to_check', 'a second call has nothing to check');
select tests.reset_role();
select is(pg_temp.status('c1'), 'live', 'the moment is live');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'jar')), 3,
          'visible_count counts it (2 live + 1 approved)');

select tests.act_as('reader');
select is((select count(*) from public.moments where id = (select id from t where k = 'c1')), 1::bigint, 'the reader now sees it');
select tests.act_as('outsider');
select is((select count(*) from public.moments where id = (select id from t where k = 'c1')), 0::bigint,
          'an outsider still cannot see a readers jar moment');
select tests.act_as('blocked');
select is((select count(*) from public.moments where id = (select id from t where k = 'c1')), 0::bigint,
          'the blocked user still cannot see it');
select tests.act_as('owner');
select is((select status::text from public.moments where id = (select id from t where k = 'c1')), 'live', 'the owner sees it live');

-- ---------------------------------------------------------------- replace: the proposal swaps in (FR-JAR-03)
update public.moments set photo_path = 'p/new', thumb_path = 't/new', caption = 'replaced'
  where id = (select id from t where k = 'live');
select tests.act_as('reader');
select isnt((select photo_path from public.moments where id = (select id from t where k = 'live')), 'p/new',
            'before approval the reader still sees the old photo');
select tests.act_as_service();
select is(pg_temp.apply('live', 'approve', null), 'stale', 'a verdict on the old version of a changed moment is stale');
select is(pg_temp.apply('live', 'approve', now() - interval '1 hour'), 'stale', 'a verdict on an older proposal is stale');
select is((select pending_photo_path from public.moments where id = (select id from t where k = 'live')), 'p/new',
          'a stale verdict changes nothing');
select is(pg_temp.apply('live', 'approve', (select pending_since from public.moments where id = (select id from t where k = 'live'))),
          'swapped', 'approve with the proposal''s pending_since swaps it in');
select is((select array[photo_path, thumb_path, caption, status::text, coalesce(pending_photo_path, '-'), coalesce(pending_since::text, '-')]
           from public.moments where id = (select id from t where k = 'live')),
          array['p/new', 't/new', 'replaced', 'live', '-', '-'], 'the new photo, thumbnail and caption are live; pending_* cleared');
select tests.act_as('reader');
select is((select photo_path || ' ' || caption from public.moments where id = (select id from t where k = 'live')), 'p/new replaced',
          'the reader sees the replacement');
select tests.act_as('owner');
select is((select count(*) from public.my_pending_moments() where moment_id = (select id from t where k = 'live')), 0::bigint,
          'nothing is pending any more');

-- A checking moment edited before its check: the latest version is what goes live.
update public.moments set caption = 'edited while checking' where id = (select id from t where k = 'c2');
select tests.act_as_service();
select is(pg_temp.apply('c2', 'approve', (select pending_since from public.moments where id = (select id from t where k = 'c2'))),
          'swapped', 'approving a checking moment with a proposal swaps it in');
select is((select status::text || ' ' || caption from public.moments where id = (select id from t where k = 'c2')),
          'live edited while checking', 'it goes live with the edited caption');

-- ---------------------------------------------------------------- review: queued for a human
select is(pg_temp.apply('c3', 'review'), 'queued', 'review queues the moment');
select is((select status::text || '/' || source::text || '/' || (scores ->> 'provider') || '/' || decision_reason
           from public.moderation_items where moment_id = (select id from t where k = 'c3')),
          'pending/auto_check/test/test reason', 'a pending auto_check item records the provider and reason');
select is(pg_temp.status('c3'), 'checking', 'a queued moment stays checking (hidden)');
select is(pg_temp.apply('c3', 'approve'), 'queued', 'while queued, a later verdict is ignored (a human decides)');
select is(pg_temp.status('c3'), 'checking', 'so calling again cannot approve queued content');
select is((select count(*) from public.moderation_items where moment_id = (select id from t where k = 'c3')), 1::bigint,
          'and no duplicate item is created');
select tests.act_as('owner');
select is((select count(*) from public.moderation_items), 0::bigint, 'the owner cannot read moderation items');
select tests.act_as('moderator');
select is((select count(*) from public.moderation_items where moment_id = (select id from t where k = 'c3')), 1::bigint,
          'a moderator sees the queued item');

-- ---------------------------------------------------------------- remove
select tests.act_as_service();
select is(pg_temp.apply('c4', 'remove'), 'removed', 'remove: a checking moment is removed');
select is(pg_temp.status('c4'), 'removed', 'its status is removed');
select is((select status::text || '/' || (decided_at is not null) from public.moderation_items where moment_id = (select id from t where k = 'c4')),
          'removed/true', 'a decided removed item is recorded');
select tests.reset_role();
insert into t select 'item_c4', id from public.moderation_items where moment_id = (select id from t where k = 'c4');
select tests.act_as('owner');
select ok(public.can_appeal((select id from t where k = 'item_c4')), 'the owner can appeal the removal');
update public.moments set caption = 'not this one' where id = (select id from t where k = 'live2');
select tests.act_as_service();
select is(pg_temp.apply('live2', 'remove', (select pending_since from public.moments where id = (select id from t where k = 'live2'))),
          'discarded', 'removing a proposal on a live moment discards the proposal');
select is((select status::text || '/' || coalesce(caption, '-') || '/' || (pending_since is null)
           from public.moments where id = (select id from t where k = 'live2')),
          'live/-/true', 'the checked version stays live and the proposal is gone');

-- ---------------------------------------------------------------- nothing to do
select is(pg_temp.apply('uploading', 'approve'), 'nothing_to_check', 'an uploading (unsubmitted) moment is not approved');
select is(pg_temp.apply('removed', 'approve'), 'nothing_to_check', 'a removed moment cannot be brought back');
select is(public.moderation_apply(gen_random_uuid(), null, 'approve', 'test'), 'not_found', 'an unknown id is not found');
select tests.reset_role();
select is(pg_temp.status('uploading') || '/' || pg_temp.status('removed'), 'uploading/removed', 'both are unchanged');

select * from finish();
rollback;
