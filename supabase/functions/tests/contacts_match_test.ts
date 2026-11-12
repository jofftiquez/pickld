// fn:contacts-match: normalization, device and keyed hashing (D-28), input limits, rate limiting and
// match filtering.
// Runs without the local stack: the database side (ContactStore, 0015) is an in-memory fake that follows
// contacts_match_find's rules; the SQL itself is tested in supabase/tests/016_contact_hashes.sql.
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from '../_shared/deps.ts';
import {
  deviceHash,
  hmacHex,
  keyedHash,
  normalizeEmail,
  normalizePhone,
  sha256Hex,
} from '../contacts-match/contacts.ts';
import { type ContactMatch, type ContactStore, handleContactsMatch, MAX_CONTACTS } from '../contacts-match/handler.ts';
import { request } from './local.ts';

const SECRET = 'contacts-match-test-secret-at-least-32-chars';

// ---------------------------------------------------------------- a small world
interface User {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'suspended' | 'deleted';
}
const user = (name: string, status: User['status'] = 'active'): User => ({
  id: crypto.randomUUID(),
  username: name,
  email: `${name}@Example.com`,
  status,
});

function world() {
  const me = user('me');
  const friend = user('friend');
  const followed = user('followed');
  const blockedByMe = user('blockedbyme');
  const blockedMe = user('blockedme');
  const suspended = user('suspended', 'suspended');
  const deleted = user('deleted', 'deleted');
  const users = [me, friend, followed, blockedByMe, blockedMe, suspended, deleted];
  const blocks: [string, string][] = [[me.id, blockedByMe.id], [blockedMe.id, me.id]];
  const follows: [string, string][] = [[me.id, followed.id]];
  const hashes = new Map<string, string>(); // userId → email hash
  const calls: number[] = [];
  const seen: string[][] = []; // every hash list handed to find()
  const saved: { userId: string; hash: string }[] = [];
  let returnSelf = false;
  const joined: { userId: string; friendIds: string[] }[] = [];
  let joinedFails = false;

  const store: ContactStore = {
    take(userId) {
      const u = users.find((x) => x.id === userId);
      if (!u || u.status !== 'active') return Promise.resolve('inactive');
      if (calls.length >= 10) return Promise.resolve('limited');
      calls.push(Date.now());
      return Promise.resolve('ok');
    },
    pending(limit) {
      return Promise.resolve(
        users.filter((u) => u.status === 'active' && !hashes.has(u.id)).slice(0, limit).map((u) => ({
          userId: u.id,
          email: u.email,
        })),
      );
    },
    save(rows) {
      for (const r of rows) {
        hashes.set(r.userId, r.hash);
        saved.push(r);
      }
      return Promise.resolve();
    },
    find(userId, hs) {
      seen.push(hs);
      const blocked = (a: string, b: string) => blocks.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      const out: ContactMatch[] = users
        .filter((u) => hs.includes(hashes.get(u.id) ?? ''))
        .filter((u) => (returnSelf || u.id !== userId) && u.status === 'active' && !blocked(userId, u.id))
        .map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.username,
          avatarPath: null,
          following: follows.some(([r, a]) => r === userId && a === u.id),
        }));
      return Promise.resolve(out);
    },
    friendJoined(userId, friendIds) {
      if (joinedFails) return Promise.reject(new Error('notify_friend_joined: 500'));
      joined.push({ userId, friendIds });
      return Promise.resolve();
    },
  };

  const jwts = new Map(users.map((u) => [`jwt-${u.username}`, u]));
  const userClient = (_jwt: string) =>
    ({
      auth: {
        getUser: (jwt: string) => {
          const u = jwts.get(jwt);
          return Promise.resolve({ data: { user: u ? { id: u.id, email: u.email } : null } });
        },
      },
    }) as unknown as SupabaseClient;

  const call = async (body: unknown, who: User | null = me, secret = SECRET) => {
    const res = await handleContactsMatch(
      request('contacts-match', { jwt: who ? `jwt-${who.username}` : undefined, body }),
      {
        userClient,
        store: () => store,
        secret: () => secret,
      },
    );
    // deno-lint-ignore no-explicit-any
    return { status: res.status, json: await res.json() as any };
  };

  return {
    me,
    friend,
    followed,
    blockedByMe,
    blockedMe,
    suspended,
    deleted,
    users,
    calls,
    seen,
    saved,
    hashes,
    call,
    joined,
    setReturnSelf: (v: boolean) => (returnSelf = v),
    setJoinedFails: (v: boolean) => (joinedFails = v),
  };
}

