import { s3ServerConfigFromEnv, userClient } from '../_shared/env.ts';
import { withSentry } from '../_shared/sentry.ts';
import { handleStickerStudio } from './handler.ts';

Deno.serve(withSentry('sticker-studio', (req) => handleStickerStudio(req, { s3: s3ServerConfigFromEnv, userClient })));
