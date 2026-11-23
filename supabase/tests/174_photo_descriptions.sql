-- 0174: Photo descriptions. The description (`alt` in edits) reaches whoever can see the moment and no one else
-- (tried as owner, reader, outsider, blocked and anon through the shared web page); a change to a live moment's
-- description waits in pending_edits for the check, like a caption; the database refuses anything but a
-- non-empty string of at most 250 characters.
begin;
\ir _helpers.psql
select plan(12);

select tests.world();
create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));
insert into t values ('pub', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 1));

create function pg_temp.edits(p_alt jsonb) returns jsonb language sql as $$
  select jsonb_build_object('v', 1, 'filter', 'original', 'overlays', '[]'::jsonb, 'alt', p_alt)
$$;
create function pg_temp.seen_alt() returns text language sql as $$
  select coalesce(string_agg(edits ->> 'alt', ','), '(none)') from public.moments
  where jar_id = (select id from t where k = 'jar')
$$;

select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, status, edits)
values ((select id from t where k = 'jar'), auth.uid(), 'morning', 'p/x', 't/x', 'checking',
        pg_temp.edits('"A red bicycle against a yellow wall"'));
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, status, visibility, edits)
values ((select id from t where k = 'pub'), auth.uid(), 'evening', 'p/y', 't/y', 'checking', 'everyone',
        pg_temp.edits('"Sunset over the bay"'));
select tests.reset_role();
insert into t select 'm', id from public.moments where jar_id = (select id from t where k = 'jar');
insert into t select 'pm', id from public.moments where jar_id = (select id from t where k = 'pub');
select tests.set_status((select id from t where k = 'm'), 'live');
select tests.set_status((select id from t where k = 'pm'), 'live');

-- ---------------------------------------------------------------- who hears it
select tests.act_as('owner');
select is(pg_temp.seen_alt(), 'A red bicycle against a yellow wall', 'the owner reads their description');
select tests.act_as('reader');
select is(pg_temp.seen_alt(), 'A red bicycle against a yellow wall', 'a reader reads the description');
select tests.act_as('outsider');
select is(pg_temp.seen_alt(), '(none)', 'an outsider gets nothing from a Readers jar');
select tests.act_as('blocked');
select is(pg_temp.seen_alt(), '(none)', 'a blocked user gets nothing');
select tests.act_as_anon();
select is(public.public_jar((select id from t where k = 'pub')) -> 'moments' -> 0 -> 'edits' ->> 'alt',
          'Sunset over the bay', 'the shared web page carries an Everyone moment''s description');
select is(public.public_jar((select id from t where k = 'jar')) -> 'moments', null,
          'a Readers jar''s web page has no moments, so no description');

-- ---------------------------------------------------------------- a change waits for the check
select tests.act_as('owner');
update public.moments set edits = pg_temp.edits('"Something rude"') where id = (select id from t where k = 'm');
select tests.act_as('reader');
select is(pg_temp.seen_alt(), 'A red bicycle against a yellow wall', 'readers keep hearing the checked description');
select tests.reset_role();
select is((select pending_edits ->> 'alt' from public.moments where id = (select id from t where k = 'm')),
          'Something rude', 'the new description waits in pending_edits');

-- ---------------------------------------------------------------- what the database refuses
select tests.act_as('owner');
select throws_ok(
  format('update public.moments set edits = %L where id = %L',
         pg_temp.edits(to_jsonb(repeat('a', 251))), (select id from t where k = 'pm')),
  '23514', null, 'a description over 250 characters is refused');
select throws_ok(
  format('update public.moments set edits = %L where id = %L', pg_temp.edits('""'), (select id from t where k = 'pm')),
  '23514', null, 'an empty description is refused');
select throws_ok(
  format('update public.moments set edits = %L where id = %L', pg_temp.edits('42'), (select id from t where k = 'pm')),
  '23514', null, 'a description that is not text is refused');
select lives_ok(
  format('update public.moments set edits = %L where id = %L',
         pg_temp.edits(to_jsonb(repeat('a', 250))), (select id from t where k = 'pm')),
  '250 characters are allowed');

select * from finish();
rollback;
