// fn:store-sync (M6-03, M6-04; FR-STK-07, FR-STK-08). The app calls it right after a purchase or a Restore
// purchases tap: it reads the caller's verified purchases back from RevenueCat and makes their purchase rows
// in owned_packs match, exactly as fn:revenuecat-webhook does (D-40). The app never says what it bought; the
// webhook does the same work moments later, so a lost call only delays the unlock.
//
// Local builds (APP_ENV=local and no REVENUECAT_SECRET_KEY) have no store. There the dev store's purchase
// sends `devProductId`, which is added to the caller's existing purchases so a pack can be bought and
// checked on the Simulator. Every other environment rejects `devProductId`.
//
// POST {} | { devProductId }   (Authorization: Bearer <user JWT>)
//   → { data: { granted: string[], revoked: string[] } }   pack slugs
//   → { error: { code, message } }   401 not signed in, 400 bad body, 503 RevenueCat unavailable
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import {
  type PurchaseStore,
  type RevenueCat,
  RevenueCatUnavailable,
  type StorePurchase,
  syncUser,
} from '../revenuecat-webhook/handler.ts';

export const StoreSyncInput = z.strictObject({ devProductId: z.string().min(1).max(200).optional() });

export interface StoreSyncDeps {
  userClient: (jwt: string) => SupabaseClient;
  store: () => PurchaseStore;
  /** The real RevenueCat client, or null in a local build without a key (then the dev store is used). */
  revenuecat: () => RevenueCat | null;
  /** The caller's current purchase rows, for the local dev store. */
  currentPurchases: (userId: string) => Promise<StorePurchase[]>;
}

export async function handleStoreSync(req: Request, deps: StoreSyncDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const { data: auth, error: authError } = await deps.userClient(jwt).auth.getUser(jwt);
  if (authError || !auth.user) return fail(401, 'unauthorized', 'Sign in first.');
  const userId = auth.user.id;

  const parsed = StoreSyncInput.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail(400, 'invalid_input', 'Send {} or { devProductId }.');

  const real = deps.revenuecat();
  if (real && parsed.data.devProductId) return fail(400, 'invalid_input', 'Only local builds take devProductId.');
  const revenuecat: RevenueCat = real ?? devRevenueCat(deps.currentPurchases, parsed.data.devProductId);

  try {
    const result = await syncUser(userId, revenuecat, deps.store());
    return ok(result ?? { granted: [], revoked: [] });
  } catch (e) {
    if (e instanceof RevenueCatUnavailable) return fail(503, 'revenuecat_unavailable', 'Try again later.');
    throw e;
  }
}

/** The local dev store: the caller's purchases so far, plus the product just bought. */
export function devRevenueCat(
  current: (userId: string) => Promise<StorePurchase[]>,
  bought: string | undefined,
): RevenueCat {
  return {
    async purchases(userId) {
      const list = await current(userId);
      return bought && !list.some((p) => p.product_id === bought)
        ? [...list, { product_id: bought, transaction_id: `dev-${crypto.randomUUID()}` }]
        : list;
    },
  };
}

/** Purchase rows already in owned_packs, read as the service role (local dev store only). */
export function servicePurchases(db: SupabaseClient) {
  return async (userId: string): Promise<StorePurchase[]> => {
    const { data, error } = await db
      .from('owned_packs')
      .select('store_transaction_id, sticker_packs!inner(store_product_id)')
      .eq('user_id', userId)
      .eq('source', 'purchase');
    if (error) throw new Error(`owned_packs: ${error.message}`);
    const rows = (data ?? []) as unknown as {
      store_transaction_id: string | null;
      sticker_packs: { store_product_id: string | null };
    }[];
    return rows.flatMap((r) =>
      r.sticker_packs.store_product_id
        ? [{ product_id: r.sticker_packs.store_product_id, transaction_id: r.store_transaction_id }]
        : []
    );
  };
}
