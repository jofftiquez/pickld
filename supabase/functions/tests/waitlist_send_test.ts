// fn:waitlist-send (INV-09) with a stub email service and stub database calls. The SQL behind waitlist_release()
// and waitlist_mark_sent() (earliest first, founders only, marking once) is pinned in pgTAP 143; this file covers
// who may send, batching by 100, marking only what was sent, stopping at a failed batch, and the email itself.
import { assert, assertEquals, assertNotEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { endDay, inviteEmail } from '../waitlist-send/email.ts';
import {
  handleWaitlistSend,
  type OutgoingEmail,
  type Released,
  sendWithResend,
  type WaitlistSendDeps,
} from '../waitlist-send/handler.ts';

const EXPIRES = '2026-11-29T15:30:00Z'; // Nov 29, 23:30 in Manila

function people(n: number): Released[] {
  return Array.from({ length: n }, (_, i) => ({
    email: `p${i}@example.com`,
    // Three letters in base 24, so every code is different.
    code: `ABC${[576, 24, 1].map((d) => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(i / d) % 24]).join('')}`,
    expires_at: EXPIRES,
  }));
}

function setup(opts: { founder?: boolean | null; rows?: Released[]; failBatch?: number; email?: boolean } = {}) {
  const calls = {
    release: [] as { count: number; resendExpired: boolean }[],
    releaseTo: [] as string[][],
    batches: [] as { emails: OutgoingEmail[]; key: string }[],
    marked: [] as string[][],
  };
  const deps: WaitlistSendDeps = {
    isFounder: () => Promise.resolve(opts.founder === undefined ? true : opts.founder),
    release: (_jwt, count, resendExpired) => {
      calls.release.push({ count, resendExpired });
      return Promise.resolve((opts.rows ?? people(3)).slice(0, count));
    },
    // Like waitlist_release_to(): only the picked emails that are among the rows needing a code.
    releaseTo: (_jwt, emails) => {
      calls.releaseTo.push(emails);
      return Promise.resolve((opts.rows ?? people(3)).filter((r) => emails.includes(r.email)));
    },
    markSent: (_jwt, emails) => {
      calls.marked.push(emails);
      return Promise.resolve(emails.length);
    },
    email: () => (opts.email === false ? null : { apiKey: 're_test', from: 'Pickld <hello@mail.pickld.me>' }),
    site: () => 'https://pickld.me',
    send: (_key, emails, key) => {
      calls.batches.push({ emails, key });
      if (opts.failBatch === calls.batches.length) return Promise.reject(new Error('resend: 500'));
      return Promise.resolve();
    },
  };
  return { calls, deps };
}

async function post(deps: WaitlistSendDeps, body: unknown, jwt: string | null = 'jwt', method = 'POST') {
  const res = await handleWaitlistSend(
    new Request('http://fn.local/waitlist-send', {
      method,
      headers: { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    deps,
  );
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
}

Deno.test('only founders send, and nothing is released before the checks pass', async () => {
  const signedOut = setup();
  assertEquals((await post(signedOut.deps, { count: 1 }, null)).status, 401);
  const badJwt = setup({ founder: null });
  assertEquals((await post(badJwt.deps, { count: 1 })).status, 401);
  const moderator = setup({ founder: false });
  const r = await post(moderator.deps, { count: 1 });
  assertEquals([r.status, r.json.error.code], [403, 'not_founder']);
  const get = setup();
  assertEquals((await post(get.deps, null, 'jwt', 'GET')).status, 405);
  const tooMany = Array.from({ length: 101 }, (_, i) => `p${i}@example.com`);
  for (
    const body of [
      { count: 0 },
      { count: 501 },
      { count: 2.5 },
      { count: 1, extra: true },
      { emails: [] },
      { emails: tooMany },
      { emails: ['a'] },
      { emails: ['p0@example.com'], count: 1 },
      { emails: ['p0@example.com'], resendExpired: true },
      null,
    ]
  ) {
    const s = setup();
    assertEquals((await post(s.deps, body)).status, 400, JSON.stringify(body));
    assertEquals(s.calls.release.length + s.calls.releaseTo.length, 0);
  }
  for (const s of [signedOut, badJwt, moderator, get]) assertEquals(s.calls.release.length, 0);
  const notFounder = setup({ founder: false });
  assertEquals((await post(notFounder.deps, { emails: ['p0@example.com'] })).status, 403);
  assertEquals(notFounder.calls.releaseTo.length, 0);
});

Deno.test('without an email service nothing is released', async () => {
  const s = setup({ email: false });
  const r = await post(s.deps, { count: 5 });
  assertEquals([r.status, r.json.error.code], [503, 'email_not_configured']);
  assertEquals(s.calls.release.length, 0);
});

Deno.test('sends one email per person in batches of 100 and marks each batch after it goes out', async () => {
  const s = setup({ rows: people(250) });
  const r = await post(s.deps, { count: 250, resendExpired: true });
  assertEquals([r.status, r.json.data], [200, { sent: 250, total: 250 }]);
  assertEquals(s.calls.release, [{ count: 250, resendExpired: true }]);
  assertEquals(s.calls.batches.map((b) => b.emails.length), [100, 100, 50]);
  assertEquals(s.calls.marked.map((m) => m.length), [100, 100, 50]);
  const first = s.calls.batches[0].emails[0];
  assertEquals([first.to, first.from], [['p0@example.com'], 'Pickld <hello@mail.pickld.me>']);
  assertStringIncludes(first.html, people(1)[0].code);
  assertEquals(new Set(s.calls.batches.map((b) => b.key)).size, 3, 'each batch has its own idempotency key');
});

Deno.test('picked emails: only those who still need a code are emailed and marked, the same way as a batch', async () => {
  const s = setup({ rows: people(5) });
  const r = await post(s.deps, { emails: [' p3@example.com ', 'p1@example.com', 'gone@example.com'] });
  assertEquals([r.status, r.json.data], [200, { sent: 2, total: 2 }]);
  assertEquals(s.calls.releaseTo, [['p3@example.com', 'p1@example.com', 'gone@example.com']], 'trimmed');
  assertEquals(s.calls.release.length, 0, 'the earliest-first release is not used');
  assertEquals(s.calls.batches.map((b) => b.emails.map((e) => e.to[0])), [['p1@example.com', 'p3@example.com']]);
  assertStringIncludes(s.calls.batches[0].emails[1].html, people(5)[3].code);
  assertEquals(s.calls.marked, [['p1@example.com', 'p3@example.com']]);

  const again = setup({ rows: [] });
  const r2 = await post(again.deps, { emails: ['p1@example.com'] });
  assertEquals([r2.status, r2.json.data], [200, { sent: 0, total: 0 }], 'someone already sent a code gets nothing');
  assertEquals([again.calls.batches.length, again.calls.marked.length], [0, 0]);
});

Deno.test('a failed batch stops the send; only earlier batches are marked', async () => {
  const s = setup({ rows: people(250), failBatch: 2 });
  const r = await post(s.deps, { count: 250 });
  assertEquals([r.status, r.json.error.code, r.json.error.details], [502, 'send_failed', { sent: 100, total: 250 }]);
  assertEquals(s.calls.batches.length, 2, 'the third batch is not tried');
  assertEquals(s.calls.marked.map((m) => m.length), [100]);
});

Deno.test('retrying the same codes uses the same idempotency key', async () => {
  const a = setup({ rows: people(2) });
  const b = setup({ rows: [...people(2)].reverse() });
  await post(a.deps, { count: 2 });
  await post(b.deps, { count: 2 });
  assertEquals(a.calls.batches[0].key, b.calls.batches[0].key);
  const c = setup({ rows: people(3) });
  await post(c.deps, { count: 3 });
  assertNotEquals(a.calls.batches[0].key, c.calls.batches[0].key);
});

Deno.test('nobody left to send is a success with nothing sent', async () => {
  const s = setup({ rows: [] });
  const r = await post(s.deps, { count: 10 });
  assertEquals([r.status, r.json.data], [200, { sent: 0, total: 0 }]);
  assertEquals(s.calls.batches.length, 0);
});

Deno.test('the email has the code, the link and the end day in Manila time', () => {
  assertEquals(endDay('2026-11-29T15:30:00Z'), 'Nov 29, 2026');
  assertEquals(endDay('2026-11-29T16:30:00Z'), 'Nov 30, 2026', 'after midnight in Manila it is the next day');
  const e = inviteEmail('K7M2QX', EXPIRES, 'https://staging.example');
  assertEquals(e.subject, 'Your Pickld invite is here');
  for (const part of [e.html, e.text]) {
    assertStringIncludes(part, 'K7M2QX');
    assertStringIncludes(part, 'https://staging.example/i/K7M2QX');
    assertStringIncludes(part, 'Nov 29, 2026');
  }
  assert(!e.text.includes('<'), 'the text part has no markup');
});

Deno.test('sendWithResend posts the batch with the key and throws on a refusal', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const okFetch = ((url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(new Response('{"data":[]}', { status: 200 }));
  }) as unknown as typeof fetch;
  const emails = [{ from: 'a@b.c', to: ['x@y.z'], subject: 's', html: 'h', text: 't' }];
  await sendWithResend('re_key', emails, 'waitlist-abc', okFetch);
  assertEquals(seen[0].url, 'https://api.resend.com/emails/batch');
  const headers = new Headers(seen[0].init.headers);
  assertEquals([headers.get('authorization'), headers.get('idempotency-key')], ['Bearer re_key', 'waitlist-abc']);
  assertEquals(JSON.parse(String(seen[0].init.body)), emails);

  const refuse = (() => Promise.resolve(new Response('bad', { status: 422 }))) as unknown as typeof fetch;
  let threw = false;
  try {
    await sendWithResend('re_key', emails, 'k', refuse);
  } catch {
    threw = true;
  }
  assert(threw);
});
