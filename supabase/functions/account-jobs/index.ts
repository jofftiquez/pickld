import { accountJobsSecret, s3ServerConfigFromEnv, serviceClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleAccountJobs, serviceStore } from './handler.ts';

Deno.serve(
  withSentry('account-jobs', (req) =>
    handleAccountJobs(req, {
      store: () => serviceStore(serviceClient(), s3ServerConfigFromEnv()),
      secret: accountJobsSecret,
    })),
);
