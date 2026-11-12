-- M3-20 (0021; FR-SAF-01, S-11): reports, moderation items for reports, three reports hide a moment.
-- Reporting each target type tried as owner, reader, outsider, blocked user, blocker and anon; one report
-- per reporter per target; the queue item; the 24-hour rule; where a hidden moment disappears; and that
-- the reported user can't learn who reported them.
begin;
\ir _helpers.psql
select plan(89);

select tests.world();
select tests.create_user('r3');
select tests.create_user('r4');
select tests.create_user('r5');

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('j_ev', tests.make_jar('owner', 'everyone', published => true));
insert into t values ('j_rd', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('m1', tests.make_moment((select id from t where k = 'j_ev'), 'morning', 'live'));
insert into t values ('m2', tests.make_moment((select id from t where k = 'j_ev'), 'afternoon', 'live'));
insert into t values ('m3', tests.make_moment((select id from t where k = 'j_ev'), 'evening', 'live'));
insert into t values ('m_priv', tests.make_moment((select id from t where k = 'j_ev'), 'whereami', 'live', true));
insert into t values ('m_chk', tests.make_moment((select id from t where k = 'j_ev'), 'mebusywith', 'checking'));
insert into t values ('m_rd', tests.make_moment((select id from t where k = 'j_rd'), 'morning', 'live'));
insert into public.comments (jar_id, user_id, body, is_hidden)
  values ((select id from t where k = 'j_ev'), tests.id('reader'), 'visible comment', false);
insert into t select 'c1', id from public.comments where body = 'visible comment';
insert into public.comments (jar_id, user_id, body, is_hidden)
  values ((select id from t where k = 'j_ev'), tests.id('reader'), 'unchecked comment', true);
insert into t select 'c_hidden', id from public.comments where body = 'unchecked comment';
insert into t select 'p_' || name, id from tests.users;
create temp table n0 as select count(*) as c from public.notifications where user_id = tests.id('owner');

-- submit_report on t[k] as the current role.
create function pg_temp.rep(p_target text, p_k text) returns void language sql as $$
  select public.submit_report(p_target::target_type, coalesce((select id from t where t.k = p_k), gen_random_uuid()),
                              'spam', 'a note')
$$;
create function pg_temp.reports_on(p_k text) returns bigint language sql as $$
  select count(*) from public.reports where target_id = (select id from t where t.k = p_k)
$$;
create function pg_temp.hidden(p_k text) returns boolean language sql as $$
  select hidden_at is not null from public.moments where id = (select id from t where t.k = p_k)
$$;
create function pg_temp.sees(p_k text) returns bigint language sql as $$
  select count(*) from public.moments where id = (select id from t where t.k = p_k)
$$;
create function pg_temp.paths(p_k text) returns bigint language sql as $$
  select count(*) from public.moment_photo_paths(array[(select id from t where t.k = p_k)])
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

select hasnt_column('public', 'moderation_items', 'reporter_id', 'moderation_items has no reporter column');

-- ---------------------------------------------------------------- moments
select tests.act_as('owner');
select throws_ok($$select pg_temp.rep('moment', 'm1')$$, '22023', 'you cannot report your own content',
                 'owner cannot report their own moment');
select tests.act_as('reader');
select lives_ok($$select pg_temp.rep('moment', 'm_rd')$$, 'reader reports a moment in a Readers jar');
select throws_ok($$select pg_temp.rep('moment', 'm_priv')$$, '42501', 'you can only report something you can see',
                 'reader cannot report a private moment');
select throws_ok($$select pg_temp.rep('moment', 'm_chk')$$, '42501', 'you can only report something you can see',
                 'reader cannot report a moment still being checked');
select throws_ok($$select pg_temp.rep('moment', 'nope')$$, '42501', 'you can only report something you can see',
                 'a missing moment looks the same as one you cannot see');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.rep('moment', 'm_rd')$$, '42501', 'you can only report something you can see',
                 'outsider cannot report a moment in a Readers jar');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'outsider reports a moment in an Everyone jar');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.rep('moment', 'm1')$$, '42501', 'you can only report something you can see',
                 'blocked user cannot report the blocker''s moment');
select tests.act_as('blocker');
select throws_ok($$select pg_temp.rep('moment', 'm1')$$, '42501', 'you can only report something you can see',
                 'blocker cannot report the blocked user''s moment');
