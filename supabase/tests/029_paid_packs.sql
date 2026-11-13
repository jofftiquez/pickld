-- M6-02 (0029): the paid packs the shop sells. Each maps to a store product, nobody may use one until they own
-- it, a seasonal pack is sold only in its window and stays usable for buyers afterwards (FR-STK-06, FR-STK-07).
begin;
\ir _helpers.psql
select plan(9);

select tests.world();

create function pg_temp.usable() returns text[] language sql as $$
  select coalesce(array_agg(p.slug order by p.sort), '{}') from public.sticker_packs p where p.pack_usable and p.tier in ('premium', 'seasonal')
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

select results_eq(
  $$ select p.slug, p.tier::text, p.store_product_id, count(s.id)::int from public.sticker_packs p join public.stickers s on s.pack_id = p.id
     where p.tier in ('premium', 'seasonal') group by p.slug, p.tier, p.store_product_id, p.sort order by p.sort $$,
  $$ values ('christmas-2026', 'seasonal', 'me.pickld.pack.christmas_2026', 18), ('pinoy-life', 'premium', 'me.pickld.pack.pinoy_life', 34),
            ('barkada', 'premium', 'me.pickld.pack.barkada', 25), ('work-from-wherever', 'premium', 'me.pickld.pack.work_from_wherever', 24),
            ('pet-parent', 'premium', 'me.pickld.pack.pet_parent', 21),
            ('olivia', 'premium', 'me.pickld.pack.olivia', 16), ('fish-moods', 'premium', 'me.pickld.pack.fish_moods', 16),
            ('corporate', 'premium', 'me.pickld.pack.corporate', 24), ('gen-z', 'premium', 'me.pickld.pack.gen_z', 24),
            ('trentahin', 'premium', 'me.pickld.pack.trentahin', 24), ('pride', 'premium', 'me.pickld.pack.pride', 24),
            ('cyclists', 'premium', 'me.pickld.pack.cyclists', 24), ('hashtags', 'premium', 'me.pickld.pack.hashtags', 16) $$,
  'thirteen paid packs (seven added in 0060, Hashtags in 0065; 0065 also restyles the word packs), each with its store product and stickers');
select is((select count(*)::int from public.sticker_packs where tier in ('premium', 'seasonal') and (description is null or store_product_id is null)), 0,
          'every paid pack has a description and a store product');
select is((select count(distinct store_product_id)::int from public.sticker_packs where store_product_id is not null), 13,
          'store products are distinct');
select is((select available_from || ' – ' || available_to from public.sticker_packs where slug = 'christmas-2026'),
          '2026-08-31 16:00:00+00 – 2026-12-31 16:00:00+00', 'the Christmas pack sells Sep 1 – Dec 31, Manila time');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.tier in ('premium', 'seasonal') and s.asset_path not like 'stickers/' || p.slug || '/%.png'), 0,
          'paid art lives under stickers/<pack slug>/');

select tests.act_as('owner');
select is(pg_temp.usable(), '{}'::text[], 'no paid pack is usable before buying');
select is((select count(*)::int from public.stickers s where s.sticker_usable and s.pack_id in
           (select id from public.sticker_packs where tier in ('premium', 'seasonal'))), 0, 'nor any of its stickers');

-- A purchase (fn:revenuecat-webhook → store_purchases_sync) after the season ended.
select tests.act_as_service();
select public.store_purchases_sync(tests.id('owner'), '[{"product_id": "me.pickld.pack.christmas_2026", "transaction_id": "t1"}, {"product_id": "me.pickld.pack.barkada", "transaction_id": "t2"}]');
select tests.reset_role();
update public.sticker_packs set available_to = now() - interval '1 day' where slug = 'christmas-2026';
select tests.act_as('owner');
select is(pg_temp.usable(), array['christmas-2026', 'barkada'], 'bought packs are usable, a seasonal one after its season too');
select tests.act_as('reader');
select is(pg_temp.usable(), '{}'::text[], 'and only for the buyer');

select * from finish();
rollback;
