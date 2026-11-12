// fn:revenuecat-webhook (M6-01) against the local database, with RevenueCat's REST API faked behind the real
// revenueCatClient. Events come from tests/fixtures/revenuecat (shaped like RevenueCat's webhook bodies) and
// carry the Authorization header RevenueCat's dashboard sends. The SQL rules are pinned in pgTAP 028.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  handleRevenueCatWebhook,
  REVENUECAT_API,
  revenueCatClient,
  serviceStore,
  type StorePurchase,
  usersOf,
} from '../revenuecat-webhook/handler.ts';
import { admin, cleanup, createUser } from './local.ts';

const SECRET = 'revenuecat-webhook-secret-at-least-32-chars';
const PRODUCT = `me.pickld.pack.fntest_${crypto.randomUUID().slice(0, 8)}`;

async function fixture(name: string, vars: Record<string, string>): Promise<string> {
  let text = await Deno.readTextFile(new URL(`./fixtures/revenuecat/${name}.json`, import.meta.url));
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{{${k}}}`, v);
  return text;
}

function post(body: string, auth: string | null = `Bearer ${SECRET}`): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth !== null) headers.authorization = auth;
  return new Request('http://fn.local/revenuecat-webhook', { method: 'POST', headers, body });
}

/** RevenueCat's subscribers endpoint, answering from `ledger` (app user id → one-time purchases). */
function fakeRevenueCat(ledger: Map<string, { product: string; tx: string; sandbox?: boolean }[]>, status = 200) {
  const calls: string[] = [];
  const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer rc-secret-key');
    if (status !== 200) return Promise.resolve(new Response('{}', { status }));
    const id = decodeURIComponent(u.slice(`${REVENUECAT_API}/subscribers/`.length));
    const nonSubs: Record<string, unknown[]> = {};
    for (const p of ledger.get(id) ?? []) {
      (nonSubs[p.product] ??= []).push({ id: `rc-${p.tx}`, store_transaction_id: p.tx, is_sandbox: p.sandbox ?? true });
    }
    return Promise.resolve(Response.json({ subscriber: { original_app_user_id: id, non_subscriptions: nonSubs } }));
  }) as typeof fetch;
  return { calls, fetcher };
}

async function ownedSlugs(userId: string): Promise<string[]> {
  const db = await admin();
  const { data, error } = await db.from('owned_packs').select('source, sticker_packs(slug)').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data as unknown as { source: string; sticker_packs: { slug: string } }[])
    .map((r) => `${r.sticker_packs.slug}:${r.source}`).sort();
}

Deno.test('revenuecat-webhook: purchase, refund and transfer keep owned_packs in step with RevenueCat', async (t) => {
  const db = await admin();
  const slug = PRODUCT.replace('me.pickld.pack.', '').replaceAll('_', '-');
  const { data: pack, error } = await db.from('sticker_packs')
    .insert({ slug, name: 'Fn test pack', tier: 'premium', store_product_id: PRODUCT, sort: 99 }).select('id').single();
  if (error) throw new Error(error.message);
  const buyer = await createUser('buyer');
  const other = await createUser('other');
  const vars = { BUYER: buyer.id, OTHER: other.id, PRODUCT };
  const ledger = new Map<string, { product: string; tx: string; sandbox?: boolean }[]>();
  const rc = fakeRevenueCat(ledger);
  const deps = (allowSandbox = true) => ({
    secret: () => SECRET,
    store: () => serviceStore(db),
    revenuecat: () => revenueCatClient('rc-secret-key', { allowSandbox, fetcher: rc.fetcher }),
  });

  try {
    await t.step('wrong or missing secret: 401, nothing read or written', async () => {
      const body = await fixture('non_renewing_purchase', vars);
      for (const auth of [null, 'Bearer wrong', SECRET]) {
        const res = await handleRevenueCatWebhook(post(body, auth), deps());
        assertEquals(res.status, 401);
        await res.body?.cancel();
      }
      assertEquals(rc.calls.length, 0);
    });

    await t.step('a forged event without a verified purchase grants nothing', async () => {
      const res = await handleRevenueCatWebhook(post(await fixture('non_renewing_purchase', vars)), deps());
      assertEquals(res.status, 200);
      assertEquals((await res.json()).data.synced, [{ userId: buyer.id, granted: [], revoked: [] }]);
      assertEquals(await ownedSlugs(buyer.id), []);
    });

    await t.step('a verified purchase unlocks the pack within 5 seconds', async () => {
      ledger.set(buyer.id, [{ product: PRODUCT, tx: '2000000999000001' }]);
      const started = performance.now();
      const res = await handleRevenueCatWebhook(post(await fixture('non_renewing_purchase', vars)), deps());
      const elapsed = performance.now() - started;
      assertEquals(res.status, 200);
      assertEquals((await res.json()).data.synced, [{ userId: buyer.id, granted: [slug], revoked: [] }]);
      assertEquals(await ownedSlugs(buyer.id), [`${slug}:purchase`]);
      assert(elapsed < 5000, `took ${elapsed} ms`);
      assertEquals(rc.calls.at(-1), `${REVENUECAT_API}/subscribers/${buyer.id}`);
    });

    await t.step('production ignores sandbox receipts', async () => {
      const res = await handleRevenueCatWebhook(post(await fixture('non_renewing_purchase', vars)), deps(false));
      assertEquals((await res.json()).data.synced, [{ userId: buyer.id, granted: [], revoked: [slug] }]);
      // Back to owned for the next steps.
      await (await handleRevenueCatWebhook(post(await fixture('non_renewing_purchase', vars)), deps())).body?.cancel();
      assertEquals(await ownedSlugs(buyer.id), [`${slug}:purchase`]);
    });

    await t.step('a transfer (restore on another account) moves the pack', async () => {
      ledger.set(buyer.id, []);
      ledger.set(other.id, [{ product: PRODUCT, tx: '2000000999000001' }]);
      const res = await handleRevenueCatWebhook(post(await fixture('transfer', vars)), deps());
      assertEquals((await res.json()).data.synced, [
        { userId: buyer.id, granted: [], revoked: [slug] },
        { userId: other.id, granted: [slug], revoked: [] },
      ]);
      assertEquals(await ownedSlugs(buyer.id), []);
      assertEquals(await ownedSlugs(other.id), [`${slug}:purchase`]);
    });

    await t.step('a refund takes the pack away', async () => {
      ledger.set(other.id, []);
      const res = await handleRevenueCatWebhook(
        post(await fixture('cancellation_refund', { ...vars, BUYER: other.id })),
        deps(),
      );
      assertEquals((await res.json()).data.synced, [{ userId: other.id, granted: [], revoked: [slug] }]);
      assertEquals(await ownedSlugs(other.id), []);
    });

    await t.step('the dashboard test event answers 200 without reading anything', async () => {
      const before = rc.calls.length;
      const res = await handleRevenueCatWebhook(post(await fixture('test', vars)), deps());
      assertEquals(res.status, 200);
      assertEquals((await res.json()).data, { synced: [] });
      assertEquals(rc.calls.length, before);
    });
  } finally {
    await cleanup();
    await db.from('sticker_packs').delete().eq('id', pack.id);
  }
});

Deno.test('revenuecat-webhook: RevenueCat down or rate limiting → 503 so RevenueCat retries', async () => {
  const id = crypto.randomUUID();
  for (const status of [429, 500, 503]) {
    const rc = fakeRevenueCat(new Map(), status);
    const res = await handleRevenueCatWebhook(
      post(JSON.stringify({ event: { type: 'NON_RENEWING_PURCHASE', app_user_id: id } })),
      {
        secret: () => SECRET,
        store: () => ({ sync: () => Promise.reject(new Error('must not be called')) }),
        revenuecat: () => revenueCatClient('rc-secret-key', { allowSandbox: true, fetcher: rc.fetcher }),
      },
    );
    assertEquals(res.status, 503);
    assertEquals((await res.json()).error.code, 'revenuecat_unavailable');
  }
});

Deno.test('revenuecat-webhook: bad bodies and short secrets are refused', async () => {
  const deps = {
    secret: () => SECRET,
    store: () => ({ sync: (_u: string, _p: StorePurchase[]) => Promise.resolve(null) }),
    revenuecat: () => ({ purchases: () => Promise.resolve([]) }),
  };
  const notJson = await handleRevenueCatWebhook(post('nope'), deps);
  assertEquals(notJson.status, 400);
  await notJson.body?.cancel();
  const short = await handleRevenueCatWebhook(post('{}', 'Bearer short'), { ...deps, secret: () => 'short' });
  assertEquals(short.status, 401);
  await short.body?.cancel();
  const get = await handleRevenueCatWebhook(new Request('http://fn.local/x'), deps);
  assertEquals(get.status, 405);
  await get.body?.cancel();
});

Deno.test('revenuecat-webhook: only uuid app user ids are Pickld users', () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  assertEquals(
    usersOf({
      type: 'TRANSFER',
      app_user_id: '$RCAnonymousID:abc',
      transferred_from: [a.toUpperCase(), '$RCAnonymousID:def'],
      transferred_to: [b, a],
    }),
    [a, b],
  );
});
