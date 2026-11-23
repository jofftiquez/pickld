-- 0175: a line for the day. Only the owner writes it; it reaches exactly whoever reads the jar: the owner always, a
-- reader once it is published, never an outsider of a readers jar or a blocked user; a reader of an unpublished jar
-- doesn't see it. The server trims it, stores blank as null, refuses more than 80 characters or a line break, and
-- writing it doesn't open server-owned columns.
begin;
\ir _helpers.psql
select plan(16);

select tests.world();
create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', p_days_ago => 1));

create function pg_temp.line() returns text language sql as $$
  select line from public.jars where id = (select id from t where k = 'jar')
$$;
-- The line as the current role sees it; null when the jar row isn't readable.
create function pg_temp.seen() returns text language sql as $$
  select coalesce((select coalesce(line, '<no line>') from public.jars where id = (select id from t where k = 'jar')), '<no jar>')
$$;
grant execute on function pg_temp.seen() to authenticated;

select has_column('public', 'jars', 'line', 'jars.line exists');
select is(pg_temp.line(), null, 'a jar starts without a line');

-- ---------------------------------------------------------------- only the owner writes it
select tests.act_as('reader');
update public.jars set line = 'not mine' where id = (select id from t where k = 'jar');
select tests.act_as('outsider');
update public.jars set line = 'not mine' where id = (select id from t where k = 'jar');
select tests.act_as('blocked');
update public.jars set line = 'not mine' where id = (select id from t where k = 'jar');
select tests.reset_role();
select is(pg_temp.line(), null, 'a reader, an outsider and a blocked user can''t write someone else''s line');

select tests.act_as('owner');
select lives_ok($$update public.jars set line = '  Moved into the new flat  ' where id = (select id from t where k = 'jar')$$,
                'the owner writes a line');
select tests.reset_role();
select is(pg_temp.line(), 'Moved into the new flat', 'the server trims it');

-- ---------------------------------------------------------------- unpublished: only the owner sees it
select tests.act_as('owner');
select is(pg_temp.seen(), 'Moved into the new flat', 'the owner reads the line of an unpublished jar');
select tests.act_as('reader');
select is(pg_temp.seen(), '<no jar>', 'a reader doesn''t see an unpublished jar''s line');
select tests.reset_role();

-- ---------------------------------------------------------------- published to readers
select tests.act_as('owner');
update public.jars set published_at = now() where id = (select id from t where k = 'jar');
select tests.act_as('reader');
select is(pg_temp.seen(), 'Moved into the new flat', 'a reader sees the line once the jar is published');
select tests.act_as('outsider');
select is(pg_temp.seen(), '<no jar>', 'an outsider doesn''t see a readers jar''s line');
select tests.act_as('blocked');
select is(pg_temp.seen(), '<no jar>', 'a blocked user doesn''t see the line');
select tests.reset_role();

-- ---------------------------------------------------------------- rules
select tests.act_as('owner');
select lives_ok($$update public.jars set line = '   ' where id = (select id from t where k = 'jar')$$,
                'a blank line clears it');
select tests.reset_role();
select is(pg_temp.line(), null, 'a blank line is stored as null');

select tests.act_as('owner');
select lives_ok($$update public.jars set line = repeat('a', 80) where id = (select id from t where k = 'jar')$$,
                '80 characters fit');
select throws_ok($$update public.jars set line = repeat('a', 81) where id = (select id from t where k = 'jar')$$,
                 '23514', null, 'more than 80 characters is refused');
select throws_ok($$update public.jars set line = E'one\ntwo' where id = (select id from t where k = 'jar')$$,
                 '23514', null, 'a line break is refused');
select throws_ok($$update public.jars set line = 'hi', like_count = 99 where id = (select id from t where k = 'jar')$$,
                 '42501', null, 'writing the line doesn''t open server-owned columns');
select tests.reset_role();

select * from finish();
rollback;