select tests.act_as_anon();
select throws_ok($$select pg_temp.rep('moment', 'm1')$$, '42501', null, 'anon cannot report');
select throws_ok($$insert into public.reports (reporter_id, target, target_id, reason)
                   values (tests.id('outsider'), 'moment', (select id from t where k = 'm2'), 'spam')$$,
                 '42501', null, 'anon cannot insert reports');

-- ---------------------------------------------------------------- jars
select tests.act_as('owner');
select throws_ok($$select pg_temp.rep('jar', 'j_ev')$$, '22023', 'you cannot report your own content',
                 'owner cannot report their own jar');
select tests.act_as('reader');
select lives_ok($$select pg_temp.rep('jar', 'j_rd')$$, 'reader reports a Readers jar');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.rep('jar', 'j_rd')$$, '42501', 'you can only report something you can see',
                 'outsider cannot report a Readers jar');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.rep('jar', 'j_ev')$$, '42501', 'you can only report something you can see',
                 'blocked user cannot report the blocker''s jar');
select tests.act_as('blocker');
select throws_ok($$select pg_temp.rep('jar', 'j_ev')$$, '42501', 'you can only report something you can see',
                 'blocker cannot report the blocked user''s jar');

-- ---------------------------------------------------------------- comments
select tests.act_as('owner');
select lives_ok($$select pg_temp.rep('comment', 'c1')$$, 'owner reports a reader''s comment on their jar');
select tests.act_as('reader');
select throws_ok($$select pg_temp.rep('comment', 'c1')$$, '22023', 'you cannot report your own content',
                 'reader cannot report their own comment');
select tests.act_as('outsider');
select throws_ok($$select pg_temp.rep('comment', 'c_hidden')$$, '42501', 'you can only report something you can see',
                 'outsider cannot report a comment still being checked');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.rep('comment', 'c1')$$, '42501', 'you can only report something you can see',
                 'blocked user cannot report a comment on the blocker''s jar');
select tests.act_as('blocker');
select throws_ok($$select pg_temp.rep('comment', 'c1')$$, '42501', 'you can only report something you can see',
                 'blocker cannot report a comment on the blocked user''s jar');

-- ---------------------------------------------------------------- profiles
select tests.act_as('owner');
select throws_ok($$select pg_temp.rep('profile', 'p_owner')$$, '22023', 'you cannot report your own content',
                 'owner cannot report themselves');
select throws_ok($$select pg_temp.rep('profile', 'p_blocked')$$, '42501', 'you can only report something you can see',
                 'owner cannot report someone they blocked (report before blocking)');
select tests.act_as('outsider');
select lives_ok($$select pg_temp.rep('profile', 'p_owner')$$, 'outsider reports a profile');
select tests.act_as('reader');
select lives_ok($$select pg_temp.rep('profile', 'p_owner')$$, 'reader reports the same profile');
select tests.act_as('blocked');
select throws_ok($$select pg_temp.rep('profile', 'p_owner')$$, '42501', 'you can only report something you can see',
                 'blocked user cannot report the blocker''s profile');
select tests.act_as('blocker');
select throws_ok($$select pg_temp.rep('profile', 'p_owner')$$, '42501', 'you can only report something you can see',
                 'blocker cannot report the blocked user''s profile');

-- ---------------------------------------------------------------- direct inserts and repeats
select tests.act_as('outsider');
select throws_ok($$insert into public.reports (reporter_id, target, target_id, reason)
                   values (tests.id('r3'), 'moment', (select id from t where k = 'm2'), 'spam')$$,
                 '42501', null, 'a client cannot report in someone else''s name');
select lives_ok($$insert into public.reports (reporter_id, target, target_id, reason, status, created_at)
                  values (tests.id('outsider'), 'moment', (select id from t where k = 'm2'), 'hate',
                          'closed', now() - interval '3 days')$$,
                'a plain insert under RLS works too');
select throws_ok($$insert into public.reports (reporter_id, target, target_id, reason)
                   values (tests.id('outsider'), 'moment', (select id from t where k = 'm2'), 'spam')$$,
                 '23505', null, 'a second plain insert for the same target is refused (one per reporter)');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'a repeat submit_report is a no-op');
