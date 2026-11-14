// fn:send-push (M3-17) with an in-memory PushStore and a mocked Expo API (a fake fetch behind the real
// expoClient). The SQL rules behind push_take (quiet hours, prefs, daily limit, settle) are pinned in
// pgTAP 021; this file covers batching, copy, the secret, Expo answers, retries and receipts.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { expoClient, EXPO_RECEIPTS_URL, EXPO_SEND_URL, handleSendPush, type PushStore } from '../send-push/handler.ts';
import { composePushes, type DueNotification, likers } from '../send-push/messages.ts';

const SECRET = 'push-cron-secret-at-least-32-characters!!';

function row(over: Partial<DueNotification> & Pick<DueNotification, 'id' | 'type'>): DueNotification {
  return {
    user_id: 'dale',
    actor_name: 'Aya Tanaka',
    jar_id: 'jar-sun',
    jar_local_date: '2026-11-08', // a Sunday
    moment_id: null,
    comment_id: null,
    comment_body: null,
    tokens: ['ExponentPushToken[dale-phone]'],
    ...over,
  };
}

function fakeStore(rows: DueNotification[], tickets: { ticketId: string; token: string }[] = []) {
  const log = { retried: [] as string[], saved: [] as { ticketId: string; token: string }[], settled: [] as string[], dead: [] as string[] };
  const store: PushStore = {
    take: () => Promise.resolve(rows),
    retry: (ids) => (log.retried.push(...ids), Promise.resolve()),
    saveTickets: (r) => (log.saved.push(...r), Promise.resolve()),
    dueTickets: () => Promise.resolve(tickets),
    settleReceipts: (ids, dead) => (log.settled.push(...ids), log.dead.push(...dead), Promise.resolve()),
  };
  return { store, log };
}

/** A fake Expo: records each send, answers tickets in order; `failSends` makes the next n sends 503. */
function fakeExpo(opts: { failSends?: number; dead?: string[]; receipts?: Record<string, unknown> } = {}) {
  const sent: { to: string; title: string; body: string; data: Record<string, unknown> }[][] = [];
  let failSends = opts.failSends ?? 0;
  let n = 0;
  const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (String(url) === EXPO_SEND_URL) {
      if (failSends > 0) {
        failSends -= 1;
        return Promise.resolve(new Response('busy', { status: 503 }));
      }
      sent.push(body);
      const data = body.map((m: { to: string }) =>
        opts.dead?.includes(m.to)
          ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: `ticket-${++n}-${crypto.randomUUID()}` }
      );
      return Promise.resolve(Response.json({ data }));
    }
    if (String(url) === EXPO_RECEIPTS_URL) return Promise.resolve(Response.json({ data: opts.receipts ?? {} }));
    return Promise.resolve(new Response('nope', { status: 404 }));
  }) as typeof fetch;
  return { sent, client: expoClient(undefined, fetcher) };
}

const call = (store: PushStore, expo: ReturnType<typeof fakeExpo>, secret = SECRET) =>
  handleSendPush(
    new Request('http://fn.local/send-push', { method: 'POST', headers: { 'x-push-secret': secret }, body: '{}' }),
    { store: () => store, expo: () => expo.client, secret: () => SECRET },
  );

// ---------------------------------------------------------------- copy and batching
Deno.test('likers reads newest first and counts the rest', () => {
  assertEquals(likers(['Aya']), 'Aya');
  assertEquals(likers(['Aya', 'Jun']), 'Aya and Jun');
  assertEquals(likers(['Aya', 'Jun', 'Mika', 'Aya']), 'Aya and 2 others');
  assertEquals(likers([null]), 'Someone');
});

Deno.test('likes on one jar batch into one push; other jars and types stay separate', () => {
  const pushes = composePushes([
    row({ id: 'l1', type: 'like', actor_name: 'Jun' }),
    row({ id: 'r1', type: 'new_reader', actor_name: 'Mika Reyes' }),
    row({ id: 'l2', type: 'like', actor_name: 'Mika', moment_id: 'm1' }),
    row({ id: 'l3', type: 'like', actor_name: 'Aya' }),
    row({ id: 'l4', type: 'like', jar_id: 'jar-sat', jar_local_date: '2026-11-07' }),
  ]);
  assertEquals(pushes.map((p) => [p.title, p.body, p.data.notificationIds]), [
    ['Your Sunday jar', 'Aya and 2 others liked it.', ['l1', 'l2', 'l3']],
    ['Mika Reyes', 'started reading your days. Read back?', ['r1']],
    ['Your Saturday jar', 'Aya Tanaka liked it.', ['l4']],
  ]);
});

