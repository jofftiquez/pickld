// The photo Worker's request handler (D-12, NFR-SEC-02). It serves an object only when the URL carries
// a valid, unexpired token from fn:photo-urls; everything else gets 403. It never writes: uploads go
// straight to the bucket with presigned URLs from fn:upload-url, each under a new key.
import { isObjectKey } from '../../../supabase/functions/_shared/object_keys.ts';
import { verifyPhotoToken } from '../../../supabase/functions/_shared/photo_token.ts';

export interface StoredObject {
  body: ReadableStream<Uint8Array> | null;
  contentType?: string;
  etag?: string;
  size?: number;
}

/** Read-only view of the bucket: R2 in staging/production, S3-compatible storage locally. */
export interface PhotoStore {
  get(key: string): Promise<StoredObject | null>;
}

const SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

function plain(status: number, text: string, extra: Record<string, string> = {}): Response {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...extra },
  });
}

export async function handlePhotoRequest(
  request: Request,
  store: PhotoStore,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'Method not allowed', { allow: 'GET, HEAD' });
  }
  const url = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return plain(403, 'Forbidden');
  }
  // A malformed key gets the same answer as a bad token, so the Worker doesn't reveal which keys exist.
  if (!isObjectKey(key)) return plain(403, 'Forbidden');
  const check = await verifyPhotoToken(key, url.searchParams.get('exp'), url.searchParams.get('sig'), secret, now);
  if (check !== 'ok') return plain(403, 'Forbidden');

  const object = await store.get(key);
  if (!object) return plain(404, 'Not found');

  const exp = Number(url.searchParams.get('exp'));
  const headers: Record<string, string> = {
    'content-type': object.contentType ?? 'image/jpeg',
    // The token is in the URL, so a cached copy is only reachable until the token expires.
    'cache-control': `private, max-age=${Math.max(0, exp - now)}`,
    ...SECURITY_HEADERS,
  };
  if (object.etag) headers.etag = object.etag;
  if (object.size !== undefined) headers['content-length'] = String(object.size);
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}
