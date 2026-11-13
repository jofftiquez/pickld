-- M3-23 (0041): moderator decisions through mod_decide(), appeals decided by a different moderator,
-- strikes and the 7-day suspension (D-10, D-11), audit rows for every action, owner notifications.
-- Owner, reader, outsider, blocked and anon can't decide; moderators can't write the tables directly.
begin;
\ir _helpers.psql
select plan(52);

select tests.world();
select tests.create_user('mod2', 'moderator');
select tests.create_user('striker');
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('mjar', tests.make_jar('moderator', 'readers', published => true));
insert into t values ('sjar', tests.make_jar('striker', 'readers', published => true));
insert into t values ('keep', tests.make_moment((select id from t where k = 'jar'), 'whereami', 'checking'));
insert into t values ('rm', tests.make_moment((select id from t where k = 'jar'), 'mebusywith', 'checking'));
insert into t values ('esc', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'checking'));
insert into t values ('mine', tests.make_moment((select id from t where k = 'mjar'), 'whereami', 'checking'));
insert into t values ('s1', tests.make_moment((select id from t where k = 'sjar'), 'whereami', 'checking'));
insert into t values ('s2', tests.make_moment((select id from t where k = 'sjar'), 'mebusywith', 'checking'));
insert into t values ('s3', tests.make_moment((select id from t where k = 'sjar'), 'selfie', 'checking'));
insert into public.moderation_items (moment_id, source, scores)
select id, 'auto_check', '{}' from t where k in ('keep', 'rm', 'esc', 'mine');
insert into public.comments (id, jar_id, user_id, body, is_hidden) values
  ('c4100000-0000-4000-8000-000000000001', (select id from t where k = 'jar'), tests.id('reader'), 'mean', false);
insert into public.moderation_items (comment_id, source) values ('c4100000-0000-4000-8000-000000000001', 'auto_check');
insert into public.moderation_items (jar_id, source) values ((select id from t where k = 'jar'), 'report');

create function pg_temp.item(p_k text, p_source mod_source default 'auto_check') returns uuid language sql stable as $$
  select id from public.moderation_items
  where moment_id = (select id from t where k = p_k) and source = p_source order by created_at desc limit 1
$$;
create function pg_temp.decide(p_item uuid, p_action text, p_guideline text default null) returns text language sql as $$
  select public.mod_decide(p_item, p_action, p_guideline) ->> 'result'
$$;
create function pg_temp.status(p_k text) returns text language sql stable as $$
  select status::text from public.moments where id = (select id from t where k = p_k)
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- ---------------------------------------------------------------- who may decide
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_decide'),
          'pickld_moderation/true', 'mod_decide is security definer, owned by pickld_moderation');
select tests.act_as('owner');
select throws_ok($$select pg_temp.decide(pg_temp.item('keep'), 'keep')$$, '42501', null, 'owner cannot decide');
select tests.act_as('reader');
select throws_ok($$select pg_temp.decide(pg_temp.item('keep'), 'keep')$$, '42501', null, 'reader cannot decide');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.decide(pg_temp.item('keep'), 'keep')$$, '42501', null, 'outsider cannot decide');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.decide(pg_temp.item('keep'), 'keep')$$, '42501', null, 'blocked user cannot decide');
select tests.act_as_anon();
select throws_ok($$select public.mod_decide(gen_random_uuid(), 'keep')$$, '42501', null, 'anon cannot decide');

select tests.act_as('moderator');
select throws_ok($$update public.moderation_items set status = 'kept' where id = pg_temp.item('keep')$$,
                 '42501', null, 'a moderator cannot update moderation_items directly (no audit row)');
select throws_ok($$insert into public.audit_log (actor_id, action) values (auth.uid(), 'forged')$$,
                 '42501', null, 'a moderator cannot write the audit log');
select throws_ok($$select pg_temp.decide(pg_temp.item('rm'), 'remove')$$, '22023', null,
                 'a removal needs a guideline');
select throws_ok($$select pg_temp.decide(pg_temp.item('rm'), 'delete')$$, '22023', null, 'unknown actions are refused');

