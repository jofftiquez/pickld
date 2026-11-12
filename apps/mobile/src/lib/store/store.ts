// The app store as Pickld uses it (FR-STK-07): localized prices for sticker pack products, and (M6-03) buying
// and restoring them. Purchases go through RevenueCat in builds that have its public key; a pack unlocks when
// fn:revenuecat-webhook (or the app's sync call) reads the verified purchase back from RevenueCat (D-40), so
// the app never decides ownership itself. Local builds without a key use the dev store (devStore.ts).
import { readMonitoringEnv } from '@/lib/env';

import { devStore } from './devStore';

/** A store product as the shop shows it: `price` is the store's localized string, e.g. "₱49". */
export type StoreProduct = { id: string; price: string };

export interface Store {
  /** Prices for these products; products the store doesn't know are left out. */
  products(ids: readonly string[]): Promise<StoreProduct[]>;
}

/** No store in this build (no RevenueCat key outside local): nothing has a price, so nothing can be bought. */
const noStore: Store = {
  products: () => Promise.resolve([]),
};

let current: Store | undefined;

export function getStore(): Store {
  current ??= readMonitoringEnv().EXPO_PUBLIC_APP_ENV === 'local' ? devStore : noStore;
  return current;
}

/** Tests swap the store. */
export function setStoreForTesting(store: Store | undefined): void {
  current = store;
}
