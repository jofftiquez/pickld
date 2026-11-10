-- FR-PUB-02: nobody but the owner sees a jar or its moments before it is published.
begin;
\ir _helpers.psql
select plan(25);

select tests.world();

-- An unpublished jar of every visibility, each with a live, a private and a checking moment.
create temp table t_jars as
select v as visibility, tests.make_jar('owner', v, published => false, p_days_ago => n) as id
from (values ('everyone'::jar_visibility, 0), ('readers', 1), ('only_me', 2)) as x(v, n);
select tests.make_moment(id, 'morning', 'live') from t_jars;
select tests.make_moment(id, 'evening', 'live', p_private => true) from t_jars;
select tests.make_moment(id, 'afternoon', 'checking') from t_jars;
-- Control: a published Everyone jar that signed-in non-blocked users should see.
create temp table t_control as select tests.make_jar('owner', 'everyone', published => true, p_days_ago => 3) as id;
select tests.make_moment(id, 'morning', 'live') from t_control;
grant select on t_jars, t_control to authenticated, anon;

-- owner sees all three unpublished jars and all nine moments
select tests.act_as('owner');
select is((select count(*) from public.jars where id in (select id from t_jars)), 3::bigint, 'owner sees own unpublished jars');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 9::bigint, 'owner sees every moment in them');

-- everyone else sees none of them
select tests.act_as('reader');
select is((select count(*) from public.jars where id in (select id from t_jars)), 0::bigint, 'reader cannot see unpublished jars');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 0::bigint, 'reader cannot see their moments');
select is((select count(*) from public.jars where id in (select id from t_control)), 1::bigint, 'control: reader sees the published Everyone jar');
select is((select count(*) from public.moments where jar_id in (select id from t_control)), 1::bigint, 'control: reader sees its live moment');

select tests.act_as('outsider');
select is((select count(*) from public.jars where id in (select id from t_jars)), 0::bigint, 'outsider cannot see unpublished jars');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 0::bigint, 'outsider cannot see their moments');
select is((select count(*) from public.jars where id in (select id from t_control)), 1::bigint, 'control: outsider sees the published Everyone jar');

select tests.act_as('blocked');
select is((select count(*) from public.jars where id in (select id from t_jars)), 0::bigint, 'blocked user cannot see unpublished jars');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 0::bigint, 'blocked user cannot see their moments');
select is((select count(*) from public.jars where id in (select id from t_control)), 0::bigint, 'blocked user cannot see the published jar either');

select tests.act_as('blocker');
select is((select count(*) from public.jars where id in (select id from t_jars)), 0::bigint, 'blocker cannot see unpublished jars');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 0::bigint, 'blocker cannot see their moments');
select is((select count(*) from public.jars where id in (select id from t_control)), 0::bigint, 'blocker cannot see the published jar either');

select tests.act_as('moderator');
select is((select count(*) from public.jars where id in (select id from t_jars)), 0::bigint, 'moderator cannot see unpublished jars through RLS');
select is((select count(*) from public.moments where jar_id in (select id from t_jars)), 0::bigint, 'moderator cannot see their moments through RLS');

select tests.act_as_anon();
select throws_ok($$select count(*) from public.jars$$, '42501', null, 'anon has no access to the jars table (since 0006)');
select throws_ok($$select count(*) from public.moments$$, '42501', null, 'anon has no access to the moments table (since 0004)');

-- Writes by others are refused too: updates touch zero rows, inserts into the jar fail.
select tests.act_as('reader');
update public.jars set published_at = now() where id in (select id from t_jars);
select tests.act_as('owner');
select is((select count(*) from public.jars where id in (select id from t_jars) and published_at is not null), 0::bigint,
          'reader cannot publish someone else''s jar');
select tests.act_as('outsider');
select throws_ok(
  format('insert into public.moments (jar_id, user_id, slot) values (%L, %L, ''selfie'')', (select id from t_jars where visibility = 'everyone'), tests.id('outsider')),
  'moment owner must match jar owner',
  'outsider cannot add a moment to the jar');
select throws_ok(
  format('insert into public.moments (jar_id, user_id, slot) values (%L, %L, ''selfie'')', (select id from t_jars where visibility = 'everyone'), tests.id('owner')),
  '42501', null,
  'outsider cannot add a moment in the owner''s name');

-- Publishing flips visibility for readers only (Readers jar), proving the rule is about published_at.
select tests.act_as('owner');
update public.jars set published_at = now() where id = (select id from t_jars where visibility = 'readers');
select tests.act_as('reader');
select is((select count(*) from public.moments where jar_id = (select id from t_jars where visibility = 'readers')), 1::bigint,
          'after publishing, reader sees only the live, non-private moment');
select tests.act_as('outsider');
select is((select count(*) from public.jars where id = (select id from t_jars where visibility = 'readers')), 0::bigint,
          'after publishing, a Readers jar is still hidden from outsiders');
select tests.act_as('owner');
update public.jars set published_at = now() where id = (select id from t_jars where visibility = 'only_me');
select tests.act_as('reader');
select is((select count(*) from public.jars where id = (select id from t_jars where visibility = 'only_me')), 0::bigint,
          'a published Only me jar stays hidden from readers');

select * from finish();
rollback;
