-- M6-07 (0031): Explore search and suggestions. People search by name or @username, suggested authors from
-- friends of friends, Full jars today from Everyone jars; never the caller, an inactive account or anyone
-- blocked either way, and a private moment never makes a jar look full (FR-EXP-01, FR-EXP-02).
begin;
\ir _helpers.psql
select plan(22);

select tests.world();
-- Extra people: three the reader's authors read, one suspended, and one with a private eighth moment.
select tests.create_user('maria');
select tests.create_user('marco');
select tests.create_user('suspended_mar');
select tests.create_user('privy');
update public.profiles set display_name = 'Maria Santos' where id = tests.id('maria');
update public.profiles set display_name = 'Marco Reyes' where id = tests.id('marco');
update public.profiles set status = 'suspended' where id = tests.id('suspended_mar');
-- The reader reads owner and outsider; owner reads maria and marco; outsider reads maria.
insert into public.follows (reader_id, author_id) values
  (tests.id('reader'), tests.id('outsider')),
  (tests.id('owner'), tests.id('maria')),
  (tests.id('owner'), tests.id('marco')),
  (tests.id('outsider'), tests.id('maria')),
  (tests.id('owner'), tests.id('suspended_mar'));

create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
create function pg_temp.full_jar(p_owner text, p_vis jar_visibility, p_private_last boolean default false,
                                 p_days_ago int default 0, p_published boolean default true)
returns uuid language plpgsql as $$
declare jid uuid := tests.make_jar(p_owner, p_vis, published => p_published, p_days_ago => p_days_ago); s slot;
begin
  foreach s in array enum_range(null::slot) loop
    perform tests.make_moment(jid, s, 'live', p_private => (p_private_last and s = 'evening'));
  end loop;
  return jid;
end $$;
insert into t values ('maria_full', pg_temp.full_jar('maria', 'everyone'));
insert into t values ('marco_readers', pg_temp.full_jar('marco', 'readers'));
insert into t values ('privy_private', pg_temp.full_jar('privy', 'everyone', p_private_last => true));
insert into t values ('owner_full', pg_temp.full_jar('owner', 'everyone'));
insert into t values ('maria_yesterday', pg_temp.full_jar('maria', 'everyone', p_days_ago => 2));
insert into t values ('outsider_draft', pg_temp.full_jar('outsider', 'everyone', p_published => false));
insert into t values ('blocked_full', pg_temp.full_jar('blocked', 'everyone'));

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.search_people(text, int)', 'execute'), 'anon cannot search');
select ok(not has_function_privilege('anon', 'public.suggested_authors(int)', 'execute'), 'anon gets no suggestions');
select ok(not has_function_privilege('anon', 'public.full_jars_today(int)', 'execute'), 'anon gets no full jars');
select tests.act_as_anon();
select throws_ok($$select * from public.search_people('mar')$$, '42501', null, 'anon is refused');

-- ---------------------------------------------------------------- search
select tests.act_as('reader');
select is((select array_agg(username order by username) from public.search_people('mar') where username like 't\_%'),
          array['t_marco', 't_maria'], 'matches by name, never a suspended account');
select is((select array_agg(username) from public.search_people('@t_maria')), array['t_maria'],
          'a leading @ searches by username');
select is((select username from public.search_people('t_mar') limit 1), 't_marco',
          'username prefix matches come first, ties by username');
select is((select array_agg(username) from public.search_people('santos') where username like 't\_%'), array['t_maria'],
          'matches by surname');
select is((select array_agg(username) from public.search_people('mraia') where username like 't\_%'), null::text[],
          'a jumbled query that shares no trigram run matches nothing');
select is((select count(*)::int from public.search_people('m')), 0, 'one letter returns nothing');
select is((select count(*)::int from public.search_people('reader')), 0, 'never the caller');
select is((select is_reading from public.search_people('t_owner')), true, 'says whether the caller reads them');

select tests.act_as('owner');
select is((select count(*)::int from public.search_people('blocke')), 0, 'blocked either way never appears');

-- ---------------------------------------------------------------- suggestions
select tests.act_as('reader');
select results_eq($$select username, mutual_count from public.suggested_authors()$$,
                  $$values ('t_maria', 2), ('t_marco', 1)$$,
                  'friends of friends, most mutual first; not already read, not suspended, not blocked');
select tests.act_as('maria');
select is((select count(*)::int from public.suggested_authors()), 0, 'someone who reads nobody gets no suggestions');
select tests.act_as('blocked');
select is((select count(*)::int from public.suggested_authors() where id in (tests.id('maria'), tests.id('marco'))), 0,
          'nothing comes through an author who blocked the caller');

-- ---------------------------------------------------------------- Full jars today
select tests.act_as('reader');
select is((select array_agg(jar_id order by jar_id) from public.full_jars_today() where jar_id in (select id from t)),
          (select array_agg(id order by id) from t where k in ('owner_full', 'maria_full', 'blocked_full')),
          'open, published Everyone jars with eight visible moments (not Readers, a draft, yesterday or a private eighth)');
select is((select cover_slot::text from public.full_jars_today() where jar_id = (select id from t where k = 'maria_full')),
          'whereami', 'the cover is the first slot');
select is((select count(*)::int from public.full_jars_today() where jar_id = (select id from t where k = 'privy_private')), 0,
          'a jar with a private moment is not full to others');
select tests.act_as('owner');
select is((select count(*)::int from public.full_jars_today() where user_id = tests.id('owner')), 0, 'never the caller''s own jar');
select is((select count(*)::int from public.full_jars_today() where user_id = tests.id('blocked')), 0, 'never someone blocked');
select tests.act_as('blocker');
select is((select count(*)::int from public.full_jars_today() where user_id = tests.id('owner')), 0,
          'never someone the caller blocked');

select * from finish();
rollback;
