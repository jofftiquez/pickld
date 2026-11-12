import { s3ConfigFromEnv, serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleAccountPurge, serviceStore } from './handler.ts';

Deno.serve(
  withSentry(
    'account-purge',
    (req) => handleAccountPurge(req, { userClient, store: () => serviceStore(serviceClient(), s3ConfigFromEnv()) }),
  ),
);
