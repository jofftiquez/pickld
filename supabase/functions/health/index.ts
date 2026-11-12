import { s3ServerConfigFromEnv, serviceClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { dbCheck, handleHealth, storageCheck } from './handler.ts';

Deno.serve(
  withSentry('health', (req) =>
    handleHealth(req, {
      checks: { db: dbCheck(serviceClient()), storage: storageCheck(s3ServerConfigFromEnv()) },
      report: (name, error) => console.error(`health: ${name} failed`, error instanceof Error ? error.message : ''),
    })),
);
