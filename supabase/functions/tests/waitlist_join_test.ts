// fn:waitlist-join with an in-memory join. The SQL behind waitlist_join() (one row per email, 5 per IP
// hash an hour, no client access) is pinned in pgTAP 071; this file covers the secret, input, IP hashing
// and that a repeat email looks the same as a new one.
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { handleWaitlistJoin, ipHash, type JoinResult } from '../waitlist-join/handler.ts';

const SECRET = 'waitlist-secret-at-least-32-characters!!';

function setup(result: JoinResult = 'joined') {
  const calls: { email: string; ipHash: string; source: string }[] = [];
  const deps = {
    secret: () => SECRET,
    join: (
      email: string,
      ipHash: string,
      source: string,
    ) => (calls.push({ email, ipHash, source }), Promise.resolve(result)),
  };
  return { calls, deps };
}

async function post(
  deps: ReturnType<typeof setup>['deps'],
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: { data?: unknown; error?: { code: string } } }> {
  const res = await handleWaitlistJoin(
    new Request('http://fn.local/waitlist-join', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-waitlist-secret': SECRET,
        'x-client-ip': '203.0.113.7',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    deps,
  );
  return { status: res.status, json: await res.json() };
}

Deno.test('a valid email joins with a keyed IP hash, lower-cased, source web', async () => {
  const { calls, deps } = setup();
  const res = await post(deps, { email: '  Dale@Example.COM ' });
  assertEquals(res, { status: 200, json: { data: { joined: true } } });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].email, 'dale@example.com');
  assertEquals(calls[0].source, 'web');
  assertEquals(calls[0].ipHash, await ipHash(SECRET, '203.0.113.7'));
  assert(/^[0-9a-f]{64}$/.test(calls[0].ipHash));
  assert(!calls[0].ipHash.includes('203'), 'the raw IP is not passed on');
});

Deno.test('an email already on the list gets the same answer as a new one', async () => {
  const { deps } = setup('already');
  assertEquals(await post(deps, { email: 'dale@example.com' }), { status: 200, json: { data: { joined: true } } });
});

Deno.test('a limited IP gets 429', async () => {
  const { deps } = setup('limited');
  const res = await post(deps, { email: 'dale@example.com' });
  assertEquals(res.status, 429);
  assertEquals(res.json.error?.code, 'rate_limited');
});

Deno.test('a wrong or missing secret is refused before anything is stored', async () => {
  const { calls, deps } = setup();
  assertEquals(
    (await post(deps, { email: 'dale@example.com' }, { 'x-waitlist-secret': `${SECRET.slice(0, -1)}?` })).status,
    401,
  );
  assertEquals((await post(deps, { email: 'dale@example.com' }, { 'x-waitlist-secret': '' })).status, 401);
  const short = { ...deps, secret: () => 'too-short' };
  assertEquals((await post(short, { email: 'dale@example.com' }, { 'x-waitlist-secret': 'too-short' })).status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('bad input is refused', async () => {
  const { calls, deps } = setup();
  for (
    const body of [{ email: 'not-an-email' }, {}, { email: 'a@b.co', extra: 1 }, {
      email: 'a@b.co',
      source: 'Bad Source',
    }]
  ) {
    assertEquals((await post(deps, body)).status, 400, JSON.stringify(body));
  }
  assertEquals((await post(deps, { email: 'a@b.co' }, { 'x-client-ip': '' })).status, 400);
  assertEquals(calls.length, 0);
});

Deno.test('the IP hash depends on the secret', async () => {
  assertNotEquals(await ipHash(SECRET, '203.0.113.7'), await ipHash(`${SECRET}x`, '203.0.113.7'));
  assertNotEquals(await ipHash(SECRET, '203.0.113.7'), await ipHash(SECRET, '203.0.113.8'));
});
