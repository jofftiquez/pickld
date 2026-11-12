// The App Store through RevenueCat (M6-03; D-40). Sticker packs are one-time (non-consumable) products. The
// buyer is identified by their Pickld user id, which is what fn:store-sync and fn:revenuecat-webhook read.
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';

import type { Store } from './store';

export function revenueCatStore(apiKey: string): Store {
  let configuredFor: string | null = null;

  async function signIn(userId: string) {
    if (configuredFor === null) {
      Purchases.configure({ apiKey, appUserID: userId });
    } else if (configuredFor !== userId) {
      await Purchases.logIn(userId);
    }
    configuredFor = userId;
  }

  async function product(id: string): Promise<PurchasesStoreProduct> {
    const [found] = await Purchases.getProducts([id], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (!found) throw new Error(`unknown store product ${id}`);
    return found;
  }

  return {
    async products(ids) {
      // Prices don't depend on the user; an anonymous configure is enough before anyone signs in.
      if (configuredFor === null && !(await Purchases.isConfigured())) Purchases.configure({ apiKey });
      const list = await Purchases.getProducts([...ids], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      return list.map((p) => ({ id: p.identifier, price: p.priceString }));
    },
    async purchase(productId, userId) {
      await signIn(userId);
      try {
        await Purchases.purchaseStoreProduct(await product(productId));
        return { status: 'bought' };
      } catch (e) {
        if ((e as { userCancelled?: boolean }).userCancelled) return { status: 'cancelled' };
        throw e;
      }
    },
    async restore(userId) {
      await signIn(userId);
      await Purchases.restorePurchases();
    },
  };
}
