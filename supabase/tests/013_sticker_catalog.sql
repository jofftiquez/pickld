-- M2-14 (0012): the sticker catalog is server data every signed-in user reads, anon reads only through
-- public_sticker_catalog() (C-6), free packs are usable by everyone without an owned_packs row, and Milestones
-- stickers need their milestone (FR-STK-01, FR-STK-02, FR-STK-04, FR-STK-05; D-8).
begin;
\ir _helpers.psql
select plan(46);

select tests.world();

-- Packs and stickers visible to the current role, and how many stickers it may use.
create function pg_temp.seen() returns text language sql as $$
  select (select count(*) from public.sticker_packs) || ' packs/' || (select count(*) from public.stickers) || ' stickers'
$$;
create function pg_temp.usable_packs() returns text[] language sql as $$
  select coalesce(array_agg(p.slug order by p.sort), '{}') from public.sticker_packs p where p.pack_usable
$$;
create function pg_temp.usable_milestone_stickers() returns text[] language sql as $$
  select coalesce(array_agg(s.milestone_key order by s.sort), '{}')
  from public.stickers s where s.milestone_key is not null and s.sticker_usable
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------------------------------------------------------------- privileges
select ok(not has_table_privilege('anon', 'public.sticker_packs', 'select')
          and not has_table_privilege('anon', 'public.stickers', 'select')
          and not has_table_privilege('anon', 'public.owned_packs', 'select'),
          'anon has no table privileges on the catalog or ownership');
select ok(not has_table_privilege('authenticated', 'public.sticker_packs', 'insert,update,delete')
          and not has_table_privilege('authenticated', 'public.stickers', 'insert,update,delete'),
          'signed-in users cannot write the catalog');
select ok(has_function_privilege('anon', 'public.public_sticker_catalog()', 'execute'),
          'anon may call public_sticker_catalog()');
select ok(not has_function_privilege('anon', 'public.pack_usable(public.sticker_packs)', 'execute')
          and not has_function_privilege('anon', 'public.sticker_usable(public.stickers)', 'execute'),
          'anon may not call the ownership helpers');
select ok(pg_get_function_result('public.public_sticker_catalog()'::regprocedure)
          !~ '(owned|usable|user_id|store_product_id|artist_id|milestone_key|source|transaction)',
          'the anon catalog has no ownership, store, artist or milestone columns');

-- ---------------------------------------------------------------- launch catalog (FR-STK-01)
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id where p.tier in ('free', 'earned')), 85,
          '85 rows in the launch packs: the 50 launch stickers, 26 pictures (0032) and 9 stamps and milestones (0060)');
select results_eq(
  $$ select p.slug, p.tier::text, count(s.id)::int from public.sticker_packs p left join public.stickers s on s.pack_id = p.id
     where p.tier in ('free', 'earned') group by p.slug, p.tier, p.sort order by p.sort $$,
  $$ values ('everyday', 'free', 25), ('the-eight', 'free', 40), ('stamps', 'free', 10), ('milestones', 'earned', 10) $$,
  'rows per pack, retired ones included (0032): Everyday 25, The Eight 40, Stamps 10, Milestones 10 (0060)');
select results_eq(
  $$ select s.slot_hint::text, count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
     where p.slug = 'the-eight' group by s.slot_hint order by s.slot_hint $$,
  $$ select v::text, 5 from unnest(enum_range(null::slot)) with ordinality u(v, n) order by n $$,
  'The Eight: five rows for each of the 8 slots (three offered, 0032), each hinted with its slot');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug = 'the-eight' and s.slot_hint is null), 0, 'every The Eight sticker has a slot hint');
select is((select array_agg(s.stamp::text order by s.sort) from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug = 'stamps' and s.stamp is not null),
          array['time', 'date', 'weekday', 'jar_number'], 'Stamps has the auto time, date, day and jar number stamps');
select is((select array_agg(s.milestone_key order by s.sort) from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug = 'milestones'),
          array['first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year', 'jars_7', 'full_jars_30', 'jars_50', 'full_jars_100', 'jars_200'], 'Milestones: one sticker per milestone (D-8, 0060)');
select is((select count(*)::int from public.stickers where milestone_key is not null and pack_id <> (select id from public.sticker_packs where slug = 'milestones')),
          0, 'only Milestones stickers carry a milestone key');
select is((select count(*)::int from public.stickers where cardinality(tags) = 0), 0, 'every sticker has tags');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where s.asset_path not like 'stickers/' || p.slug || '/%.png'), 0, 'art lives under stickers/<pack slug>/');
select is((select count(*)::int from public.stickers where id <> md5('pickld-sticker:' || asset_path)::uuid), 0,
          'sticker ids are derived from the asset path (the same in every environment)');
select throws_ok($$ insert into public.stickers (pack_id, label, asset_path) select id, 'x', 'moments/x.jpg' from public.sticker_packs limit 1 $$,
                 '23514', null, 'an asset path outside stickers/ is refused');
select throws_ok($$ insert into public.stickers (pack_id, label, asset_path) select id, 'x', 'stickers/everyday/kape-muna.png' from public.sticker_packs limit 1 $$,
                 '23505', null, 'asset paths are unique');