Deno.test('likes for two people on the same jar are never merged', () => {
  const pushes = composePushes([
    row({ id: 'a', type: 'like' }),
    row({ id: 'b', type: 'like', user_id: 'mika', tokens: ['ExponentPushToken[mika]'] }),
  ]);
  assertEquals(pushes.length, 2);
});

Deno.test('comments and replies quote the text, trimmed; types that are not pushed produce nothing', () => {
  const long = 'x'.repeat(130);
  const [c, r, f, rm] = composePushes([
    row({ id: 'c', type: 'comment', actor_name: 'Jun', comment_id: 'cm1', comment_body: ' Pambahay   supremacy. ' }),
    row({ id: 'r', type: 'reply', actor_name: 'Jun', comment_body: long }),
    row({ id: 'fj', type: 'full_jar' }),
    row({ id: 'f', type: 'friend_joined', actor_name: 'Lola Cora' }),
    row({ id: 'rm', type: 'removed', actor_name: null, moment_id: 'm9' }),
  ]);
  assertEquals(c?.body, 'commented: “Pambahay supremacy.”');
  assertEquals(c?.data.commentId, 'cm1');
  assertEquals(r?.body, `replied: “${'x'.repeat(99)}…”`);
  assertEquals(f?.body, 'joined Pickld. Say hi?');
  assertEquals([rm?.title, rm?.data.momentId], ['We removed one of your moments', 'm9']);
});

Deno.test('an admitted account hears it is in (0131)', () => {
  const [p] = composePushes([row({ id: 'ad', type: 'admitted', actor_name: null, jar_id: null, jar_local_date: null })]);
  assertEquals([p?.title, p?.body, p?.data.type], ["You're in", 'Fill your first jar.', 'admitted']);
});

Deno.test('a comment in a moment thread says it is on your moment and carries the moment (0068)', () => {
  const [quoted, plain] = composePushes([
    row({ id: 'c', type: 'comment', actor_name: 'Jun', moment_id: 'm1', comment_id: 'cm1', comment_body: 'Love the light' }),
    row({ id: 'p', type: 'comment', actor_name: 'Jun', moment_id: 'm1', comment_id: 'cm2' }),
  ]);
  assertEquals(quoted?.body, 'commented on your moment: “Love the light”');
  assertEquals([quoted?.data.momentId, quoted?.data.commentId], ['m1', 'cm1']);
  assertEquals(plain?.body, 'commented on your moment.');
});

// ---------------------------------------------------------------- the handler
Deno.test('refuses a missing or wrong secret, and a server with a short one', async () => {
  const { store } = fakeStore([]);
  assertEquals((await call(store, fakeExpo(), 'wrong')).status, 401);
  assertEquals((await call(store, fakeExpo(), '')).status, 401);
  const res = await handleSendPush(
    new Request('http://fn.local/send-push', { method: 'POST', headers: { 'x-push-secret': 'short' } }),
    { store: () => store, expo: () => fakeExpo().client, secret: () => 'short' },
  );
  assertEquals(res.status, 401);
});

Deno.test('sends one message per device and saves the tickets', async () => {
  const { store, log } = fakeStore([
    row({ id: 'l1', type: 'like', tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] }),
    row({ id: 'l2', type: 'like', tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] }),
  ]);
  const expo = fakeExpo();
  const res = await call(store, expo);
  const json = await res.json();
  assertEquals(json.data, { claimed: 2, pushes: 1, messages: 2, failed: 0, receipts: 0, deadTokens: 0 });
  assertEquals(expo.sent.flat().map((m) => m.to), ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  assertEquals(expo.sent[0]?.[0]?.data, { type: 'like', notificationIds: ['l1', 'l2'], jarId: 'jar-sun' });
  assertEquals(log.saved.map((s) => s.token), ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
});

Deno.test('a chunk Expo cannot take goes back for the next run; other chunks still go', async () => {
  const rows = Array.from({ length: 150 }, (_, i) =>
    row({ id: `r${i}`, type: 'new_reader', user_id: `u${i}`, tokens: [`ExponentPushToken[u${i}]`] })
  );
  const { store, log } = fakeStore(rows);
  const expo = fakeExpo({ failSends: 1 });
  const json = await (await call(store, expo)).json();
  assertEquals(expo.sent.length, 1, 'the second chunk of 50 went');
  assertEquals(expo.sent[0]?.length, 50);
  assertEquals(log.retried.length, 100, 'the first chunk of 100 is retried');
  assertEquals(json.data.failed, 100);
});

