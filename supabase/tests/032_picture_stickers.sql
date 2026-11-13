-- T-506 (0032): about half the word stickers are retired and picture stickers take their place. Retired rows stay
-- (ids, art and the anon catalog unchanged) so moments that use them still draw; only offered stickers count below.
begin;
\ir _helpers.psql
select plan(12);

select tests.world();

-- ---------------------------------------------------------------- what each pack offers now
select results_eq(
  $$ select p.slug, count(*) filter (where s.retired_at is null)::int, count(*) filter (where s.retired_at is not null)::int
     from public.sticker_packs p join public.stickers s on s.pack_id = p.id group by p.slug, p.sort order by p.sort $$,
  $$ values ('everyday', 17, 8), ('the-eight', 24, 16), ('stamps', 10, 0), ('milestones', 10, 0), ('christmas-2026', 12, 6),
            ('pinoy-life', 25, 9), ('barkada', 17, 8), ('work-from-wherever', 16, 8), ('pet-parent', 14, 7),
            ('olivia', 16, 0), ('fish-moods', 16, 0), ('corporate', 12, 0), ('gen-z', 12, 0), ('trentahin', 12, 0), ('pride', 12, 0),
            ('cyclists', 12, 0) $$,
  'offered and retired stickers per pack (0060 adds stamps, milestones, Pinoy Life pictures and seven packs)');
select is((select count(*)::int from public.stickers where retired_at is not null and asset_path ~ '/(cat|dog|bunny|mango|heart|jeepney|pizza|bone)\.png$'),
          0, 'no new picture is retired');
select results_eq(
  $$ select s.slot_hint::text, count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
     where p.slug = 'the-eight' and s.retired_at is null group by s.slot_hint order by s.slot_hint $$,
  $$ select v::text, 3 from unnest(enum_range(null::slot)) with ordinality u(v, n) order by n $$,
  'The Eight still offers three stickers for each slot');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug in ('everyday', 'the-eight', 'christmas-2026', 'pinoy-life', 'barkada', 'work-from-wherever', 'pet-parent')
             and s.retired_at is null and s.sort < 100), 72, '72 picture stickers (64 here, 8 more Pinoy Life in 0060), sorted before the words that stay');
select is((select count(*)::int from public.stickers where id <> md5('pickld-sticker:' || asset_path)::uuid), 0,
          'new and old ids still derive from the asset path');

-- ---------------------------------------------------------------- packs and prices unchanged
select results_eq($$ select slug, tier::text, store_product_id from public.sticker_packs order by sort $$,
  $$ values ('everyday', 'free', null::text), ('the-eight', 'free', null), ('stamps', 'free', null), ('milestones', 'earned', null),
            ('christmas-2026', 'seasonal', 'me.pickld.pack.christmas_2026'), ('pinoy-life', 'premium', 'me.pickld.pack.pinoy_life'),
            ('barkada', 'premium', 'me.pickld.pack.barkada'), ('work-from-wherever', 'premium', 'me.pickld.pack.work_from_wherever'),
            ('pet-parent', 'premium', 'me.pickld.pack.pet_parent'), ('olivia', 'premium', 'me.pickld.pack.olivia'),
            ('fish-moods', 'premium', 'me.pickld.pack.fish_moods'), ('corporate', 'premium', 'me.pickld.pack.corporate'),
            ('gen-z', 'premium', 'me.pickld.pack.gen_z'), ('trentahin', 'premium', 'me.pickld.pack.trentahin'),
            ('pride', 'premium', 'me.pickld.pack.pride'), ('cyclists', 'premium', 'me.pickld.pack.cyclists') $$,
  'tiers, store products and free packs are unchanged (0060 only adds premium packs)');

-- ---------------------------------------------------------------- retired stickers still draw
select tests.act_as('owner');
select ok((select s.sticker_usable from public.stickers s where asset_path = 'stickers/everyday/kain-tayo.png'),
          'a retired free sticker stays usable, so re-saving an old moment that has it works');
select is((select retired_at is not null from public.stickers where asset_path = 'stickers/everyday/kain-tayo.png'), true,
          'and the app can see it is retired');
select is((select count(*)::int from public.stickers where retired_at is null), 237, 'the app offers 237 stickers across all packs');
select throws_ok($$ update public.stickers set retired_at = null where asset_path = 'stickers/everyday/kain-tayo.png' $$,
                 '42501', null, 'a signed-in user cannot bring a retired sticker back');
select tests.act_as_anon();
select ok(exists (select 1 from public.public_sticker_catalog() where asset_path = 'stickers/barkada/tropa.png'),
          'the web page still resolves a retired sticker (FR-STK-04)');
select ok(exists (select 1 from public.public_sticker_catalog() where asset_path = 'stickers/pet-parent/paw-print.png'),
          'and the new pictures');

select * from finish();
rollback;