select tests.reset_role();
select is(pg_temp.reports_on('m1'), 1::bigint, 'the repeat did not add a report');
select is((select status || '/' || (created_at = now())::text from public.reports
           where target_id = (select id from t where k = 'm2')),
          'open/true', 'clients cannot set a report''s status or created_at');
select is((select note from public.reports where target_id = (select id from t where k = 'm1')), 'a note',
          'the note is recorded');

-- ---------------------------------------------------------------- moderation items
select is((select count(*) from public.moderation_items
           where moment_id = (select id from t where k = 'm1') and source = 'report' and status = 'pending'),
          1::bigint, 'a report on a moment opens a pending report item');
select is((select mi.report_id from public.moderation_items mi where mi.moment_id = (select id from t where k = 'm1')),
          (select r.id from public.reports r where r.target_id = (select id from t where k = 'm1')),
          'the item''s report_id is the report that opened it');
select is((select mi.id from public.moderation_items mi where mi.moment_id = (select id from t where k = 'm1')),
          (select r.moderation_item_id from public.reports r where r.target_id = (select id from t where k = 'm1')),
          'the report links to its item');
select is((select count(*) from public.moderation_items
           where jar_id = (select id from t where k = 'j_rd') and source = 'report'),
          1::bigint, 'a jar report opens an item with jar_id');
select is((select count(*) from public.moderation_items
           where comment_id = (select id from t where k = 'c1') and source = 'report'),
          1::bigint, 'a comment report opens an item with comment_id');
select is((select count(*) from public.moderation_items where profile_id = tests.id('owner') and source = 'report'),
          1::bigint, 'two reports on one profile share one item with profile_id');
select is((select count(distinct moderation_item_id) || '/' || count(*) from public.reports
           where target = 'profile' and target_id = tests.id('owner')),
          '1/2', 'both profile reports link to that item');
select is((select num_nonnulls(moment_id, comment_id, jar_id, profile_id)::text || (report_id is not null)::text
           from public.moderation_items where profile_id = tests.id('owner')),
          '1true', 'a report item has exactly one target');

-- ---------------------------------------------------------------- three reports hide a moment
select tests.act_as('reader');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'reader reports m1 (second reporter)');
select tests.reset_role();
select ok(not pg_temp.hidden('m1'), 'two reports do not hide a moment');
select tests.act_as('reader');
select is(pg_temp.sees('m1'), 1::bigint, 'reader still sees a moment with two reports');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'j_ev')), 3,
          'visible_count counts it with two reports');
select tests.act_as('r3');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'r3 reports m1 (third reporter)');
select tests.reset_role();
select ok(pg_temp.hidden('m1'), 'three reporters within 24 hours hide the moment');
select is((select count(*) from public.moderation_items where moment_id = (select id from t where k = 'm1')),
          1::bigint, 'all three reports share one open item');
select is((select status::text from public.moments where id = (select id from t where k = 'm1')), 'live',
          'hiding does not touch status (0011: only pickld_moderation sets live/removed)');

-- Reports older than 24 hours don't count (server code may record them with their original time).
insert into public.reports (reporter_id, target, target_id, reason, created_at) values
  (tests.id('r4'), 'moment', (select id from t where k = 'm3'), 'spam', now() - interval '25 hours'),
  (tests.id('r5'), 'moment', (select id from t where k = 'm3'), 'spam', now() - interval '30 hours');
select tests.act_as('reader');
select lives_ok($$select pg_temp.rep('moment', 'm3')$$, 'reader reports m3');
select tests.act_as('outsider');
select lives_ok($$select pg_temp.rep('moment', 'm3')$$, 'outsider reports m3');
select tests.reset_role();
select is(pg_temp.reports_on('m3'), 4::bigint, 'm3 has four reports');
select ok(not pg_temp.hidden('m3'), 'only two of them within 24 hours: m3 stays visible');

-- ---------------------------------------------------------------- where the hidden moment disappears
select tests.act_as('owner');
select is(pg_temp.sees('m1'), 1::bigint, 'owner still sees their hidden moment');
select ok((select hidden_at is not null from public.moments where id = (select id from t where k = 'm1')),
          'owner can read hidden_at (under review)');