Deno.test('dead tokens from tickets and from receipts are deleted; unready receipts wait', async () => {
  const { store, log } = fakeStore(
    [row({ id: 'n1', type: 'new_reader', tokens: ['ExponentPushToken[old]', 'ExponentPushToken[new]'] })],
    [
      { ticketId: 't-ok', token: 'ExponentPushToken[x]' },
      { ticketId: 't-dead', token: 'ExponentPushToken[gone]' },
      { ticketId: 't-wait', token: 'ExponentPushToken[y]' },
    ],
  );
  const expo = fakeExpo({
    dead: ['ExponentPushToken[old]'],
    receipts: {
      't-ok': { status: 'ok' },
      't-dead': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    },
  });
  const json = await (await call(store, expo)).json();
  assertEquals(log.saved.map((s) => s.token), ['ExponentPushToken[new]']);
  assertEquals(log.settled.sort(), ['t-dead', 't-ok']);
  assertEquals(log.dead.sort(), ['ExponentPushToken[gone]', 'ExponentPushToken[old]']);
  assertEquals(json.data.receipts, 2);
  assert(!log.settled.includes('t-wait'));
});

Deno.test('nothing due: no Expo call at all', async () => {
  const { store } = fakeStore([]);
  const expo = fakeExpo();
  const json = await (await call(store, expo)).json();
  assertEquals(expo.sent.length, 0);
  assertEquals(json.data.messages, 0);
});

// ---------------------------------------------------------------- against the local stack
Deno.test('end to end on the local database: due likes batch, tickets saved, dead tokens deleted', async () => {
  const { admin, cleanup, createUser, insert, localDate } = await import('./local.ts');
  const { serviceStore } = await import('../send-push/handler.ts');
  try {
    const db = await admin();
    const owner = await createUser('pushowner');
    const aya = await createUser('pushaya');
    const jun = await createUser('pushjun');
    await db.from('notification_prefs').update({ quiet_hours: false }).eq('user_id', owner.id);
    const tokens = [`ExponentPushToken[${owner.id}-a]`, `ExponentPushToken[${owner.id}-b]`];
    for (const token of tokens) await insert('push_tokens', { user_id: owner.id, token, platform: 'ios' });
    const jar = await insert<{ id: string }>('jars', {
      user_id: owner.id,
      local_date: localDate('Asia/Manila'),
      tz: 'Asia/Manila',
      visibility: 'everyone',
      published_at: new Date().toISOString(),
    });
    // jun liked a second after aya, so the newest-first text is fixed (equal times made the order a coin toss).
    for (const [i, actor] of [aya, jun].entries()) {
      const at = new Date(Date.now() - 120_000 + i * 1000).toISOString();
      await insert('notifications', { user_id: owner.id, type: 'like', actor_id: actor.id, jar_id: jar.id, created_at: at });
    }

    const expo = fakeExpo({ dead: [tokens[1]!] });
    const res = await handleSendPush(
      new Request('http://fn.local/send-push', { method: 'POST', headers: { 'x-push-secret': SECRET } }),
      { store: () => serviceStore(db), expo: () => expo.client, secret: () => SECRET },
    );
    const json = await res.json();
    assertEquals(res.status, 200);
    const mine = expo.sent.flat().filter((m) => tokens.includes(m.to));
    assertEquals(mine.length, 2, 'one push, two devices');
    assertEquals(mine[0]?.body, 'pushjun and pushaya liked it.');
    assert(json.data.deadTokens >= 1);

    const { data: left } = await db.from('push_tokens').select('token').eq('user_id', owner.id);
    assertEquals(left?.map((t: { token: string }) => t.token), [tokens[0]]);
    const { data: rows } = await db.from('notifications').select('push_result').eq('user_id', owner.id);
    assertEquals(rows?.map((r: { push_result: string }) => r.push_result), ['sent', 'sent']);
    const { count } = await db.from('push_tickets').select('*', { count: 'exact', head: true }).eq('token', tokens[0]!);
    assertEquals(count, 1, "the live device's ticket waits for its receipt");
  } finally {
    await cleanup();
  }
});
