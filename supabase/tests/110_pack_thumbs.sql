-- 0110: thumbs up on sticker packs (FR-STK-07). One thumb per person per published pack, set and cleared only
-- through set_pack_thumb(); drafts are refused, by the function and by the table itself. Counts leave out
-- inactive accounts and anyone with a block either way with the viewer. Tried as owner, reader, outsider,
-- blocked, blocker, a suspended account, anon and a moderator.
begin;
\ir _helpers.psql
select plan(36);

insert into public.sticker_packs (id, slug, name, tier) values
  ('a1100000-0000-4000-8000-000000000001', 't110-pub', 'T110 Published', 'free');
insert into public.sticker_packs (id, slug, name, tier, status) values
  ('a1100000-0000-4000-8000-000000000002', 't110-draft', 'T110 Draft', 'free', 'draft');

select tests.world();
select tests.create_user('gone');

create function pg_temp.seen(p_pack text) returns table (thumbs int, mine boolean) language sql as $$
  select thumbs, mine from public.pack_thumbs() where pack_id = p_pack::uuid
$$;
grant execute on function pg_temp.seen(text) to authenticated, anon;

-- ---------------------------------------------------------------- the table
select has_table('public', 'pack_thumbs', 'pack_thumbs exists');
select ok((select relrowsecurity from pg_class where oid = 'public.pack_thumbs'::regclass), 'RLS is on');
select col_is_pk('public', 'pack_thumbs', array['user_id', 'pack_id'], 'one thumb per person per pack');

-- ---------------------------------------------------------------- anon
select tests.act_as_anon();
select throws_ok($$ select public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true) $$, '42501',
  null, 'anon can''t give a thumb');
select throws_ok($$ select * from public.pack_thumbs() $$, '42501', null, 'anon can''t read counts');
select throws_ok($$ select * from public.pack_thumbs $$, '42501', null, 'anon can''t read the table');

-- ---------------------------------------------------------------- owner
select tests.act_as('owner');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true),
  '{"thumbed": true, "thumbs": 1}'::jsonb, 'owner gives a thumb');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true),
  '{"thumbed": true, "thumbs": 1}'::jsonb, 'a second thumb changes nothing');
select throws_ok($$ select public.set_pack_thumb('a1100000-0000-4000-8000-000000000002', true) $$, 'P0002',
  null, 'a draft pack can''t get a thumb');
select throws_ok($$ select public.set_pack_thumb(gen_random_uuid(), true) $$, 'P0002',
  null, 'an unknown pack can''t get a thumb');
select throws_ok($$ select public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', null) $$, '22023',
  null, 'on or off is required');
select throws_ok($$ insert into public.pack_thumbs (user_id, pack_id)
                    values (auth.uid(), 'a1100000-0000-4000-8000-000000000002') $$, '42501',
  null, 'clients can''t write the table');
select throws_ok($$ delete from public.pack_thumbs $$, '42501', null, 'clients can''t delete from the table');
select throws_ok($$ select public.pack_thumb_count('a1100000-0000-4000-8000-000000000001', auth.uid()) $$, '42501',
  null, 'the count helper isn''t callable');
select is((select count(*)::int from public.pack_thumbs() where pack_id = 'a1100000-0000-4000-8000-000000000002'), 0,
  'pack_thumbs() leaves drafts out');

-- ---------------------------------------------------------------- others
select tests.act_as('reader');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true) ->> 'thumbs', '2', 'reader gives a thumb');
select tests.act_as('blocked');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true) ->> 'thumbs', '2',
  'blocked gives a thumb; the owner''s isn''t counted for them');
select tests.act_as('gone');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', true) ->> 'thumbs', '4', 'gone gives a thumb');

select tests.act_as('outsider');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (4, false) $$, 'outsider sees every thumb and none of their own');
select is((select count(*)::int from public.pack_thumbs), 0, 'outsider reads no one else''s rows');

select tests.act_as('reader');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (4, true) $$, 'reader sees every thumb, their own included');
select results_eq($$ select user_id from public.pack_thumbs $$, $$ values (tests.id('reader')) $$,
  'reader reads only their own row');

select tests.act_as('owner');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (3, true) $$, 'owner doesn''t count the person they blocked');
select tests.act_as('blocker');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (3, false) $$, 'blocker doesn''t count the person they blocked');

-- ---------------------------------------------------------------- inactive accounts
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('gone');
select tests.act_as('outsider');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (3, false) $$, 'a suspended account''s thumb isn''t counted');
select tests.act_as('gone');
select throws_ok($$ select public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', false) $$, '42501',
  null, 'a suspended account can''t change its thumb');

-- ---------------------------------------------------------------- off
select tests.act_as('reader');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', false),
  '{"thumbed": false, "thumbs": 2}'::jsonb, 'reader takes the thumb back');
select is(public.set_pack_thumb('a1100000-0000-4000-8000-000000000001', false) ->> 'thumbs', '2',
  'taking it back twice changes nothing');
select results_eq($$ select * from pg_temp.seen('a1100000-0000-4000-8000-000000000001') $$,
  $$ values (2, false) $$, 'reader''s thumb is gone');

-- ---------------------------------------------------------------- drafts, whoever writes
select tests.reset_role();
select throws_ok($$ insert into public.pack_thumbs (user_id, pack_id)
                    values (tests.id('owner'), 'a1100000-0000-4000-8000-000000000002') $$, '23514',
  null, 'the table refuses a draft pack even for the server');

-- ---------------------------------------------------------------- console
select tests.act_as('owner');
select throws_ok($$ select public.mod_sticker_thumbs(30) $$, '42501', null, 'a non-moderator can''t read the console view');
select tests.act_as_anon();
select throws_ok($$ select public.mod_sticker_thumbs(30) $$, '42501', null, 'anon can''t read the console view');

select tests.act_as('moderator');
create temp table m as select public.mod_sticker_thumbs(500) as doc;
select is((select doc ->> 'days' from m), '90', 'days are clamped to 90');
select is((select e ->> 'thumbs' from m, jsonb_array_elements(doc -> 'packs') e
           where e ->> 'slug' = 't110-pub'), '2', 'the console counts active accounts only, without a block filter');
select is((select e ->> 'thumbs_window' from m, jsonb_array_elements(doc -> 'packs') e
           where e ->> 'slug' = 't110-pub'), '2', 'and the same in the window');
select is((select e ->> 'thumbs' from m, jsonb_array_elements(doc -> 'packs') e
           where e ->> 'slug' = 't110-draft'), '0', 'drafts are listed with no thumbs');

select * from finish();
rollback;
