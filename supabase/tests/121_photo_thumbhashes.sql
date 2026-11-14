-- 0121: ThumbHash placeholders keyed by thumbnail key (NFR-PERF-02). Only the service role (fn:upload-url,
-- fn:photo-urls) reads or writes them: owner, reader, outsider, blocked, a moderator and anon are refused both,
-- so a private moment's preview can't be read straight from the table. A row must sit under its owner's folder,
-- the hash must look like base64, and deleting the account removes the rows.
begin;
\ir _helpers.psql
select plan(20);

select tests.world();
create temp table k (name text primary key, path text);
grant select on k to authenticated, anon, service_role;
insert into k values ('own', 'moments/' || tests.id('owner') || '/' || gen_random_uuid() || '/thumb.webp');

-- ---------------------------------------------------------------- the table
select has_table('public', 'photo_thumbhashes', 'photo_thumbhashes exists');
select ok((select relrowsecurity from pg_class where oid = 'public.photo_thumbhashes'::regclass), 'RLS is on');
select col_is_pk('public', 'photo_thumbhashes', 'thumb_path', 'one hash per thumbnail key');

-- ---------------------------------------------------------------- service role writes and reads
select tests.act_as_service();
select lives_ok($$ insert into public.photo_thumbhashes (thumb_path, user_id, thumbhash)
                   values ((select path from k where name = 'own'), tests.id('owner'), '3OcRJYB4d3h/iIeHeEh3eIhw+j2w') $$,
  'the service role stores a hash');
select is((select thumbhash from public.photo_thumbhashes where thumb_path = (select path from k where name = 'own')),
  '3OcRJYB4d3h/iIeHeEh3eIhw+j2w', 'the service role reads it back');
select throws_ok($$ insert into public.photo_thumbhashes (thumb_path, user_id, thumbhash)
                    values ('moments/' || tests.id('reader') || '/x/thumb.webp', tests.id('owner'), '3OcRJYB4d3h/iIeH') $$,
  '23514', null, 'a key outside the owner''s folder is refused');
select throws_ok($$ insert into public.photo_thumbhashes (thumb_path, user_id, thumbhash)
                    values ('moments/' || tests.id('owner') || '/y/thumb.webp', tests.id('owner'), 'not a hash!') $$,
  '23514', null, 'a value that isn''t base64 is refused');

-- ---------------------------------------------------------------- clients are refused
create function pg_temp.refused(p_who text) returns setof text language plpgsql as $$
begin
  return next throws_ok($q$ select * from public.photo_thumbhashes $q$, '42501', null, p_who || ' can''t read the table');
  return next throws_ok(format($q$ insert into public.photo_thumbhashes (thumb_path, user_id, thumbhash)
                                  values ('moments/%s/z/thumb.webp', '%s', '3OcRJYB4d3h/iIeH') $q$,
                               tests.id('owner'), tests.id('owner')),
                        '42501', null, p_who || ' can''t write the table');
end $$;
grant execute on function pg_temp.refused(text) to authenticated, anon;

select tests.act_as('owner');
select * from pg_temp.refused('owner');
select tests.act_as('reader');
select * from pg_temp.refused('reader');
select tests.act_as('outsider');
select * from pg_temp.refused('outsider');
select tests.act_as('blocked');
select * from pg_temp.refused('blocked');
select tests.act_as('moderator');
select * from pg_temp.refused('moderator');
select tests.act_as_anon();
select * from pg_temp.refused('anon');

-- ---------------------------------------------------------------- account deletion
select tests.reset_role();
delete from public.profiles where id = tests.id('owner');
select is((select count(*)::int from public.photo_thumbhashes where thumb_path = (select path from k where name = 'own')), 0,
  'deleting the account removes its hashes');

select * from finish();
rollback;
