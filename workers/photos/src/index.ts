// Cloudflare Worker entry point: photos.pickld.me (staging: photos-staging.pickld.me), in front of R2.
// Bindings and secrets are set in wrangler.toml and with `wrangler secret put` (README.md).
import { handlePhotoRequest } from './handler.ts';
import { type R2BucketLike, r2Store } from './stores.ts';

export interface Env {
  PHOTOS: R2BucketLike;
  PHOTO_TOKEN_SECRET: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handlePhotoRequest(request, r2Store(env.PHOTOS), env.PHOTO_TOKEN_SECRET);
  },
};
