// Sign in with Apple token keeping and revoking (_shared/apple.ts, fn:apple-token). No network: Apple is a fake
// fetch, and the key is a P-256 pair made here, so the client secret's signature can be checked for real.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from '../_shared/deps.ts';
import { appleClientSecret, type AppleKey, exchangeAppleCode, revokeAppleToken } from '../_shared/apple.ts';
import { handleAppleToken } from '../apple-token/handler.ts';
import { request } from './local.ts';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const key: AppleKey = { teamId: 'TEAM123456', keyId: 'KEY1234567', key: btoa(String.fromCharCode(...pkcs8)) };

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const claims = (jwt: string) => JSON.parse(new TextDecoder().decode(fromB64url(jwt.split('.')[1])));
const idToken = (sub: string) => `x.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.y`;

/** A fake Apple that records each form it gets and answers with `answer`. */
function fakeApple(answer: () => Response) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  const fetcher = ((url: string, init: RequestInit) => {
    calls.push({ url, form: init.body as URLSearchParams });
    return Promise.resolve(answer());
  }) as typeof fetch;
  return { calls, fetcher };
}

Deno.test('the client secret is an ES256 JWT from the team, for the bundle id, that the key verifies', async () => {
  const now = Date.UTC(2026, 10, 20, 12);
  const jwt = await appleClientSecret(key, 'me.pickld.app.local', now);
  const [h, p, s] = jwt.split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(fromB64url(h))), { alg: 'ES256', kid: 'KEY1234567' });
  assertEquals(claims(jwt), {
    iss: 'TEAM123456',
    iat: now / 1000,
    exp: now / 1000 + 300,
    aud: 'https://appleid.apple.com',
    sub: 'me.pickld.app.local',
  });
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.publicKey,
    fromB64url(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  assert(ok, 'the signature verifies with the public key');
});

Deno.test('a code is traded for the refresh token and the Apple user it belongs to', async () => {
  const apple = fakeApple(() => Response.json({ refresh_token: 'r-1', id_token: idToken('apple-sub-1') }));
  assertEquals(await exchangeAppleCode(key, 'me.pickld.app', 'code-1', apple.fetcher), {
    refreshToken: 'r-1',
    sub: 'apple-sub-1',
  });
  const { url, form } = apple.calls[0];
  assertEquals(url, 'https://appleid.apple.com/auth/token');
  assertEquals([form.get('client_id'), form.get('code'), form.get('grant_type')], [
    'me.pickld.app',
    'code-1',
    'authorization_code',
  ]);
  assertEquals(claims(form.get('client_secret')!).sub, 'me.pickld.app');
});

/** Just enough of a service-role client for revokeAppleToken: apple_tokens rows by user id. */
function tokenDb(rows: Record<string, { client_id: string; refresh_token: string }>): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({ maybeSingle: () => Promise.resolve({ data: rows[id] ?? null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

Deno.test('deleting revokes the stored token with the bundle id it was issued to', async () => {
  const apple = fakeApple(() => new Response(null, { status: 200 }));
  const db = tokenDb({ u1: { client_id: 'me.pickld.app.local', refresh_token: 'r-1' } });
  await revokeAppleToken(db, 'u1', key, apple.fetcher);
  assertEquals(apple.calls.length, 1);
  const { url, form } = apple.calls[0];
  assertEquals(url, 'https://appleid.apple.com/auth/revoke');
  assertEquals([form.get('client_id'), form.get('token'), form.get('token_type_hint')], [
    'me.pickld.app.local',
    'r-1',
    'refresh_token',
  ]);
  assertEquals(claims(form.get('client_secret')!).sub, 'me.pickld.app.local');
});

Deno.test('revoking never stops a deletion: no token, no key, or Apple down all return quietly', async () => {
  const down = fakeApple(() => {
    throw new Error('network');
  });
  const db = tokenDb({ u1: { client_id: 'me.pickld.app', refresh_token: 'r-1' } });
  await revokeAppleToken(db, 'u1', key, down.fetcher);
  await revokeAppleToken(db, 'u1', key, fakeApple(() => new Response(null, { status: 500 })).fetcher);
  const unused = fakeApple(() => new Response(null));
  await revokeAppleToken(db, 'someone-else', key, unused.fetcher);
  await revokeAppleToken(db, 'u1', null, unused.fetcher);
  assertEquals(unused.calls.length, 0);
});

// ---------------------------------------------------------------- fn:apple-token
function deps(identities: { provider: string; id: string }[], opts: { key?: AppleKey | null; sub?: string } = {}) {
  const stored: unknown[] = [];
  return {
    stored,
    deps: {
      userClient: () =>
        ({
          auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', identities } } }) },
        }) as unknown as SupabaseClient,
      key: () => (opts.key === undefined ? key : opts.key),
      exchange: () => Promise.resolve({ refreshToken: 'r-1', sub: opts.sub ?? 'apple-sub-1' }),
      store: (...row: unknown[]) => {
        stored.push(row);
        return Promise.resolve();
      },
    },
  };
}
const call = async (d: ReturnType<typeof deps>['deps'], body: unknown = { code: 'c', clientId: 'me.pickld.app' }) => {
  const res = await handleAppleToken(request('apple-token', { jwt: 'jwt', body }), d);
  return { status: res.status, json: await res.json() };
};

Deno.test('fn:apple-token keeps the token for the caller’s own Apple identity', async () => {
  const d = deps([{ provider: 'email', id: 'e' }, { provider: 'apple', id: 'apple-sub-1' }]);
  assertEquals(await call(d.deps), { status: 200, json: { data: { stored: true } } });
  assertEquals(d.stored, [['u1', 'me.pickld.app', 'r-1']]);
});

Deno.test('fn:apple-token refuses a code from another Apple account, an email-only account and other apps', async () => {
  const other = deps([{ provider: 'apple', id: 'apple-sub-1' }], { sub: 'apple-sub-2' });
  assertEquals((await call(other.deps)).status, 403);
  const email = deps([{ provider: 'email', id: 'e' }]);
  assertEquals((await call(email.deps)).status, 403);
  const app = deps([{ provider: 'apple', id: 'apple-sub-1' }]);
  assertEquals((await call(app.deps, { code: 'c', clientId: 'com.example.other' })).status, 400);
  assertEquals([...other.stored, ...email.stored, ...app.stored], []);
});

Deno.test('fn:apple-token stores nothing until the Apple key is set', async () => {
  const d = deps([{ provider: 'apple', id: 'apple-sub-1' }], { key: null });
  assertEquals(await call(d.deps), { status: 200, json: { data: { stored: false } } });
  assertEquals(d.stored, []);
});
