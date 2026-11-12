import { anonClient, photoBaseUrl, photoTokenSecret } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handlePublicPage } from './handler.ts';

Deno.serve(
  withSentry(
    'public-page',
    (req) => handlePublicPage(req, { anonClient, photoBaseUrl, tokenSecret: photoTokenSecret }),
  ),
);
