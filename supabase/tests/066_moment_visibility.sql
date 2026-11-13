-- 0066 (QA round 1 item 7; D-48, D-49, D-50; FR-PUB-02, FR-PUB-05): each moment has its own visibility.
-- The column default comes from the owner's profile; is_private follows visibility and can't be written;
-- a replacement keeps the visibility of the moment it replaces; who sees a moment depends on its own
-- visibility, published jar or not, tried as owner, reader, outsider, blocked user, blocker and moderator;
-- visible_count (D-9); the shared web page (D-32) and Explore (D-18) show only Everyone moments; notify
-- reads the Only me rule from visibility.
begin;
\ir _helpers.psql
select plan(93);

select tests.world();
create temp table t (k text primary key, id uuid not null default gen_random_uuid());
grant select on t to authenticated, anon, service_role, pickld_moderation;

-- ---------------------------------------------------------------- schema
select col_not_null('public', 'moments', 'visibility', 'moments.visibility is not null');
select col_type_is('public', 'moments', 'visibility', 'jar_visibility', 'moments.visibility is a jar_visibility');
select col_default_is('public', 'moments', 'visibility', 'moment_default_visibility()',
                      'moments.visibility defaults to the owner''s default visibility');
select ok(has_column_privilege('authenticated', 'public.moments', 'visibility', 'select'), 'signed-in users may read visibility');
select ok(not has_function_privilege('anon', 'public.moment_default_visibility()', 'execute'),
          'anon cannot call moment_default_visibility');

-- ---------------------------------------------------------------- default from the profile
insert into t values ('jar_today', tests.make_jar('owner', 'readers', published => false));
insert into t (k) values ('d_everyone'), ('d_readers'), ('d_sent'), ('i_bad'), ('i_ok');
update public.profiles set default_visibility = 'everyone' where id = tests.id('owner');
select tests.act_as('owner');
insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path)
values ((select id from t where k = 'd_everyone'), (select id from t where k = 'jar_today'), tests.id('owner'), 'morning', 'p/a', 't/a');
insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, visibility)
values ((select id from t where k = 'd_sent'), (select id from t where k = 'jar_today'), tests.id('owner'), 'afternoon', 'p/b', 't/b', 'only_me');
select tests.reset_role();
update public.profiles set default_visibility = 'readers' where id = tests.id('owner');
select tests.act_as('owner');
insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path)
values ((select id from t where k = 'd_readers'), (select id from t where k = 'jar_today'), tests.id('owner'), 'evening', 'p/c', 't/c');
select is((select visibility::text from public.moments where id = (select id from t where k = 'd_everyone')), 'everyone',
          'a moment without a visibility starts at the owner''s default (Everyone)');
select is((select visibility::text from public.moments where id = (select id from t where k = 'd_readers')), 'readers',
          'a moment without a visibility starts at the owner''s default (Readers)');
select is((select visibility::text || '/' || is_private from public.moments where id = (select id from t where k = 'd_sent')),
          'only_me/true', 'a visibility the app sends wins, and is_private follows it');

-- ---------------------------------------------------------------- is_private follows visibility
select throws_ok(
  format('insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, visibility, is_private) values (%L, %L, %L, ''selfie'', ''p/d'', ''t/d'', ''readers'', true)',
         (select id from t where k = 'i_bad'), (select id from t where k = 'jar_today'), tests.id('owner')),
  '42501', null, 'an insert with is_private true but a visibility other than only_me is refused');
select lives_ok(
  format('insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, visibility, is_private) values (%L, %L, %L, ''selfie'', ''p/e'', ''t/e'', ''only_me'', true)',
         (select id from t where k = 'i_ok'), (select id from t where k = 'jar_today'), tests.id('owner')),
  'an insert with is_private true and visibility only_me is fine (old writers)');
select throws_ok(
  format('update public.moments set is_private = false where id = %L', (select id from t where k = 'd_sent')),
  '42501', null, 'the owner cannot write is_private directly');
select throws_ok(
  format('update public.moments set is_private = true, visibility = ''only_me'' where id = %L', (select id from t where k = 'd_readers')),
  '42501', null, 'not even together with visibility');
