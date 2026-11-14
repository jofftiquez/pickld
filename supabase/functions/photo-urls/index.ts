import { photoBaseUrl, photoTokenSecret, serviceClient, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handlePhotoUrls } from './handler.ts';

Deno.serve(
  withSentry(
    'photo-urls',
    (req) => handlePhotoUrls(req, { userClient, serviceClient, photoBaseUrl, tokenSecret: photoTokenSecret }),
  ),
);
