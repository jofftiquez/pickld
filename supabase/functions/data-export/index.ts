import { s3ConfigFromEnv, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleDataExport } from './handler.ts';

Deno.serve(withSentry('data-export', (req) => handleDataExport(req, { userClient, s3: s3ConfigFromEnv })));