// ---------------------------------------------------------------- normalization
Deno.test('emails are trimmed and lowercased; non-emails are dropped', () => {
  assertEquals(normalizeEmail('  Dale.Cruz@Example.COM '), 'dale.cruz@example.com');
  assertEquals(normalizeEmail('no-at-sign'), null);
  assertEquals(normalizeEmail('a@b'), null);
  assertEquals(normalizeEmail('two words@example.com'), null);
  assertEquals(normalizeEmail(''), null);
});

Deno.test('phone numbers keep digits and a leading +', () => {
  assertEquals(normalizePhone(' +63 (917) 555-0123 '), '+639175550123');
  assertEquals(normalizePhone('0917-555-0123'), '09175550123');
  assertEquals(normalizePhone('63+917'), null, 'too short');
  assertEquals(normalizePhone('1234567890123456'), null, 'more than 15 digits');
  assertEquals(normalizePhone('call me'), null);
});

// ---------------------------------------------------------------- the phone's side, computed independently
// What the app does (D-28), written here with crypto.subtle directly rather than the code under test.
const hexOf = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const utf8 = (s: string) => new TextEncoder().encode(s);
async function phoneHash(kind: 'email' | 'phone', normalized: string): Promise<string> {
  return hexOf(await crypto.subtle.digest('SHA-256', utf8(`${kind}:${normalized}`)));
}
/** An address-book email as the phone hashes it: trimmed, lowercased, then SHA-256 of "email:<email>". */
const phoneEmailHash = (raw: string) => phoneHash('email', raw.trim().toLowerCase());
async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', utf8(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hexOf(await crypto.subtle.sign('HMAC', k, utf8(message)));
}

