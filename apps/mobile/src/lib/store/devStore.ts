// The local dev store (APP_ENV=local, no RevenueCat key): every pack product costs ₱49, the design's price,
// and buying one always succeeds, so the shop and Pack preview can be built and checked on the Simulator
// without the founders' store accounts. fn:store-sync takes `devProductId` only in a local server build.
import type { Store } from './store';

export const DEV_PRICE = '₱49';

export const devStore: Store = {
  products: (ids) => Promise.resolve(ids.map((id) => ({ id, price: DEV_PRICE }))),
  purchase: (productId) => Promise.resolve({ status: 'bought', devProductId: productId }),
  restore: () => Promise.resolve(),
};
