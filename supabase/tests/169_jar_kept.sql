-- 0169: Keep to myself. Only the owner marks their unpublished jar kept (server clock) or clears it; a reader, an
-- outsider and a blocked user can't; a client insert never carries it; publishing clears it, so no published jar
-- (the only kind others read) shows it; owners still can't change server-owned columns.
begin;
\ir _helpers.psql
select plan(14);

select tests.world();
create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', p_days_ago => 2));

create function pg_temp.kept() returns timestamptz language sql as $$
  select kept_at from public.jars where id = (select id from t where k = 'jar')
$$;

select has_column('public', 'jars', 'kept_at', 'jars.kept_at exists');
select is(pg_temp.kept(), null, 'a jar starts not kept');

-- ---------------------------------------------------------------- others can't
select tests.act_as('reader');
update public.jars set kept_at = now() where id = (select id from t where k = 'jar');
select tests.act_as('outsider');
update public.jars set kept_at = now() where id = (select id from t where k = 'jar');
select tests.act_as('blocked');
update public.jars set kept_at = now() where id = (select id from t where k = 'jar');
select tests.reset_role();
select is(pg_temp.kept(), null, 'a reader, an outsider and a blocked user can''t keep someone else''s jar');

-- ---------------------------------------------------------------- the owner keeps it
select tests.act_as('owner');
select lives_ok($$update public.jars set kept_at = '2001-01-01' where id = (select id from t where k = 'jar')$$,
                'the owner keeps their jar');
select tests.reset_role();
select ok(pg_temp.kept() > now() - interval '1 minute', 'kept_at is the server clock, not the phone''s');

select tests.act_as('owner');
select is((select count(*)::int from public.jars where id = (select id from t where k = 'jar') and kept_at is not null), 1,
          'the owner reads kept_at');
select lives_ok($$update public.jars set kept_at = null where id = (select id from t where k = 'jar')$$,
                'the owner un-keeps it');
select tests.reset_role();
select is(pg_temp.kept(), null, 'cleared');

select tests.act_as('owner');
select throws_ok($$update public.jars set kept_at = now(), moment_count = 8 where id = (select id from t where k = 'jar')$$,
                 '42501', null, 'keeping doesn''t open server-owned columns');
select tests.reset_role();

-- ---------------------------------------------------------------- insert
select tests.act_as('owner');
select lives_ok($$insert into public.jars (user_id, local_date, tz, kept_at)
                  values (auth.uid(), (now() at time zone 'Asia/Manila')::date - 5, 'Asia/Manila', now())$$,
                'the owner inserts a jar');
select tests.reset_role();
select is((select kept_at from public.jars where user_id = tests.id('owner')
           and local_date = (now() at time zone 'Asia/Manila')::date - 5), null,
          'a client insert never carries kept_at');

-- ---------------------------------------------------------------- publishing clears it
select tests.act_as('owner');
update public.jars set kept_at = now() where id = (select id from t where k = 'jar');
select lives_ok($$update public.jars set published_at = now() where id = (select id from t where k = 'jar')$$,
                'a kept jar can still be published');
select tests.reset_role();
select is(pg_temp.kept(), null, 'publishing clears kept_at');

select tests.act_as('owner');
update public.jars set kept_at = now() where id = (select id from t where k = 'jar');
select tests.act_as('reader');
select is((select count(*)::int from public.jars where id = (select id from t where k = 'jar') and kept_at is null), 1,
          'a reader of the published jar never sees it marked kept');
select tests.reset_role();

select * from finish();
rollback;
