// fn:revenuecat-webhook (M6-01; FR-STK-07). RevenueCat calls it after every purchase event; it unlocks the
// sticker packs a buyer paid for by writing owned_packs (through store_purchases_sync, 0028).
//
// Trust: RevenueCat doesn't sign webhooks. It sends the Authorization header value set in its dashboard, so
// the dashboard is set to `Bearer <REVENUECAT_WEBHOOK_SECRET>` and anything else gets 401. Even then the
// event body is only a hint of *who* bought: the purchases themselves are read back from RevenueCat's REST
// API (GET /v1/subscribers/:id with REVENUECAT_SECRET_KEY), which lists the buyer's store-verified one-time
// purchases. That list is what owned_packs is made to match, so a forged or replayed event can't grant
// anything, refunds and restores that moved a purchase to another account take it away, and the same sync
// serves the app's own "check my purchases" call (M6-03, M6-04).
//
// App user ids: the app identifies the buyer with their Pickld user id (a uuid). Anonymous RevenueCat ids
// and aliases are ignored; a TRANSFER re-syncs both sides. Sandbox purchases (TestFlight, Simulator) count
// everywhere except APP_ENV=production.
//
// POST <RevenueCat event>   (Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>)
//   → { data: { synced: [{ userId, granted: string[], revoked: string[] }] } }   granted/revoked: pack slugs
//   → { error: { code, message } }   401 wrong secret, 400 not an event, 502/503 RevenueCat unavailable
// Any non-200 makes RevenueCat retry the event later (up to 5 times).
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { fail, ok, readJson } from '../_shared/http.ts';

export const REVENUECAT_API = 'https://api.revenuecat.com/v1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Event = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string().optional(),
    original_app_user_id: z.string().optional(),
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional(),
  }),
});

/** A verified one-time purchase, as store_purchases_sync takes it. */
export interface StorePurchase {
  product_id: string;
  transaction_id: string | null;
}

export interface SyncResult {
  granted: string[];
  revoked: string[];
}

/** The database side, as the service role. */
export interface PurchaseStore {
  /** Makes the user's purchase rows match `purchases`; null when the user doesn't exist. */
  sync(userId: string, purchases: StorePurchase[]): Promise<SyncResult | null>;
}

/** RevenueCat's REST API: the buyer's verified one-time purchases. */
export interface RevenueCat {
  purchases(appUserId: string): Promise<StorePurchase[]>;
}

export class RevenueCatUnavailable extends Error {}

export interface WebhookDeps {
  secret: () => string;
  store: () => PurchaseStore;
  revenuecat: () => RevenueCat;
}

export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The Pickld users an event concerns: uuid-shaped ids only, each once. */
export function usersOf(event: z.infer<typeof Event>['event']): string[] {
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ];
  return [...new Set(ids.filter((id): id is string => !!id && UUID.test(id)).map((id) => id.toLowerCase()))];
}

export async function handleRevenueCatWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const secret = deps.secret();
  const given = req.headers.get('authorization') ?? '';
  if (secret.length < 32 || !sameSecret(given, `Bearer ${secret}`)) return fail(401, 'unauthorized', 'Not allowed.');

  const body = await readJson(req);
  const parsed = Event.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid_event', 'The body is not a RevenueCat event.');

  // The dashboard's "Send test event" checks the connection only.
  if (parsed.data.event.type === 'TEST') return ok({ synced: [] });

  const users = usersOf(parsed.data.event);
  const revenuecat = deps.revenuecat();
  const store = deps.store();
  const synced: ({ userId: string } & SyncResult)[] = [];
  try {
    for (const userId of users) {
      const result = await syncUser(userId, revenuecat, store);
      if (result) synced.push({ userId, ...result });
    }
  } catch (e) {
    if (e instanceof RevenueCatUnavailable) return fail(503, 'revenuecat_unavailable', 'Try again later.');
    throw e;
  }
  return ok({ synced });
}

/** Reads the user's verified purchases and makes owned_packs match. Shared with the app-facing sync. */
export async function syncUser(userId: string, revenuecat: RevenueCat, store: PurchaseStore) {
  return store.sync(userId, await revenuecat.purchases(userId));
}

const Subscriber = z.object({
  subscriber: z.object({
    non_subscriptions: z.record(
      z.string(),
      z.array(z.object({
        id: z.string().optional(),
        store_transaction_id: z.string().nullish(),
        is_sandbox: z.boolean().optional(),
      })),
    ).default({}),
  }),
});

/**
 * The REST client. `allowSandbox` is false in production, so a sandbox receipt never unlocks a pack there.
 * Network failures, 429 and 5xx become RevenueCatUnavailable (the webhook answers 503 and RevenueCat retries).
 */
export function revenueCatClient(
  secretKey: string,
  opts: { allowSandbox: boolean; baseUrl?: string; fetcher?: typeof fetch },
): RevenueCat {
  const fetcher = opts.fetcher ?? fetch;
  const base = opts.baseUrl ?? REVENUECAT_API;
  return {
    async purchases(appUserId) {
      let res: Response;
      try {
        res = await fetcher(`${base}/subscribers/${encodeURIComponent(appUserId)}`, {
          headers: { authorization: `Bearer ${secretKey}`, accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        throw new RevenueCatUnavailable('network');
      }
      if (res.status === 429 || res.status >= 500) throw new RevenueCatUnavailable(String(res.status));
      if (!res.ok) throw new Error(`revenuecat subscribers: ${res.status}`);
      const parsed = Subscriber.safeParse(await res.json());
      if (!parsed.success) throw new Error('revenuecat subscribers: unexpected body');
      const out: StorePurchase[] = [];
      for (const [productId, list] of Object.entries(parsed.data.subscriber.non_subscriptions)) {
        for (const p of list) {
          if (p.is_sandbox && !opts.allowSandbox) continue;
          out.push({ product_id: productId, transaction_id: p.store_transaction_id ?? p.id ?? null });
        }
      }
      return out;
    },
  };
}

export function serviceStore(db: SupabaseClient): PurchaseStore {
  return {
    async sync(userId, purchases) {
      const { data, error } = await db.rpc('store_purchases_sync', { p_user: userId, p_purchases: purchases });
      if (error) throw new Error(`store_purchases_sync: ${error.message}`);
      return (data ?? null) as SyncResult | null;
    },
  };
}
