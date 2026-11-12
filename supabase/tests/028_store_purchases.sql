-- M6-01 (0028): store_purchases_sync() makes a buyer's `purchase` rows in owned_packs match the verified
-- purchase list fn:revenuecat-webhook reads from RevenueCat (FR-STK-07). Service role only.
begin;
\ir _helpers.psql
select plan(16);

select tests.world();

-- Two paid packs for the test (M6-02 adds the real catalog rows).
insert into public.sticker_packs (slug, name, tier, store_product_id, sort) values
  ('test-premium', 'Test premium', 'premium', 'me.pickld.pack.test_premium', 90),
  ('test-seasonal', 'Test seasonal', 'seasonal', 'me.pickld.pack.test_seasonal', 91);
update public.sticker_packs set available_to = now() - interval '1 day' where slug = 'test-seasonal';

create function pg_temp.owned(p_name text) returns text[] language sql as $$
  select coalesce(array_agg(p.slug || ':' || o.source order by p.sort), '{}')
  from public.owned_packs o join public.sticker_packs p on p.id = o.pack_id where o.user_id = tests.id(p_name)
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---------------------------------------------------------------- who may call it
select ok(not has_function_privilege('anon', 'public.store_purchases_sync(uuid, jsonb)', 'execute'),
          'anon may not call store_purchases_sync');
select ok(not has_function_privilege('authenticated', 'public.store_purchases_sync(uuid, jsonb)', 'execute'),
          'signed-in users may not grant themselves packs');
select ok(has_function_privilege('service_role', 'public.store_purchases_sync(uuid, jsonb)', 'execute'),
          'the service role (Edge Functions) may call it');

select tests.act_as('owner');
select throws_ok($$ select public.store_purchases_sync(tests.id('owner'), '[]') $$, '42501', null,
                 'the owner gets permission denied');
select throws_ok($$ insert into public.owned_packs (user_id, pack_id, source) select tests.id('owner'), id, 'purchase' from public.sticker_packs where slug = 'test-premium' $$,
                 '42501', null, 'the owner still cannot write owned_packs directly');

-- ---------------------------------------------------------------- granting
select tests.act_as_service();
select is(public.store_purchases_sync(tests.id('owner'),
            '[{"product_id": "me.pickld.pack.test_premium", "transaction_id": "tx-1"}, {"product_id": "unknown.product", "transaction_id": "tx-2"}]'),
          '{"granted": ["test-premium"], "revoked": []}'::jsonb, 'a verified purchase grants its pack; unknown products are ignored');
select tests.reset_role();
select is(pg_temp.owned('owner'), array['test-premium:purchase'], 'owner now owns the pack as a purchase');
select is((select store_transaction_id from public.owned_packs o join public.sticker_packs p on p.id = o.pack_id
           where o.user_id = tests.id('owner') and p.slug = 'test-premium'), 'tx-1', 'the store transaction id is kept');
select tests.act_as('owner');
select is((select array_agg(slug order by sort) from public.sticker_packs p where p.pack_usable and tier <> 'free'),
          array['test-premium'], 'the bought pack is usable for its owner');
select tests.act_as('reader');
select is((select count(*)::int from public.sticker_packs p where p.pack_usable and slug = 'test-premium'), 0,
          'nobody else gets the pack');

select tests.act_as_service();
select is(public.store_purchases_sync(tests.id('owner'),
            '[{"product_id": "me.pickld.pack.test_premium", "transaction_id": "tx-1"}, {"product_id": "me.pickld.pack.test_seasonal", "transaction_id": "tx-3"}]'),
          '{"granted": ["test-seasonal"], "revoked": []}'::jsonb,
          'a repeat sync is idempotent and a seasonal pack bought before its season ended is still granted');

-- ---------------------------------------------------------------- refunds and transfers
select is(public.store_purchases_sync(tests.id('owner'), '[{"product_id": "me.pickld.pack.test_seasonal", "transaction_id": "tx-3"}]'),
          '{"granted": [], "revoked": ["test-premium"]}'::jsonb, 'a purchase RevenueCat no longer lists (refund) is taken away');
select tests.reset_role();
insert into public.owned_packs (user_id, pack_id, source) select tests.id('owner'), id, 'earned' from public.sticker_packs where slug = 'milestones';
select tests.act_as_service();
select is(public.store_purchases_sync(tests.id('owner'), '[]'),
          '{"granted": [], "revoked": ["test-seasonal"]}'::jsonb, 'an empty list (transferred away) revokes purchases only');
select tests.reset_role();
select is(pg_temp.owned('owner'), array['milestones:earned'], 'earned packs are never touched');

-- ---------------------------------------------------------------- bad input
select tests.act_as_service();
select is(public.store_purchases_sync(gen_random_uuid(), '[{"product_id": "me.pickld.pack.test_premium"}]'), null,
          'an unknown user is a no-op');
select throws_ok($$ select public.store_purchases_sync(tests.id('owner'), '{"product_id": "x"}') $$, '22023', null,
                 'the purchase list must be an array');

select * from finish();
rollback;
