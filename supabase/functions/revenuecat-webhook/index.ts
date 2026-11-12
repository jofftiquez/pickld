import { revenueCatAllowSandbox, revenueCatSecretKey, revenueCatWebhookSecret, serviceClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleRevenueCatWebhook, revenueCatClient, serviceStore } from './handler.ts';

Deno.serve(
  withSentry('revenuecat-webhook', (req) =>
    handleRevenueCatWebhook(req, {
      secret: revenueCatWebhookSecret,
      store: () => serviceStore(serviceClient()),
      revenuecat: () =>
        revenueCatClient(revenueCatSecretKey(), {
          allowSandbox: revenueCatAllowSandbox(),
          baseUrl: Deno.env.get('REVENUECAT_API_URL') || undefined,
        }),
    })),
);
