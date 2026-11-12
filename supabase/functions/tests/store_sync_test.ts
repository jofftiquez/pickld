// fn:store-sync (M6-03) against the local database: the app's "check my purchases" call after a purchase or
// a restore. RevenueCat's REST API is faked behind the real revenueCatClient, as in revenuecat_webhook_test.
import { assertEquals } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { REVENUECAT_API, revenueCatClient, serviceStore } from '../revenuecat-webhook/handler.ts';
import { handleStoreSync, servicePurchases } from '../store-sync/handler.ts';
import { admin, cleanup, createUser, localStatus, request } from './local.ts';

const PRODUCT = `me.pickld.pack.fnsync_${crypto.randomUUID().slice(0, 8)}`;
const SLUG = PRODUCT.replace('me.pickld.pack.', '').replaceAll('_', '-');

async function ownedSlugs(userId: string): Promise<string[]> {
  const db = await admin();
  const { data, error } = await db.from('owned_packs').select('sticker_packs(slug)').eq('user_id', userId)
    .eq('source', 'purchase');
  if (error) throw new Error(error.message);
  return (data as unknown as { sticker_packs: { slug: string } }[]).map((r) => r.sticker_packs.slug).sort();
}

Deno.test('store-sync: the caller syncs only their own verified purchases; local builds can dev-buy', async (t) => {
  await localStatus();
  const db = await admin();
  const { error } = await db.from('sticker_packs')
    .insert({ slug: SLUG, name: 'Fn sync pack', tier: 'premium', store_product_id: PRODUCT, sort: 99 });
  if (error) throw new Error(error.message);
  const buyer = await createUser('buyer');
  const other = await createUser('other');

  const ledger = new Map<string, string[]>();
  const calls: string[] = [];
  const fetcher = ((url: string | URL | Request) => {
    const id = decodeURIComponent(String(url).slice(`${REVENUECAT_API}/subscribers/`.length));
    calls.push(id);
    const nonSubs: Record<string, unknown[]> = {};
    for (const p of ledger.get(id) ?? []) {
      nonSubs[p] = [{ id: `rc-${p}`, store_transaction_id: 'tx-1', is_sandbox: true }];
    }
    return Promise.resolve(Response.json({ subscriber: { non_subscriptions: nonSubs } }));
  }) as typeof fetch;
  const real = {
    userClient,
    store: () => serviceStore(db),
    revenuecat: () => revenueCatClient('rc-secret-key', { allowSandbox: true, fetcher }),
    currentPurchases: servicePurchases(db),
  };
  const local = { ...real, revenuecat: () => null };

  try {
    await t.step('not signed in: 401', async () => {
      const res = await handleStoreSync(request('store-sync', { body: {} }), real);
      assertEquals(res.status, 401);
      await res.body?.cancel();
    });

    await t.step('syncs the caller (not anyone named in the body) from RevenueCat', async () => {
      ledger.set(buyer.id, [PRODUCT]);
      const res = await handleStoreSync(request('store-sync', { jwt: buyer.jwt, body: {} }), real);
      assertEquals(res.status, 200);
      assertEquals((await res.json()).data, { granted: [SLUG], revoked: [] });
      assertEquals(calls.at(-1), buyer.id);
      assertEquals(await ownedSlugs(buyer.id), [SLUG]);
      assertEquals(await ownedSlugs(other.id), []);
    });

    await t.step('with a store, devProductId is refused', async () => {
      const res = await handleStoreSync(
        request('store-sync', { jwt: other.jwt, body: { devProductId: PRODUCT } }),
        real,
      );
      assertEquals(res.status, 400);
      await res.body?.cancel();
      assertEquals(await ownedSlugs(other.id), []);
    });

    await t.step('local dev store: devProductId unlocks the pack and keeps earlier purchases', async () => {
      const res = await handleStoreSync(
        request('store-sync', { jwt: other.jwt, body: { devProductId: PRODUCT } }),
        local,
      );
      assertEquals((await res.json()).data, { granted: [SLUG], revoked: [] });
      const again = await handleStoreSync(request('store-sync', { jwt: other.jwt, body: {} }), local);
      assertEquals((await again.json()).data, { granted: [], revoked: [] });
      assertEquals(await ownedSlugs(other.id), [SLUG]);
    });

    await t.step('an unknown key in the body: 400', async () => {
      const res = await handleStoreSync(request('store-sync', { jwt: buyer.jwt, body: { userId: other.id } }), real);
      assertEquals(res.status, 400);
      await res.body?.cancel();
    });
  } finally {
    await cleanup();
    await db.from('sticker_packs').delete().eq('slug', SLUG);
  }
});
