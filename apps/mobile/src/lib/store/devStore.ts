// The local dev store (APP_ENV=local, no RevenueCat key): every pack product costs ₱49, the design's price, so
// the shop can be built and checked on the Simulator without the founders' store accounts.
import type { Store } from './store';

export const DEV_PRICE = '₱49';

export const devStore: Store = {
  products: (ids) => Promise.resolve(ids.map((id) => ({ id, price: DEV_PRICE }))),
};
