// Short-lived photo tokens (D-12, NFR-SEC-02). fn:photo-urls signs, the photo Worker verifies.
// A photo URL is `<PHOTO_BASE_URL>/<object key>?exp=<unix seconds>&sig=<base64url HMAC-SHA256>`.
// The signature covers the object key and the expiry, so a token can't be moved to another photo or
// extended. Plain Web Crypto: runs in Deno (Edge Functions, tests) and Cloudflare Workers.

/** The longest lifetime the Worker accepts. fn:photo-urls issues 15-minute tokens. */
export const MAX_TOKEN_TTL_SECONDS = 60 * 60;

export type TokenCheck = 'ok' | 'missing' | 'invalid' | 'expired';

const encoder = new TextEncoder();

function message(key: string, exp: number): Uint8Array<ArrayBuffer> {
  return encoder.encode(`pickld-photo-v1\n${key}\n${exp}`);
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('photo token secret must be at least 32 characters');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Signs a token for one object key, valid for ttlSeconds from now (unix seconds). */
export async function signPhotoToken(
  key: string,
  secret: string,
  ttlSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): Promise<{ exp: number; sig: string }> {
  if (ttlSeconds <= 0 || ttlSeconds > MAX_TOKEN_TTL_SECONDS) throw new Error('photo token TTL out of range');
  const exp = now + ttlSeconds;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), message(key, exp)));
  return { exp, sig: toBase64Url(sig) };
}

/** Full photo URL for an object key. */
export async function signPhotoUrl(
  baseUrl: string,
  key: string,
  secret: string,
  ttlSeconds: number,
  now?: number,
): Promise<{ url: string; exp: number }> {
  const { exp, sig } = await signPhotoToken(key, secret, ttlSeconds, now);
  const path = key.split('/').map(encodeURIComponent).join('/');
  return { url: `${baseUrl.replace(/\/+$/, '')}/${path}?exp=${exp}&sig=${sig}`, exp };
}

/** Checks a token. The signature is verified in constant time by Web Crypto. */
export async function verifyPhotoToken(
  key: string,
  exp: string | null,
  sig: string | null,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<TokenCheck> {
  if (!exp || !sig) return 'missing';
  if (!/^\d{1,12}$/.test(exp)) return 'invalid';
  const expiry = Number(exp);
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes || sigBytes.length !== 32) return 'invalid';
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sigBytes, message(key, expiry));
  if (!valid) return 'invalid';
  if (expiry <= now) return 'expired';
  if (expiry > now + MAX_TOKEN_TTL_SECONDS) return 'invalid';
  return 'ok';
}