-- ---------------------------------------------------------------- keep
select is(pg_temp.decide(pg_temp.item('keep'), 'keep'), 'kept', 'keep an auto-check item');
select tests.reset_role();
select is(pg_temp.status('keep'), 'live', 'kept: the moment is live');
select is((select count(*) from public.audit_log where action = 'keep' and actor_id = tests.id('moderator')
             and target = 'moment' and target_id = (select id from t where k = 'keep')),
          1::bigint, 'keep writes an audit row with who and what');
select tests.act_as('moderator');
select is(pg_temp.decide(pg_temp.item('keep'), 'remove', 'spam'), 'already_decided', 'a decided item stays decided');

-- ---------------------------------------------------------------- remove
select is(public.mod_decide(pg_temp.item('rm'), 'remove', 'violence', 'gore') ->> 'result', 'removed', 'remove an item');
select tests.reset_role();
select is(pg_temp.status('rm'), 'removed', 'removed: the moment is removed');
select is((select count(*) from public.notifications where user_id = tests.id('owner') and type = 'removed'
             and moment_id = (select id from t where k = 'rm')), 1::bigint, 'the owner is notified');
select is((select decided_by::text || '/' || decision_reason from public.moderation_items where id = pg_temp.item('rm')),
          tests.id('moderator')::text || '/violence', 'the item records who decided and the guideline');
select is((select data ->> 'note' from public.audit_log where action = 'remove'
             and target_id = (select id from t where k = 'rm')), 'gore', 'the audit row keeps the reason');

-- ---------------------------------------------------------------- escalate, then remove and warn
select tests.act_as('moderator');
select is(pg_temp.decide(pg_temp.item('esc'), 'escalate'), 'escalated', 'escalate a pending item');
select is(pg_temp.decide(pg_temp.item('esc'), 'escalate'), 'already_decided', 'an escalated item is not escalated again');
select tests.act_as('mod2');
select is(pg_temp.decide(pg_temp.item('esc'), 'remove_warn', 'hate'), 'removed', 'an escalated item can be decided');
select tests.reset_role();
select is((select (data ->> 'warned')::boolean from public.audit_log where action = 'remove_warn'
             and target_id = (select id from t where k = 'esc')), true, 'remove and warn is recorded as a warning');
select is((select count(*) from public.audit_log where target_id = (select id from t where k = 'esc')),
          2::bigint, 'escalate and the removal each wrote an audit row');

-- ---------------------------------------------------------------- not your own content
select tests.act_as('moderator');
select is(pg_temp.decide(pg_temp.item('mine'), 'keep'), 'own_content', 'a moderator cannot decide about their own moment');

-- ---------------------------------------------------------------- comments and jars
select is(pg_temp.decide((select id from public.moderation_items where comment_id = 'c4100000-0000-4000-8000-000000000001'),
                         'remove', 'harassment'), 'removed', 'remove a comment');
select tests.reset_role();
select ok((select is_hidden from public.comments where id = 'c4100000-0000-4000-8000-000000000001'), 'the comment is hidden');
select is((select count(*) from public.notifications where user_id = tests.id('reader') and type = 'removed'
             and comment_id = 'c4100000-0000-4000-8000-000000000001'), 1::bigint, 'its author is notified');
select tests.act_as('moderator');
select is(pg_temp.decide((select id from public.moderation_items where jar_id = (select id from t where k = 'jar')),
                         'remove', 'spam'), 'unsupported', 'a jar report can only be kept or escalated');

-- ---------------------------------------------------------------- the owner's removal and the appeal
-- Owners can't read moderation_items: the ids they appeal are kept in t.
select tests.reset_role();
insert into t values ('i_rm', pg_temp.item('rm'));
select tests.act_as('owner');
select is((select guideline || '/' || can_appeal || '/' || coalesce(appeal_status, '-')
           from public.my_removal((select id from t where k = 'rm'))),
          'violence/true/-', 'the owner reads the guideline and may appeal');
