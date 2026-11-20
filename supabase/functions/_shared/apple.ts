// Sign in with Apple's REST API (FR-ACC-01, FR-PRV-03; Apple TN3194). Signing in itself needs none of this: the app
// sends Apple's identity token straight to Supabase Auth. This is only for revoking the person's Sign in with Apple
// link when their account is deleted (App Store Review Guideline 5.1.1(v)): fn:apple-token trades the one-time
// authorization code for a refresh token right after sign-in, and the purges revoke it.
//
// Secrets: APPLE_TEAM_ID, APPLE_SIGN_IN_KEY_ID and APPLE_SIGN_IN_KEY (the .p8 key's contents; its BEGIN/END lines
// and line breaks are optional). Without them nothing is stored or revoked and sign-in still works.
import type { SupabaseClient } from './deps.ts';

const APPLE = 'https://appleid.apple.com';
/** The bundle ids Apple issues codes to: the store app and the local variant (apps/mobile/app.config.ts). */
export const APPLE_CLIENT_IDS = ['me.pickld.app', 'me.pickld.app.local'] as const;

export interface AppleKey {
  teamId: string;
  keyId: string;
  /** PKCS#8 private key, base64 (the .p8 file without its BEGIN/END lines). */
  key: string;
}

export function appleKeyFromEnv(): AppleKey | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_SIGN_IN_KEY_ID');
  const key = Deno.env.get('APPLE_SIGN_IN_KEY')?.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return teamId && keyId && key ? { teamId, keyId, key } : null;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s: string) => b64url(new TextEncoder().encode(s));

/** The client secret Apple asks for: an ES256 JWT signed with the key, minted per request and valid 5 minutes. */
export async function appleClientSecret(k: AppleKey, clientId: string, now = Date.now()): Promise<string> {
  const der = Uint8Array.from(atob(k.key), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const iat = Math.floor(now / 1000);
  const input = `${text(JSON.stringify({ alg: 'ES256', kid: k.keyId }))}.${
    text(JSON.stringify({ iss: k.teamId, iat, exp: iat + 300, aud: APPLE, sub: clientId }))
  }`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

async function post(path: string, form: Record<string, string>, fetcher: typeof fetch): Promise<Response> {
  return await fetcher(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
}

/** Trades an authorization code (single use, 5 minutes) for a refresh token and the Apple user id it belongs to. */
export async function exchangeAppleCode(
  k: AppleKey,
  clientId: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<{ refreshToken: string; sub: string }> {
  const res = await post('/auth/token', {
    client_id: clientId,
    client_secret: await appleClientSecret(k, clientId),
    code,
    grant_type: 'authorization_code',
  }, fetcher);
  if (!res.ok) throw new Error(`apple token: ${res.status}`);
  const body = await res.json() as { refresh_token?: string; id_token?: string };
  // The ID token comes straight from Apple over TLS in answer to our signed request, so its claims are read as is.
  const payload = body.id_token?.split('.')[1];
  const sub = payload
    ? (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string }).sub
    : undefined;
  if (!body.refresh_token || !sub) throw new Error('apple token: incomplete answer');
  return { refreshToken: body.refresh_token, sub };
}

/**
 * Revokes the account's stored Sign in with Apple token, if it has one, before the account is purged. Never throws:
 * a missing key or an Apple outage must not stop a deletion. The row itself goes with the auth user (0171).
 */
export async function revokeAppleToken(
  db: SupabaseClient,
  userId: string,
  k: AppleKey | null = appleKeyFromEnv(),
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!k) return;
  try {
    const { data } = await db.from('apple_tokens').select('client_id, refresh_token').eq('user_id', userId)
      .maybeSingle();
    if (!data) return;
    const res = await post('/auth/revoke', {
      client_id: data.client_id,
      client_secret: await appleClientSecret(k, data.client_id),
      token: data.refresh_token,
      token_type_hint: 'refresh_token',
    }, fetcher);
    if (!res.ok) console.warn(`apple revoke: ${res.status}`);
  } catch (e) {
    console.warn(`apple revoke: ${e instanceof Error ? e.message : 'failed'}`);
  }
}