// ---------------------------------------------------------------- hashing
Deno.test('device hashes are SHA-256 of "kind:normalized"; keyed hashes are HMAC-SHA256 of them', async () => {
  assertEquals(
    await hmacHex('Jefe', 'what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    'RFC 4231 case 2',
  );
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const d = await deviceHash('email', 'dale@example.com');
  assertEquals(d, await phoneHash('email', 'dale@example.com'), 'matches what the phone makes');
  assertNotEquals(await deviceHash('email', '+639175550123'), await deviceHash('phone', '+639175550123'));
  const k = await keyedHash(SECRET, d);
  assert(/^[0-9a-f]{64}$/.test(k), 'matches the contact_hashes check');
  assertEquals(k, await hmac(SECRET, d));
  assertNotEquals(k, d, 'never the plain hash');
  assertNotEquals(k, await keyedHash(`${SECRET}-other`, d), 'keyed');
});

// ---------------------------------------------------------------- matching
Deno.test('matches phone-made hashes, with follow state; never self, blocked or inactive users', async () => {
  const w = world();
  // Address-book forms differ from the sign-up email in case and whitespace; the phone normalizes first.
  const hashes = await Promise.all(w.users.map((u) => phoneEmailHash(`  ${u.email.toUpperCase()} `)));
  hashes.push(await phoneHash('phone', '+639175550123'));
  const { status, json } = await w.call({ hashes });
  assertEquals(status, 200);
  const got = json.data.matches.map((m: ContactMatch) => [m.username, m.following]).sort();
  assertEquals(got, [['followed', true], ['friend', false]]);
  assertEquals(Object.keys(json.data.matches[0]).sort(), ['avatarPath', 'displayName', 'following', 'id', 'username']);
});

Deno.test('the caller is dropped even if the store returned them', async () => {
  const w = world();
  w.setReturnSelf(true);
  const { json } = await w.call({ hashes: [await phoneEmailHash(w.me.email), await phoneEmailHash(w.friend.email)] });
  assertEquals(json.data.matches.map((m: ContactMatch) => m.username), ['friend']);
});

Deno.test('the matches, never the caller, hear that the caller joined; a failure there is ignored', async () => {
  const w = world();
  w.setReturnSelf(true);
  await w.call({ hashes: await Promise.all([w.me, w.friend, w.followed].map((u) => phoneEmailHash(u.email))) });
  assertEquals(w.joined.length, 1);
  assertEquals(w.joined[0]?.userId, w.me.id);
  assertEquals([...(w.joined[0]?.friendIds ?? [])].sort(), [w.followed.id, w.friend.id].sort());

  await w.call({ hashes: [await phoneEmailHash('nobody@example.com')] });
  assertEquals(w.joined.length, 1, 'no matches, no call');

  w.setJoinedFails(true);
  const { status, json } = await w.call({ hashes: [await phoneEmailHash(w.friend.email)] });
  assertEquals(status, 200);
  assertEquals(json.data.matches.length, 1);
});

Deno.test('only keyed hashes reach the database: submitted hashes are not passed on or logged', async () => {
  const w = world();
  const submitted = [await phoneEmailHash('secret.contact@example.com'), await phoneEmailHash(w.friend.email)];
  submitted.push(await phoneHash('phone', '+639175550123'));
  const logged: unknown[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of ['log', 'error', 'warn', 'info'] as const) console[k] = (...a: unknown[]) => logged.push(...a);
  try {
    await w.call({ hashes: submitted });
  } finally {
    Object.assign(console, orig);
  }
  assertEquals(logged, []);
  const sent = w.seen.flat();
  assertEquals(sent.length, 3);
  for (const h of [...sent, ...w.saved.map((s) => s.hash)]) assert(/^[0-9a-f]{64}$/.test(h), h);
  for (const h of submitted) assert(!sent.includes(h), 'device hashes are keyed before the database');
  assertEquals(sent.sort(), (await Promise.all(submitted.map((h) => hmac(SECRET, h)))).sort());
});

Deno.test('each call saves the caller’s own hash (keyed device hash of the email) and backfills', async () => {
  const w = world();
  await w.call({ hashes: [await phoneEmailHash('nobody@example.com')] });
  assertEquals(w.hashes.get(w.me.id), await hmac(SECRET, await phoneHash('email', 'me@example.com')));
  for (const u of w.users.filter((x) => x.status === 'active')) assert(w.hashes.has(u.id), u.username);
  assert(!w.hashes.has(w.suspended.id));
});

Deno.test('duplicate hashes are looked up once', async () => {
  const w = world();
  const a = await phoneEmailHash('A@x.co');
  const { status, json } = await w.call({ hashes: [a, await phoneEmailHash(' a@x.co '), a] });
  assertEquals(status, 200);
  assertEquals(json.data.matches, []);
  assertEquals(w.seen[0].length, 1);
});

// ---------------------------------------------------------------- validation and limits
Deno.test('input is validated, at most 2,000 hashes, and callers must be signed in', async () => {
  const w = world();
  const good = await phoneEmailHash('a@b.co');
  for (
    const body of [
      {},
      { hashes: [] },
      { hashes: good },
      { hashes: [1] },
      { hashes: [good.slice(1)] }, // 63 chars
      { hashes: [`${good}0`] }, // 65 chars
      { hashes: [good.toUpperCase()] },
      { hashes: [`${good.slice(1)}g`] },
      { hashes: [good], extra: 1 },
      { emails: ['a@b.co'] },
      { hashes: [good], emails: ['a@b.co'] },
      { phones: ['+63 917 555 0123'] },
    ]
  ) {
    const { status, json } = await w.call(body);
    assertEquals(status, 400, JSON.stringify(body).slice(0, 60));
    assertEquals(json.error.code, 'invalid_input');
    assert(!JSON.stringify(json).includes('a@b.co'), 'values are never echoed');
    assert(!JSON.stringify(json).includes(good.slice(1, 40)), 'hashes are never echoed');
  }
  const many = await Promise.all(Array.from({ length: MAX_CONTACTS }, (_, i) => phoneEmailHash(`c${i}@example.com`)));
  assertEquals((await w.call({ hashes: many })).status, 200, '2,000 is allowed');
  const { status, json } = await w.call({ hashes: [...many, good] });
  assertEquals(status, 413);
  assertEquals(json.error.code, 'too_many_contacts');
  assertEquals((await w.call('not json')).status, 400);
  assertEquals((await w.call({ hashes: [good] }, null)).status, 401);
  assertEquals((await w.call({ hashes: [good] }, { ...w.me, username: 'stranger' })).status, 401);
});

Deno.test('raw contacts can’t be sent: an email or phone number in place of a hash is refused', async () => {
  const w = world();
  for (const raw of [w.friend.email, 'friend@example.com', '+639175550123', '09175550123']) {
    const { status, json } = await w.call({ hashes: [raw] });
    assertEquals(status, 400, raw);
    assertEquals(json.error.code, 'invalid_input');
    assert(!JSON.stringify(json).includes(raw), 'values are never echoed');
  }
  assertEquals(w.seen, [], 'nothing reached the lookup');
});

Deno.test('ten calls an hour, then 429; inactive users get 403', async () => {
  const w = world();
  const body = { hashes: [await phoneEmailHash('a@b.co')] };
  for (let i = 0; i < 10; i++) assertEquals((await w.call(body)).status, 200);
  const limited = await w.call(body);
  assertEquals(limited.status, 429);
  assertEquals(limited.json.error.code, 'rate_limited');
  const inactive = await w.call(body, w.suspended);
  assertEquals(inactive.status, 403);
});

Deno.test('a short secret is refused rather than used', async () => {
  const w = world();
  let threw = false;
  try {
    await w.call({ hashes: [await phoneEmailHash('a@b.co')] }, w.me, 'short');
  } catch {
    threw = true;
  }
  assert(threw);
});
