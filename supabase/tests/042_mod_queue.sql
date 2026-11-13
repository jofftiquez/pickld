-- M3-26 (0042): the moderation console's queue and header counts (FR-MOD-02). Only moderators can read
-- them; owner, reader, outsider, blocked and anon are refused. Filters, oldest-first order, and the
-- reason, score, report count, appeal and owner history each row carries.
begin;
\ir _helpers.psql
select plan(26);

select tests.world();
select tests.create_user('reporter3');
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'everyone', published => true));
insert into t values ('auto', tests.make_moment((select id from t where k = 'jar'), 'whereami', 'checking'));
insert into t values ('rep', tests.make_moment((select id from t where k = 'jar'), 'mebusywith', 'live'));
insert into t values ('rep1', tests.make_moment((select id from t where k = 'jar'), 'afternoon', 'live'));
insert into t values ('gone', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'removed'));
insert into t values ('esc', tests.make_moment((select id from t where k = 'jar'), 'ootd', 'checking'));
insert into t values ('done', tests.make_moment((select id from t where k = 'jar'), 'morning', 'live'));
update public.moments set caption = 'Fireworks on the pier' where id = (select id from t where k = 'auto');

-- Waiting 3 h (auto-check), 2 h 30 and 2 h (reports), 1 h (appeal); the escalated one 30 min; one already kept.
with x as (
  insert into public.moderation_items (moment_id, source, scores, decision_reason, created_at)
  values ((select id from t where k = 'auto'), 'auto_check',
          '{"provider":"openai","scores":{"violence":0.82,"sexual":0.11,"model":"omni"}}', 'violence',
          now() - interval '3 hours') returning id)
insert into t select 'i_auto', id from x;
with x as (
  insert into public.moderation_items (moment_id, source, created_at)
  values ((select id from t where k = 'rep'), 'report', now() - interval '2 hours') returning id)
insert into t select 'i_rep', id from x;
insert into public.reports (reporter_id, target, target_id, reason, moderation_item_id)
select tests.id(who), 'moment', (select id from t where k = 'rep'), why::report_reason, (select id from t where k = 'i_rep')
from (values ('reader', 'harassment'), ('outsider', 'harassment'), ('reporter3', 'spam')) v(who, why);
insert into public.reports (reporter_id, target, target_id, reason)
values (tests.id('reader'), 'moment', (select id from t where k = 'rep1'), 'spam');
update public.moderation_items set created_at = now() - interval '150 minutes'
where moment_id = (select id from t where k = 'rep1') and source = 'report';
with x as (
  insert into public.moderation_items (moment_id, source, status, decided_at, decision_reason)
  values ((select id from t where k = 'gone'), 'auto_check', 'removed', now(), 'violence') returning id)
insert into t select 'i_gone', id from x;
insert into public.appeals (moderation_item_id, user_id, message)
values ((select id from t where k = 'i_gone'), tests.id('owner'), 'It was a movie prop.');
update public.moderation_items set created_at = now() - interval '1 hour'
where appeal_id = (select id from public.appeals where moderation_item_id = (select id from t where k = 'i_gone'));
insert into public.moderation_items (moment_id, source, status, created_at)
values ((select id from t where k = 'esc'), 'auto_check', 'escalated', now() - interval '30 minutes');
insert into public.moderation_items (moment_id, source, status, created_at)
values ((select id from t where k = 'done'), 'auto_check', 'kept', now() - interval '5 hours');

create function pg_temp.row_for(p_k text, p_filter text default 'all') returns jsonb language sql as $$
  select to_jsonb(q) from public.mod_queue(p_filter) q where q.moment_id = (select id from t where k = p_k)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- who can read it
select is((select proowner::regrole::text || '/' || prosecdef from pg_proc where proname = 'mod_queue'),
          'pickld_moderation/true', 'mod_queue is security definer, owned by pickld_moderation');
