-- M2-20 (0040): a child-safety match removes the photo, suspends the owner, records a csam_incidents row
-- and never leaves a moderation_items row (FR-SAF-04). Only service_role (fn:moderate) may call it; no
-- client or moderator can read the incidents. moderation_apply() stores the second opinion (D-13).
begin;
\ir _helpers.psql
select plan(24);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('c1', tests.make_moment((select id from t where k = 'jar'), 'whereami', 'checking'));
insert into t values ('c2', tests.make_moment((select id from t where k = 'jar'), 'mebusywith', 'checking'));
insert into t values ('live', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'live'));
grant execute on all functions in schema pg_temp to service_role;

-- ---------------------------------------------------------------- who may call it
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'moderation_csam_block'),
          'pickld_moderation/true', 'moderation_csam_block is security definer, owned by pickld_moderation');
select tests.act_as('owner');
select throws_ok($$select public.moderation_csam_block((select id from t where k = 'c1'), null, 'x', '{}', 'a', 'b')$$,
                 '42501', null, 'owner cannot call moderation_csam_block');
select tests.act_as('outsider');
select throws_ok($$select public.moderation_csam_block((select id from t where k = 'c1'), null, 'x', '{}', 'a', 'b')$$,
                 '42501', null, 'outsider cannot call moderation_csam_block');
select tests.act_as('moderator');
select throws_ok($$select public.moderation_csam_block((select id from t where k = 'c1'), null, 'x', '{}', 'a', 'b')$$,
                 '42501', null, 'a moderator cannot call moderation_csam_block');
select tests.reset_role();

-- ---------------------------------------------------------------- a match
-- An existing report item on the moment must disappear with the block (never in the queue).
insert into public.moderation_items (moment_id, source, status) values ((select id from t where k = 'c1'), 'auto_check', 'pending');
update public.moderation_items set status = 'kept' where moment_id = (select id from t where k = 'c1');

select tests.act_as_service();
select is(public.moderation_csam_block((select id from t where k = 'c1'), null, 'hash-list', '{"sha256":"ab"}',
                                       'moments/x/full.jpg', 'moments/x/thumb.jpg'),
          'blocked', 'a match on a checking moment is blocked');
select tests.reset_role();
select is((select status::text from public.moments where id = (select id from t where k = 'c1')), 'removed',
          'the moment is removed');
select is((select status::text from public.profiles where id = tests.id('owner')), 'suspended',
          'the owner is suspended immediately');
select is((select count(*)::int from public.moderation_items where moment_id = (select id from t where k = 'c1')), 0,
          'no moderation_items row about the moment remains');
select is((select count(*)::int from public.csam_incidents where moment_id = (select id from t where k = 'c1')
             and photo_path = 'moments/x/full.jpg' and matcher = 'hash-list' and status = 'open'), 1,
          'one open incident with the object key');

select tests.act_as('reader');
select is((select count(*)::int from public.moments where user_id = tests.id('owner')), 0,
          'a reader sees none of the suspended owner''s moments');
select tests.reset_role();

-- ---------------------------------------------------------------- nobody but the server reads incidents
select tests.act_as('owner');
select throws_ok($$select count(*) from public.csam_incidents$$, '42501', null, 'the owner cannot read incidents');
select tests.act_as('moderator');
select throws_ok($$select count(*) from public.csam_incidents$$, '42501', null, 'a moderator cannot read incidents');
select tests.act_as('outsider');
select throws_ok($$insert into public.csam_incidents (user_id, matcher) values (tests.id('outsider'), 'x')$$,
                 '42501', null, 'a client cannot write incidents');
select tests.act_as('blocked');
select throws_ok($$select count(*) from public.csam_incidents$$, '42501', null, 'a blocked user cannot read incidents');
select tests.act_as_service();
select throws_ok($$insert into public.csam_incidents (user_id, matcher) values (tests.id('outsider'), 'x')$$,
                 '42501', null, 'service_role cannot write incidents directly');
select tests.reset_role();

-- ---------------------------------------------------------------- the evidence outlives the moment
select tests.act_as('owner');
select throws_ok($$select public.account_delete_request()$$, '42501', 'this account has moderation records',
                 'an account with an incident cannot delete itself');
select tests.reset_role();
delete from public.moments where id = (select id from t where k = 'c1');
select is((select count(*)::int from public.csam_incidents where photo_path = 'moments/x/full.jpg' and moment_id is null), 1,
          'deleting the moment keeps the incident and its keys');
select throws_ok($$delete from public.profiles where id = tests.id('owner')$$, '23503', null,
                 'the profile cannot be purged while an incident exists');

-- ---------------------------------------------------------------- other outcomes
select tests.act_as_service();
select is(public.moderation_csam_block((select id from t where k = 'live'), null, 'hash-list', '{}', 'a', 'b'),
          'nothing_to_check', 'a live moment without a proposal has nothing to check');
select is(public.moderation_csam_block((select id from t where k = 'c2'), now(), 'hash-list', '{}', 'a', 'b'),
          'stale', 'a changed proposal is stale');
select is(public.moderation_csam_block(gen_random_uuid(), null, 'hash-list', '{}', 'a', 'b'), 'not_found', 'not found');
select throws_ok($$select public.moderation_csam_block((select id from t where k = 'c2'), null, '', '{}', 'a', 'b')$$,
                 '22023', null, 'a matcher name is required');

-- ---------------------------------------------------------------- second opinion on queued items
select is(public.moderation_apply((select id from t where k = 'c2'), null, 'review', 'test', '{"sexual":0.5}', 'sexual',
                                  '{"model":"m","verdict":"unsure","reason":"swimsuit at the beach"}'),
          'queued', 'a borderline photo is queued');
select tests.reset_role();
select is((select second_opinion ->> 'reason' from public.moderation_items where moment_id = (select id from t where k = 'c2')),
          'swimsuit at the beach', 'the second opinion is stored on the item');

select * from finish();
rollback;