-- ---------------------------------------------------------------- signed-in reads (owner, reader, outsider, blocked, blocker)
select tests.act_as('owner');
select is(pg_temp.seen(), '16 packs/299 stickers', 'owner reads the whole catalog');
select tests.act_as('reader');
select is(pg_temp.seen(), '16 packs/299 stickers', 'reader reads the whole catalog');
select tests.act_as('outsider');
select is(pg_temp.seen(), '16 packs/299 stickers', 'outsider reads the whole catalog');
select tests.act_as('blocked');
select is(pg_temp.seen(), '16 packs/299 stickers', 'a blocked user reads the whole catalog (it is nobody''s content)');
select tests.act_as('blocker');
select is(pg_temp.seen(), '16 packs/299 stickers', 'a user who blocked someone reads the whole catalog');
select throws_ok($$ insert into public.stickers (pack_id, label, asset_path) select id, 'mine', 'stickers/everyday/mine.png' from public.sticker_packs limit 1 $$,
                 '42501', null, 'a signed-in user cannot add a sticker');
select throws_ok($$ update public.sticker_packs set tier = 'free' where slug = 'milestones' $$,
                 '42501', null, 'or make the Milestones pack free');

-- ---------------------------------------------------------------- anon (C-6): RPC yes, tables no
select tests.act_as_anon();
select throws_ok($$ select * from public.stickers $$, '42501', null, 'anon cannot read stickers');
select throws_ok($$ select * from public.sticker_packs $$, '42501', null, 'anon cannot read sticker_packs');
select throws_ok($$ select * from public.owned_packs $$, '42501', null, 'anon cannot read owned_packs');
select throws_ok($$ select public.pack_usable(p) from (select null::public.sticker_packs p) x $$, '42501', null,
                 'anon cannot call pack_usable');
select is((select count(*)::int from public.public_sticker_catalog()), 299, 'anon reads all 299 stickers through the RPC (launch, paid and retired)');
select results_eq($$ select pack_slug, count(*)::int from public.public_sticker_catalog() group by pack_slug, pack_sort order by pack_sort $$,
                  $$ values ('everyday', 25), ('the-eight', 40), ('stamps', 10), ('milestones', 10), ('christmas-2026', 18),
                           ('pinoy-life', 34), ('barkada', 25), ('work-from-wherever', 24), ('pet-parent', 21),
                           ('olivia', 16), ('fish-moods', 16), ('corporate', 12), ('gen-z', 12), ('trentahin', 12), ('pride', 12), ('cyclists', 12) $$,
                  'with every pack, earned and paid ones included (viewers never pay, FR-STK-04)');
select is((select array_agg(distinct slot_hint::text order by slot_hint::text) from public.public_sticker_catalog() where pack_slug = 'the-eight'),
          (select array_agg(v::text order by v::text) from unnest(enum_range(null::slot)) v), 'and the slot hints');

-- ---------------------------------------------------------------- free vs Milestones (FR-STK-01, FR-STK-05)
select tests.act_as('owner');
select is(pg_temp.usable_packs(), array['everyday', 'the-eight', 'stamps'], 'a new user may use the three free packs');
select is((select count(*)::int from public.owned_packs), 0, 'without any owned_packs row');
select is((select count(*)::int from public.stickers s where s.sticker_usable), 75, '75 usable stickers: everything free but Milestones');
select is(pg_temp.usable_milestone_stickers(), '{}'::text[], 'no Milestones sticker before a milestone');
select tests.act_as('blocked');
select is(pg_temp.usable_packs(), array['everyday', 'the-eight', 'stamps'], 'free packs are usable by every user, blocked ones too');

-- The owner fills a jar: first_full_jar and the Milestones pack (0010).
select tests.reset_role();
select tests.make_moment(j, s, 'checking') from tests.make_jar('owner') j, unnest(enum_range(null::slot)) s;
select tests.act_as('owner');
select is(pg_temp.usable_packs(), array['everyday', 'the-eight', 'stamps', 'milestones'], 'the first full jar unlocks the Milestones pack');
select is(pg_temp.usable_milestone_stickers(), array['first_full_jar'], 'but only the sticker of the milestone reached');
select is((select count(*)::int from public.stickers s where s.sticker_usable), 76, '76 usable stickers');
select tests.act_as('reader');
select is(pg_temp.usable_packs(), array['everyday', 'the-eight', 'stamps'], 'the owner''s milestone unlocks nothing for the reader');
select is((select count(*)::int from public.owned_packs), 0, 'and the reader cannot see the owner''s owned_packs');
select tests.reset_role();
insert into public.milestones (user_id, key) values (tests.id('owner'), 'jars_100');
select tests.act_as('owner');
select is(pg_temp.usable_milestone_stickers(), array['first_full_jar', 'jars_100'], 'each milestone unlocks its own sticker');

-- ---------------------------------------------------------------- new rows, no app update (FR-STK-02)
select tests.reset_role();
insert into public.sticker_packs (slug, name, tier, sort) values ('test-free', 'Test free', 'free', 50),
                                                                ('test-soon', 'Test soon', 'free', 51);
update public.sticker_packs set available_from = now() + interval '7 days' where slug = 'test-soon';
insert into public.stickers (pack_id, label, asset_path, tags)
select id, 'Bago', 'stickers/' || slug || '/bago.png', '{new}' from public.sticker_packs where slug in ('test-free', 'test-soon');
select tests.act_as('outsider');
select is(pg_temp.seen(), '18 packs/301 stickers', 'a new pack and sticker are readable as soon as the rows exist');
select ok('test-free' = any (pg_temp.usable_packs()), 'a new free pack is usable at once, with no backfill');
select tests.act_as_anon();
select ok(exists (select 1 from public.public_sticker_catalog() where pack_slug = 'test-free' and label = 'Bago'),
          'the anon catalog shows the new sticker');
select ok(not exists (select 1 from public.public_sticker_catalog() where pack_slug = 'test-soon'),
          'but not a pack whose available_from is still in the future');

select * from finish();
rollback;