update public.moments set visibility = 'readers' where id = (select id from t where k = 'd_sent');
select is((select visibility::text || '/' || is_private from public.moments where id = (select id from t where k = 'd_sent')),
          'readers/false', 'changing visibility away from only_me clears is_private');
update public.moments set visibility = 'only_me' where id = (select id from t where k = 'd_everyone');
select is((select is_private from public.moments where id = (select id from t where k = 'd_everyone')), true,
          'changing visibility to only_me sets is_private');
select tests.reset_role();
select throws_ok(
  format('update public.moments set is_private = false where id = %L', (select id from t where k = 'd_everyone')),
  '42501', null, 'not even the superuser writes is_private directly');
select is((select count(*) from public.moments where is_private is distinct from (visibility = 'only_me')), 0::bigint,
          'is_private is exactly visibility = only_me on every row');

-- ---------------------------------------------------------------- who sees a moment
-- visibility × jar published or not, in a Readers jar each; plus a checking Everyone moment.
insert into t values ('jar_pub', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('jar_unpub', tests.make_jar('owner', 'readers', published => false, p_days_ago => 2));
create temp table mm (name text primary key, id uuid not null, sees text[] not null);
grant select on mm to authenticated, anon, service_role;
insert into mm values
  ('published readers',     tests.make_moment((select id from t where k = 'jar_pub'), 'morning', 'live', p_visibility => 'readers'),     '{owner,reader}'),
  ('published everyone',    tests.make_moment((select id from t where k = 'jar_pub'), 'afternoon', 'live', p_visibility => 'everyone'),  '{owner,reader,outsider,moderator}'),
  ('published only_me',     tests.make_moment((select id from t where k = 'jar_pub'), 'evening', 'live', p_visibility => 'only_me'),     '{owner}'),
  ('published checking',    tests.make_moment((select id from t where k = 'jar_pub'), 'selfie', 'checking', p_visibility => 'everyone'), '{owner}'),
  ('unpublished readers',   tests.make_moment((select id from t where k = 'jar_unpub'), 'morning', 'live', p_visibility => 'readers'),   '{owner,reader}'),
  ('unpublished everyone',  tests.make_moment((select id from t where k = 'jar_unpub'), 'afternoon', 'live', p_visibility => 'everyone'), '{owner,reader,outsider,moderator}'),
  ('unpublished only_me',   tests.make_moment((select id from t where k = 'jar_unpub'), 'evening', 'live', p_visibility => 'only_me'),   '{owner}'),
  ('unpublished checking',  tests.make_moment((select id from t where k = 'jar_unpub'), 'selfie', 'checking', p_visibility => 'everyone'), '{owner}');
create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5), ('moderator', 6);
grant select on roles to authenticated, anon, service_role;

create function pg_temp.sees(who text, mid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.moments where id = mid) into r;
  perform tests.reset_role();
  return r;
end $$;

-- 8 moments × 6 roles
select is(pg_temp.sees(r.role, x.id), r.role = any (x.sees),
          format('%s: %s %s', x.name, r.role, case when r.role = any (x.sees) then 'sees it' else 'does not see it' end))
from mm x cross join roles r order by x.name, r.ord;

-- the jar itself still waits for Publish jar
select tests.act_as('reader');
select is((select count(*) from public.jars where id = (select id from t where k = 'jar_unpub')), 0::bigint,
          'the reader sees the unpublished jar''s moments but not the jar');
-- A visibility change shows at once.
select tests.act_as('owner');
update public.moments set visibility = 'everyone' where id = (select id from mm where name = 'unpublished only_me');
select tests.act_as('outsider');
select is((select count(*) from public.moments where id = (select id from mm where name = 'unpublished only_me')), 1::bigint,
          'an Only me moment changed to Everyone shows to an outsider at once');
select tests.act_as('owner');
update public.moments set visibility = 'only_me' where id = (select id from mm where name = 'unpublished only_me');
select tests.act_as('outsider');
select is((select count(*) from public.moments where id = (select id from mm where name = 'unpublished only_me')), 0::bigint,
          'changed back to Only me, it is hidden again');
select tests.reset_role();
-- A suspended owner's moments are the owner's only (D-11).
update public.profiles set status = 'suspended' where id = tests.id('owner');
select is(pg_temp.sees('outsider', (select id from mm where name = 'unpublished everyone')), false,
          'a suspended owner''s Everyone moment is hidden');
