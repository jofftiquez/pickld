// fn:invite with an in-memory invite_check(). The SQL behind it (who may call it, unavailable for every
// unusable case, 20 per IP hash an hour, never using the code) is pinned in pgTAP 133; this file covers the
// input, which IP is hashed, the answers and the avatar URL.
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { type CheckResult, handleInvite, inviteIpHash } from '../invite/handler.ts';
import { verifyPhotoToken } from '../_shared/photo_token.ts';

const KEY = 'invite-hash-key-at-least-32-characters!!';
const FORWARD = 'waitlist-secret-at-least-32-characters!!';
const TOKEN_SECRET = 'photo-token-secret-at-least-32-characters';
const BASE = 'http://photos.test';
const OWNER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_800_000_000;

function setup(answer: CheckResult, forward: string | null = FORWARD) {
  const calls: { token: string; ipHash: string }[] = [];
  const deps = {
    hashKey: () => KEY,
    forwardSecret: () => forward,
    check: (token: string, ipHash: string) => (calls.push({ token, ipHash }), Promise.resolve(answer)),
    photoBaseUrl: () => BASE,
    tokenSecret: () => TOKEN_SECRET,
    now: () => NOW,
  };
  return { calls, deps };
}

async function post(
  deps: ReturnType<typeof setup>['deps'],
  body: unknown,
  headers: Record<string, string> = { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
  method = 'POST',
  // deno-lint-ignore no-explicit-any
): Promise<{ status: number; json: any }> {
  const res = await handleInvite(
    new Request('http://fn.local/invite', {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    deps,
  );
  return { status: res.status, json: await res.json() };
}

const personal = (avatar_path: string | null): CheckResult => ({
  result: 'ok',
  kind: 'personal',
  inviter: { id: OWNER, username: 'joff', display_name: 'Joff', avatar_path },
});

Deno.test('a personal code names its owner, with a signed avatar URL, and drops their id', async () => {
  const key = `avatars/${OWNER}/${crypto.randomUUID()}.jpg`;
  const { calls, deps } = setup(personal(key));
  const { status, json } = await post(deps, { token: ' xadxfg ' });
  assertEquals(status, 200);
  assertEquals(calls[0].token, 'XADXFG');
  assertEquals(json.data.kind, 'personal');
  assertEquals(json.data.inviter.username, 'joff');
  assertEquals(json.data.inviter.display_name, 'Joff');
  assertEquals('id' in json.data.inviter, false);
  const url = new URL(json.data.inviter.avatar);
  assertEquals(url.origin + url.pathname, `${BASE}/${key}`);
  assertEquals(url.searchParams.get('exp'), String(NOW + 15 * 60));
  assertEquals(
    await verifyPhotoToken(key, url.searchParams.get('exp'), url.searchParams.get('sig'), TOKEN_SECRET, NOW + 60),
    'ok',
  );
});

Deno.test('a link is looked up the same way', async () => {
  const { calls, deps } = setup(personal(null));
  const { status, json } = await post(deps, { token: 'abcdefghjk' });
  assertEquals(status, 200);
  assertEquals(calls[0].token, 'ABCDEFGHJK');
  assertEquals(json.data.inviter.avatar, null);
});

Deno.test("an avatar key that isn't the owner's own is never signed", async () => {
  const { deps } = setup(personal(`avatars/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`));
  assertEquals((await post(deps, { token: 'XADXFG' })).json.data.inviter.avatar, null);
});

Deno.test('admin and waitlist codes name no inviter', async () => {
  const { json } = await post(setup({ result: 'ok', kind: 'admin', inviter: null }).deps, { token: 'ADMN44' });
  assertEquals(json.data, { kind: 'admin', inviter: null });
});

Deno.test('every unusable case is one unavailable', async () => {
  const { status, json } = await post(setup({ result: 'unavailable' }).deps, { token: 'ZZZZZZ' });
  assertEquals(status, 404);
  assertEquals(json.error.code, 'unavailable');
});

Deno.test('too many checks from one IP', async () => {
  const { status, json } = await post(setup({ result: 'limited' }).deps, { token: 'ZZZZZZ' });
  assertEquals(status, 429);
  assertEquals(json.error.code, 'rate_limited');
});

Deno.test('bad input never reaches invite_check', async () => {
  const { calls, deps } = setup(personal(null));
  for (
    const body of [{}, { token: 'ABC' }, { token: 'ABCDEFG' }, { token: 'ABC-EF' }, { token: 'XADXFG', x: 1 }, 'x']
  ) {
    assertEquals((await post(deps, body)).status, 400, JSON.stringify(body));
  }
  assertEquals((await post(deps, { token: 'XADXFG' }, {})).status, 400, 'no IP');
  assertEquals((await post(deps, null, undefined, 'GET')).status, 405);
  assertEquals(calls.length, 0);
});

Deno.test('the IP is hashed, the first x-forwarded-for entry by default', async () => {
  const { calls, deps } = setup(personal(null));
  await post(deps, { token: 'XADXFG' });
  assertEquals(calls[0].ipHash, await inviteIpHash(KEY, '198.51.100.4'));
  assert(/^[0-9a-f]{64}$/.test(calls[0].ipHash));
  assertNotEquals(await inviteIpHash(KEY, '198.51.100.4'), await inviteIpHash(KEY, '198.51.100.5'));
});

Deno.test("pickld.me's server passes the visitor IP with the secret, and only with it", async () => {
  const { calls, deps } = setup(personal(null));
  const server = { 'x-forwarded-for': '76.76.21.21', 'x-client-ip': '203.0.113.7' };
  await post(deps, { token: 'XADXFG' }, { ...server, 'x-waitlist-secret': FORWARD });
  await post(deps, { token: 'XADXFG' }, { ...server, 'x-waitlist-secret': 'wrong' });
  assertEquals(calls[0].ipHash, await inviteIpHash(KEY, '203.0.113.7'));
  assertEquals(calls[1].ipHash, await inviteIpHash(KEY, '76.76.21.21'));

  const unset = setup(personal(null), null);
  await post(unset.deps, { token: 'XADXFG' }, { ...server, 'x-waitlist-secret': '' });
  assertEquals(unset.calls[0].ipHash, await inviteIpHash(KEY, '76.76.21.21'));
});
