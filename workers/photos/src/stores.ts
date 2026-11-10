import type { PhotoStore } from './handler.ts';
import { presignObject, type S3Config } from '../../../supabase/functions/_shared/sigv4.ts';

/** The part of Cloudflare's R2Bucket binding the Worker uses (avoids a types dependency). */
export interface R2BucketLike {
  get(key: string): Promise<
    {
      body: ReadableStream<Uint8Array>;
      size: number;
      httpEtag: string;
      httpMetadata?: { contentType?: string };
    } | null
  >;
}

export function r2Store(bucket: R2BucketLike): PhotoStore {
  return {
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { body: obj.body, contentType: obj.httpMetadata?.contentType, etag: obj.httpEtag, size: obj.size };
    },
  };
}

/** Any S3-compatible bucket; locally the Supabase Storage S3 endpoint (docs: workers/photos/README.md). */
export function s3Store(cfg: S3Config, fetchFn: typeof fetch = fetch): PhotoStore {
  return {
    async get(key) {
      const url = await presignObject(cfg, key, { method: 'GET', expiresIn: 60 });
      const res = await fetchFn(url);
      if (res.status === 404 || res.status === 400) {
        await res.body?.cancel();
        return null;
      }
      if (!res.ok) throw new Error(`s3 get ${key}: ${res.status}`);
      const size = res.headers.get('content-length');
      return {
        body: res.body,
        contentType: res.headers.get('content-type') ?? undefined,
        etag: res.headers.get('etag') ?? undefined,
        size: size === null ? undefined : Number(size),
      };
    },
  };
}