update public.profiles set status = 'active' where id = tests.id('owner');
-- A hidden moment (a report under review) is hidden.
update public.moments set hidden_at = now() where id = (select id from mm where name = 'published everyone');
select is(pg_temp.sees('reader', (select id from mm where name = 'published everyone')), false, 'a hidden Everyone moment is hidden');
update public.moments set hidden_at = null where id = (select id from mm where name = 'published everyone');

-- ---------------------------------------------------------------- visible_count (D-9)
select is((select visible_count::int from public.jars where id = (select id from t where k = 'jar_pub')), 2,
          'visible_count counts live moments that aren''t Only me');
select tests.act_as('owner');
update public.moments set visibility = 'only_me' where id = (select id from mm where name = 'published everyone');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'jar_pub')), 1,
          'making a moment Only me lowers visible_count');
update public.moments set visibility = 'everyone' where id = (select id from mm where name = 'published everyone');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'jar_pub')), 2,
          'making it Everyone again raises visible_count');
update public.moments set visibility = 'readers' where id = (select id from mm where name = 'published everyone');
select is((select visible_count::int from public.jars where id = (select id from t where k = 'jar_pub')), 2,
          'moving between Readers and Everyone keeps visible_count');
update public.moments set visibility = 'everyone' where id = (select id from mm where name = 'published everyone');
select tests.reset_role();

-- ---------------------------------------------------------------- a replacement keeps visibility (0013)
insert into t (k) values ('rep');
select tests.act_as('owner');
insert into public.moments (id, jar_id, user_id, slot, photo_path, thumb_path, status, replaces, visibility)
values ((select id from t where k = 'rep'), (select id from t where k = 'jar_pub'), tests.id('owner'), 'morning',
        'p/rep', 't/rep', 'checking', (select id from mm where name = 'published readers'), 'everyone');
select is((select visibility::text from public.moments where id = (select id from t where k = 'rep')), 'readers',
          'a replacement takes the visibility of the moment it replaces');
update public.moments set visibility = 'only_me' where id = (select id from mm where name = 'published readers');
select is((select visibility::text || '/' || is_private from public.moments where id = (select id from t where k = 'rep')),
          'only_me/true', 'a visibility change on the original follows to its replacement');
update public.moments set visibility = 'everyone' where id = (select id from t where k = 'rep');
select is((select visibility::text from public.moments where id = (select id from mm where name = 'published readers')), 'everyone',
          'a visibility change on the replacement follows to the original');
update public.moments set visibility = 'readers' where id = (select id from t where k = 'rep');
select tests.reset_role();
select public.moderation_apply((select id from t where k = 'rep'),
                               (select pending_since from public.moments where id = (select id from t where k = 'rep')),
                               'approve', 'test', '{}'::jsonb, 'test reason');
select is((select visibility::text from public.moments where id = (select id from t where k = 'rep')), 'readers',
          'the approved replacement goes live with the same visibility');
select is(pg_temp.sees('outsider', (select id from t where k = 'rep')), false, 'so it never goes live wider than the original');

-- ---------------------------------------------------------------- shared web page (D-32)
insert into t values ('w_everyone', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 3));
insert into t values ('w_readers', tests.make_jar('owner', 'readers', published => true, p_days_ago => 4));
insert into t values ('w_onlyreaders', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 5));
insert into t values ('w_unpub', tests.make_jar('owner', 'everyone', published => false, p_days_ago => 6));
insert into t values ('we_e', tests.make_moment((select id from t where k = 'w_everyone'), 'morning', 'live', p_visibility => 'everyone'));
insert into t values ('we_r', tests.make_moment((select id from t where k = 'w_everyone'), 'afternoon', 'live', p_visibility => 'readers'));
insert into t values ('we_o', tests.make_moment((select id from t where k = 'w_everyone'), 'evening', 'live', p_visibility => 'only_me'));
insert into t values ('wr_e', tests.make_moment((select id from t where k = 'w_readers'), 'morning', 'live', p_visibility => 'everyone'));
insert into t values ('wr_r', tests.make_moment((select id from t where k = 'w_readers'), 'afternoon', 'live', p_visibility => 'readers'));
insert into t values ('wo_r', tests.make_moment((select id from t where k = 'w_onlyreaders'), 'morning', 'live', p_visibility => 'readers'));
insert into t values ('wu_e', tests.make_moment((select id from t where k = 'w_unpub'), 'morning', 'live', p_visibility => 'everyone'));
select tests.act_as_anon();
select is((select array(select x->>'id' from jsonb_array_elements(public.public_jar((select id from t where k = 'w_everyone'))->'moments') x)),
          array[(select id::text from t where k = 'we_e')], 'public_jar shows only the Everyone moments of an Everyone jar');
