import { revenueCatAllowSandbox, serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { revenueCatClient, serviceStore } from '../revenuecat-webhook/handler.ts';
import { handleStoreSync, servicePurchases } from './handler.ts';

// Without REVENUECAT_SECRET_KEY only a local build runs (on the dev store); anywhere else that is a missing secret.
function revenuecat() {
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) {
    if ((Deno.env.get('APP_ENV') || 'local') === 'local') return null;
    throw new Error('missing environment variable REVENUECAT_SECRET_KEY');
  }
  return revenueCatClient(key, {
    allowSandbox: revenueCatAllowSandbox(),
    baseUrl: Deno.env.get('REVENUECAT_API_URL') || undefined,
  });
}

Deno.serve(
  withSentry('store-sync', (req) =>
    handleStoreSync(req, {
      userClient,
      store: () => serviceStore(serviceClient()),
      revenuecat,
      currentPurchases: (userId) => servicePurchases(serviceClient())(userId),
    })),
);
