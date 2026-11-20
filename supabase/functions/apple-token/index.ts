import { appleKeyFromEnv, exchangeAppleCode } from '../_shared/apple.ts';
import { serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleAppleToken, serviceStore } from './handler.ts';

Deno.serve(
  withSentry('apple-token', (req) =>
    handleAppleToken(req, {
      userClient,
      key: appleKeyFromEnv,
      exchange: exchangeAppleCode,
      store: serviceStore(serviceClient()),
    })),
);