select is((public.public_jar((select id from t where k = 'w_everyone'))->>'visible_count')::int, 1,
          'its visible_count counts only those');
select is((public.public_jar((select id from t where k = 'w_readers'))) ? 'moments', false,
          'a Readers jar is a teaser without moments, even with an Everyone moment in it');
select is((public.public_jar((select id from t where k = 'w_readers'))->>'visible_count')::int, 2,
          'the teaser keeps the jar''s visible_count');
select is((public.public_jar((select id from t where k = 'w_onlyreaders'))->'moments'), '[]'::jsonb,
          'an Everyone jar holding only Readers moments shows none of them');
select is(public.public_jar((select id from t where k = 'w_unpub')), null, 'an unpublished jar is not on the web, even with an Everyone moment');
select is((select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(public.public_profile('t_owner')->'jars') x),
          array[(select id::text from t where k = 'w_everyone')],
          'public_profile lists only Everyone jars with an Everyone moment');
select is((select array(select m->>'id' from jsonb_array_elements(public.public_profile('t_owner')->'jars') j,
                                            jsonb_array_elements(j->'moments') m)),
          array[(select id::text from t where k = 'we_e')], 'and only their Everyone moments');
select is((select (j->>'visible_count')::int from jsonb_array_elements(public.public_profile('t_owner')->'jars') j), 1,
          'with their Everyone count');
select tests.reset_role();

-- ---------------------------------------------------------------- Explore (D-18)
create function pg_temp.full_jar(p_owner text, p_readers_slot slot default null) returns uuid language plpgsql as $$
declare jid uuid := tests.make_jar(p_owner, 'everyone', published => true); s slot;
begin
  foreach s in array enum_range(null::slot) loop
    perform tests.make_moment(jid, s, 'live',
      p_visibility => case when s = p_readers_slot then 'readers'::jar_visibility else 'everyone' end);
  end loop;
  return jid;
end $$;
select tests.create_user('fuller');
select tests.create_user('mixer');
select tests.create_user('coverless');
insert into t values ('x_full', pg_temp.full_jar('fuller'));
insert into t values ('x_mixed', pg_temp.full_jar('mixer', 'evening'));
insert into t values ('x_cover', pg_temp.full_jar('coverless', 'whereami'));
select tests.act_as('outsider');
select is((select count(*) from public.full_jars_today() where jar_id = (select id from t where k = 'x_full')), 1::bigint,
          'Explore lists an Everyone jar with 8 live Everyone moments');
select is((select count(*) from public.full_jars_today() where jar_id = (select id from t where k = 'x_mixed')), 0::bigint,
          'a Readers moment keeps a jar out of Full jars today');
select is((select count(*) from public.full_jars_today() where jar_id = (select id from t where k = 'x_cover')), 0::bigint,
          'whichever slot holds it');
select is((select cover_slot::text from public.full_jars_today() where jar_id = (select id from t where k = 'x_full')),
          (select min(slot)::text from public.moments where jar_id = (select id from t where k = 'x_full')),
          'the cover is the first Everyone moment');
select tests.reset_role();

-- ---------------------------------------------------------------- notify (0019)
select public.notify(tests.id('owner'), 'like', tests.id('reader'), null, (select id from mm where name = 'published only_me'));
select public.notify(tests.id('owner'), 'like', tests.id('reader'), null, (select id from mm where name = 'published everyone'));
select is((select count(*) from public.notifications where user_id = tests.id('owner') and type = 'like'
             and moment_id = (select id from mm where name = 'published only_me')), 0::bigint,
          'no like notification for an Only me moment');
select is((select count(*) from public.notifications where user_id = tests.id('owner') and type = 'like'
             and moment_id = (select id from mm where name = 'published everyone')), 1::bigint,
          'a like notification for an Everyone moment');

select * from finish();
rollback;