select ok(not has_schema_privilege('pickld_moderation', 'public', 'create'), 'pickld_moderation still cannot create objects');
select tests.act_as_anon();
select throws_ok($$select * from public.mod_queue()$$, '42501', null, 'anon cannot read the queue');
select throws_ok($$select * from public.mod_queue_stats()$$, '42501', null, 'anon cannot read the counts');
select tests.act_as('owner');
select throws_ok($$select * from public.mod_queue()$$, '42501', 'moderators only', 'the owner cannot read the queue');
select throws_ok($$select * from public.mod_queue_stats()$$, '42501', 'moderators only', 'the owner cannot read the counts');
select tests.act_as('reader');
select throws_ok($$select * from public.mod_queue()$$, '42501', 'moderators only', 'a reader cannot read the queue');
select tests.act_as('outsider');
select throws_ok($$select * from public.mod_queue()$$, '42501', 'moderators only', 'an outsider cannot read the queue');
select tests.act_as('blocked');
select throws_ok($$select * from public.mod_queue()$$, '42501', 'moderators only', 'a blocked user cannot read the queue');

-- ---------------------------------------------------------------- the queue
select tests.act_as('moderator');
select is((select array_agg(moment_id) from (select moment_id from public.mod_queue()) q),
          array[(select id from t where k = 'auto'), (select id from t where k = 'rep1'), (select id from t where k = 'rep'),
                (select id from t where k = 'gone'), (select id from t where k = 'esc')],
          'All: every open item, oldest first; decided items are left out');
select is((select array_agg(moment_id) from public.mod_queue('auto_check')), array[(select id from t where k = 'auto')],
          'Auto-check: pending auto-check items only (not the escalated one)');
select is((select array_agg(moment_id) from public.mod_queue('report')),
          array[(select id from t where k = 'rep1'), (select id from t where k = 'rep')], 'Reports: pending report items');
select is((select array_agg(moment_id) from public.mod_queue('appeal')), array[(select id from t where k = 'gone')],
          'Appeals: an appeal row names the removed moment');
select is((select array_agg(moment_id) from public.mod_queue('escalated')), array[(select id from t where k = 'esc')],
          'Escalated: escalated items');
select throws_ok($$select * from public.mod_queue('kept')$$, '22023', null, 'an unknown filter is refused');

select is(pg_temp.row_for('auto') ->> 'reason', 'violence', 'auto-check reason: the category that queued it');
select is((pg_temp.row_for('auto') ->> 'score')::numeric, 0.82, 'auto-check score: that category''s score');
select is(pg_temp.row_for('auto') ->> 'caption', 'Fireworks on the pier', 'the caption comes with the row');
select is(pg_temp.row_for('auto') ->> 'username', (select username::text from public.profiles where id = tests.id('owner')),
          'the owner''s username comes with the row');
select is((pg_temp.row_for('auto') ->> 'prior_removals')::int, 1, 'prior removals count the owner''s other removed content');
select is(pg_temp.row_for('rep') ->> 'reason' || '/' || (pg_temp.row_for('rep') ->> 'report_count'), 'harassment/3',
          'report reason: the most common one, with the number of reports');
select is(pg_temp.row_for('gone') ->> 'reason' || '/' || (pg_temp.row_for('gone') ->> 'appeal_message'),
          'violence/It was a movie prop.', 'appeal: the guideline it was removed under and the owner''s message');
select is(array[pg_temp.row_for('auto') ->> 'visible', pg_temp.row_for('rep1') ->> 'visible',
                pg_temp.row_for('rep') ->> 'visible', pg_temp.row_for('gone') ->> 'visible'],
          array['false', 'true', 'false', 'false'],
          'visible: checking and removed moments are hidden, a reported one stays up until 3 reports hide it');
select is((pg_temp.row_for('gone') ->> 'prior_removals')::int, 0, 'the appealed removal itself is not a prior removal');

select is((select to_jsonb(s) - 'median_wait_seconds' from public.mod_queue_stats() s),
          '{"pending":4,"open_appeals":1,"all_open":5,"auto_check":1,"report":2,"escalated":1}'::jsonb,
          'counts: pending, open appeals, and each filter');
select ok((select median_wait_seconds between 8090 and 8200 from public.mod_queue_stats()),
          'median wait of the pending items (3 h, 2 h 30, 2 h, 1 h) is 2 h 15');

select * from finish();
rollback;