select is(pg_temp.paths('m1'), 1::bigint, 'owner still gets its photo paths');
select throws_ok($$update public.moments set hidden_at = null where id = (select id from t where k = 'm1')$$,
                 '42501', 'hidden_at is set by the server', 'owner cannot unhide it');
select throws_ok($$update public.moments set hidden_at = now() where id = (select id from t where k = 'm2')$$,
                 '42501', 'hidden_at is set by the server', 'owner cannot set hidden_at either');

select tests.act_as('reader');
select is(pg_temp.sees('m1'), 0::bigint, 'reader cannot read the hidden moment');
select is(pg_temp.paths('m1'), 0::bigint, 'reader gets no photo paths for it');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'j_ev')), 2,
          'visible_count leaves it out');
select is((select visible_count || '/' || ((select id from t where k = 'm1') = any (preview_moment_ids))::text
           from public.feed_page() where jar_id = (select id from t where k = 'j_ev')),
          '2/false', 'feed_page leaves it out of the count and the previews');
select is(pg_temp.sees('m2'), 1::bigint, 'reader still sees the jar''s other moments');
select throws_ok($$insert into public.reactions (user_id, target, target_id)
                   values (tests.id('reader'), 'moment', (select id from t where k = 'm1'))$$,
                 '42501', null, 'reader cannot like the hidden moment');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'a repeat report on a now hidden moment is still a no-op');

select tests.act_as('outsider');
select is(pg_temp.sees('m1'), 0::bigint, 'outsider cannot read the hidden moment');
select is(pg_temp.paths('m1'), 0::bigint, 'outsider gets no photo paths for it');

select tests.act_as('r4');
select throws_ok($$select pg_temp.rep('moment', 'm1')$$, '42501', 'you can only report something you can see',
                 'a new reporter cannot report a moment that is already hidden');

select tests.act_as('moderator');
select is(pg_temp.paths('m1'), 1::bigint, 'a moderator gets the photo paths of the queued moment');

-- ---------------------------------------------------------------- nobody but moderators reads reports
select tests.act_as('owner');
select is((select count(*) from public.reports), 0::bigint, 'owner (the reported user) reads no reports');
select is((select count(*) from public.moderation_items), 0::bigint, 'owner reads no moderation items');
select throws_ok($$update public.reports set status = 'closed'$$, '42501', null, 'owner cannot update reports');
select throws_ok($$delete from public.reports$$, '42501', null, 'owner cannot delete reports');
select tests.act_as('reader');
select is((select count(*) from public.reports), 0::bigint, 'reader cannot read even their own reports');
select tests.act_as('outsider');
select is((select count(*) from public.reports), 0::bigint, 'outsider reads no reports');
select tests.act_as('blocked');
select is((select count(*) from public.reports), 0::bigint, 'blocked user reads no reports');
select tests.act_as('blocker');
select is((select count(*) from public.reports) + (select count(*) from public.moderation_items), 0::bigint,
          'blocker reads no reports or moderation items');
select tests.act_as_anon();
select throws_ok($$select count(*) from public.reports$$, '42501', null, 'anon cannot read reports');
select tests.reset_role();
select is((select count(*) from public.notifications where user_id = tests.id('owner')), (select c from n0),
          'reporting sends the owner no notification');
select tests.act_as('moderator');
select ok((select count(*) from public.reports) >= 10, 'a moderator reads reports');

-- ---------------------------------------------------------------- a moderator keeps it
select lives_ok($$update public.moderation_items set status = 'kept', decided_at = now()
                  where moment_id = (select id from t where k = 'm1') and source = 'report'$$,
                'a moderator keeps the moment');
select tests.reset_role();
select ok(not pg_temp.hidden('m1'), 'kept: the moment is no longer hidden');
select tests.act_as('reader');
select is(pg_temp.sees('m1'), 1::bigint, 'reader sees it again');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'j_ev')), 3,
          'visible_count counts it again');
select tests.act_as('r4');
select lives_ok($$select pg_temp.rep('moment', 'm1')$$, 'a new report after the decision');
select tests.reset_role();
select is((select count(*) || '/' || count(*) filter (where status = 'pending') from public.moderation_items
           where moment_id = (select id from t where k = 'm1')),
          '2/1', 'it opens a fresh item');
select ok(not pg_temp.hidden('m1'), 'and the 24-hour count starts over, so one new report does not hide it');

select * from finish();
rollback;
