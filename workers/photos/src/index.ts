// Cloudflare Worker entry point: photos.pickld.me (staging: photos-staging.pickld.me), in front of R2.
// Bindings and secrets are set in wrangler.toml and with `wrangler secret put` (README.md).
import { type EdgeCache, handlePhotoRequest } from './handler.ts';
import { type R2BucketLike, r2Store } from './stores.ts';

export interface Env {
  PHOTOS: R2BucketLike;
  PHOTO_TOKEN_SECRET: string;
}

/** The part of the Worker's ExecutionContext used here. */
interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

// Cloudflare's default cache for this zone (Workers runtime only; not in Deno's types).
const edgeCache = () => (globalThis as unknown as { caches: { default: EdgeCache } }).caches.default;

export default {
  fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return handlePhotoRequest(request, r2Store(env.PHOTOS), env.PHOTO_TOKEN_SECRET, undefined, {
      cache: edgeCache(),
      waitUntil: (promise) => ctx.waitUntil(promise),
    });
  },
};
