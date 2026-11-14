import { s3ConfigFromEnv, serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleUploadUrl } from './handler.ts';

Deno.serve(withSentry('upload-url', (req) => handleUploadUrl(req, { s3: s3ConfigFromEnv, serviceClient, userClient })));
