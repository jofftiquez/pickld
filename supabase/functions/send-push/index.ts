import { expoAccessToken, pushCronSecret, serviceClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { expoClient, handleSendPush, serviceStore } from './handler.ts';

Deno.serve(
  withSentry('send-push', (req) =>
    handleSendPush(req, {
      store: () => serviceStore(serviceClient()),
      expo: () => expoClient(expoAccessToken()),
      secret: pushCronSecret,
    })),
);