select tests.act_as('outsider');
select is((select count(*) from public.my_removal((select id from t where k = 'rm'))), 0::bigint,
          'nobody else reads it');
select tests.act_as('owner');
select lives_ok($$insert into public.appeals (moderation_item_id, user_id, message)
                  values ((select id from t where k = 'i_rm'), auth.uid(), 'it was fake blood')$$, 'the owner appeals');
select throws_ok($$insert into public.appeals (moderation_item_id, user_id, message)
                   values ((select id from t where k = 'i_rm'), auth.uid(), 'again')$$, '23505', null, 'one appeal per removal');
select is((select can_appeal::text || '/' || appeal_status from public.my_removal((select id from t where k = 'rm'))),
          'false/open', 'the removal shows the open appeal');
select tests.reset_role();
select is((select status::text from public.moderation_items where moment_id = (select id from t where k = 'rm')
             and source = 'appeal'), 'pending', 'the appeal joins the queue');

select tests.act_as('moderator');
select is(pg_temp.decide(pg_temp.item('rm', 'appeal'), 'keep'), 'same_moderator',
          'the moderator who removed it cannot decide the appeal');
select tests.act_as('mod2');
select is(pg_temp.decide(pg_temp.item('rm', 'appeal'), 'keep'), 'overturned', 'a different moderator overturns it');
select tests.reset_role();
select is(pg_temp.status('rm'), 'live', 'overturned: the moment is live again');
select is((select status from public.appeals where moderation_item_id = pg_temp.item('rm')), 'overturned',
          'the appeal is decided');
select is((select count(*) from public.notifications where user_id = tests.id('owner') and type = 'appeal_decided'),
          1::bigint, 'the owner is told the appeal was decided');
select is(public.strike_count(tests.id('owner')), 1, 'the overturned removal no longer counts as a strike');

-- ---------------------------------------------------------------- strikes and suspension
select tests.act_as_service();
select public.moderation_apply((select id from t where k = 's1'), null, 'remove', 'test', '{}', 'sexual');
select public.moderation_apply((select id from t where k = 's2'), null, 'remove', 'test', '{}', 'sexual');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('striker')), 'active',
          'two automatic removals: still active');
select tests.act_as_service();
select public.moderation_apply((select id from t where k = 's3'), null, 'remove', 'test', '{}', 'sexual');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('striker')), 'suspended',
          'the third removal in 90 days suspends the account');
select ok((select suspended_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
           from public.profiles where id = tests.id('striker')), 'for 7 days');
select is((select count(*) from public.audit_log where action = 'suspend' and target_id = tests.id('striker')
             and actor_id is null), 1::bigint, 'the suspension is audited');

select tests.act_as('owner');
select throws_ok($$update public.profiles set suspended_until = now() where id = auth.uid()$$, '42501', null,
                 'clients cannot set suspended_until');

-- An overturned appeal brings the striker under three strikes: the suspension ends at once.
select tests.reset_role();
insert into t values ('i_s1', pg_temp.item('s1'));
select tests.act_as('striker');
select lives_ok($$insert into public.appeals (moderation_item_id, user_id) values ((select id from t where k = 'i_s1'), auth.uid())$$,
                'a suspended user can still appeal');
select tests.act_as('moderator');
select is(pg_temp.decide(pg_temp.item('s1', 'appeal'), 'keep'), 'overturned', 'the appeal is overturned');
select tests.reset_role();
select is((select status::text || '/' || coalesce(suspended_until::text, '-') from public.profiles
           where id = tests.id('striker')), 'active/-', 'and the suspension is lifted');

-- Expiry: fn:account-jobs lifts suspensions whose end has passed.
update public.profiles set status = 'suspended', suspended_until = now() - interval '1 minute'
where id = tests.id('striker');
select tests.act_as('owner');
select throws_ok($$select public.moderation_lift_suspensions()$$, '42501', null, 'clients cannot lift suspensions');
select tests.act_as_service();
select ok(public.moderation_lift_suspensions() >= 1, 'the job lifts expired suspensions');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('striker')), 'active', 'the striker is active again');

select * from finish();
rollback;
