// The app store as Pickld uses it (FR-STK-07, FR-STK-08): localized prices for sticker pack products, and
// buying and restoring them. Purchases go through RevenueCat in builds that have its public iOS key; a pack
// unlocks when fn:store-sync (or fn:revenuecat-webhook) reads the verified purchase back from RevenueCat
// (D-40), so the app never decides ownership itself. Local builds without a key use the dev store
// (devStore.ts); other builds without a key sell nothing.
import { z } from 'zod';

import { readMonitoringEnv } from '@/lib/env';

import { devStore } from './devStore';

/** A store product as the shop shows it: `price` is the store's localized string, e.g. "₱49". */
export type StoreProduct = { id: string; price: string };

/**
 * What a purchase did. `bought` asks fn:store-sync to unlock; `devProductId` is set only by the local dev
 * store, which has no receipts for the server to read.
 */
export type PurchaseResult = { status: 'bought'; devProductId?: string } | { status: 'cancelled' };

export interface Store {
  /** Prices for these products; products the store doesn't know are left out. */
  products(ids: readonly string[]): Promise<StoreProduct[]>;
  /** Buys one product for `userId`. Throws when the store fails; a user who backs out gets `cancelled`. */
  purchase(productId: string, userId: string): Promise<PurchaseResult>;
  /** Asks the store to restore earlier purchases to `userId` (fn:store-sync then reads them). */
  restore(userId: string): Promise<void>;
}

/** No store in this build: nothing has a price, so nothing can be bought. */
const noStore: Store = {
  products: () => Promise.resolve([]),
  purchase: () => Promise.reject(new Error('no store in this build')),
  restore: () => Promise.resolve(),
};

// RevenueCat's public SDK key for the App Store app (starts with appl_); safe to bundle. Read as a literal so
// Expo inlines it.
const revenueCatKey = z.string().startsWith('appl_').safeParse(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY);

let current: Store | undefined;

export function getStore(): Store {
  if (!current) {
    if (revenueCatKey.success) {
      // Loaded only here, so builds without a key never touch the native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { revenueCatStore } = require('./revenueCatStore') as typeof import('./revenueCatStore');
      current = revenueCatStore(revenueCatKey.data);
    } else {
      current = readMonitoringEnv().EXPO_PUBLIC_APP_ENV === 'local' ? devStore : noStore;
    }
  }
  return current;
}

/** Tests swap the store. */
export function setStoreForTesting(store: Store | undefined): void {
  current = store;
}
