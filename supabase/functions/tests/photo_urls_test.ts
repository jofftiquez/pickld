// fn:photo-urls against the local stack, with the same cast as the pgTAP RLS fixtures (tests.world()).
// Each returned URL is then fetched through the photo Worker's handler to prove the token works.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { handlePhotoRequest } from '../../../workers/photos/src/handler.ts';
import { handlePhotoUrls, PHOTO_TOKEN_TTL_SECONDS } from '../photo-urls/handler.ts';
import { admin, cleanup, createUser, insert, localDate, request, type TestUser } from './local.ts';

const SECRET = 'photo-urls-test-secret-at-least-32-chars';
const BASE = 'http://photos.test';
const NOW = Math.floor(Date.now() / 1000);
const deps = { userClient, photoBaseUrl: () => BASE, tokenSecret: () => SECRET, now: () => NOW };

const call = async (body: unknown, user?: TestUser) => {
  const res = await handlePhotoUrls(request('photo-urls', { jwt: user?.jwt, body }), deps);
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

// ---------------------------------------------------------------- the cast
// Built in the first test rather than at module load, so it never overlaps other test files' setup.
let owner: TestUser, reader: TestUser, outsider: TestUser, blocked: TestUser, blocker: TestUser, moderator: TestUser;
let db: Awaited<ReturnType<typeof admin>>;
type M = { id: string; full: string; thumb: string };
let live: M, livePublic: M, priv: M, checking: M, removed: M, onlyMe: M, queued: M;
let all: M[];

Deno.test('setup', async () => {
  owner = await createUser('owner');
  reader = await createUser('reader');
  outsider = await createUser('outsider');
  blocked = await createUser('blocked');
  blocker = await createUser('blocker');
  moderator = await createUser('moderator', { role: 'moderator' });
  db = await admin();
  for (const r of [reader, blocked, blocker]) await insert('follows', { reader_id: r.id, author_id: owner.id });
  await insert('blocks', { blocker_id: owner.id, blocked_id: blocked.id });
  await insert('blocks', { blocker_id: blocker.id, blocked_id: owner.id });

  const jar = (visibility: string, daysAgo: number, published = true) =>
    insert<{ id: string }>('jars', {
      user_id: owner.id,
      local_date: localDate('Asia/Manila', daysAgo),
      tz: 'Asia/Manila',
      visibility,
      published_at: published ? new Date().toISOString() : null,
    });
  const readersJar = await jar('readers', 1);
  const everyoneJar = await jar('everyone', 2);
  const onlyMeJar = await jar('only_me', 3);

  /** Inserted as checking (the insert trigger's rule), then moved to its status as the server would. */
  async function moment(jarId: string, slot: string, status: string, isPrivate = false) {
    const base = `moments/${owner.id}/${crypto.randomUUID()}`;
    const m = await insert<{ id: string }>('moments', {
      jar_id: jarId,
      user_id: owner.id,
      slot,
      status: 'checking',
      is_private: isPrivate,
      photo_path: `${base}/full.jpg`,
      thumb_path: `${base}/thumb.jpg`,
    });
    if (status !== 'checking') {
      const { error } = await db.from('moments').update({ status }).eq('id', m.id);
      if (error) throw new Error(error.message);
    }
    return { id: m.id, full: `${base}/full.jpg`, thumb: `${base}/thumb.jpg` };
  }

  live = await moment(readersJar.id, 'morning', 'live');
  livePublic = await moment(everyoneJar.id, 'morning', 'live');
  priv = await moment(everyoneJar.id, 'evening', 'live', true);
  checking = await moment(everyoneJar.id, 'afternoon', 'checking');
  removed = await moment(everyoneJar.id, 'ootd', 'removed');
  onlyMe = await moment(onlyMeJar.id, 'morning', 'live');
  queued = await moment(readersJar.id, 'afternoon', 'checking');
  await insert('moderation_items', { moment_id: queued.id, source: 'auto_check', status: 'pending' });

  all = [live, livePublic, priv, checking, removed, onlyMe, queued];
});

const visible = (user: TestUser) => call({ momentIds: all.map((m) => m.id) }, user);
const ids = (json: { data: { moments: { id: string }[] } }) => json.data.moments.map((m) => m.id).sort();
const sorted = (...ms: { id: string }[]) => ms.map((m) => m.id).sort();

// ---------------------------------------------------------------- tests
Deno.test('each role gets tokens only for moments it can view', async () => {
  const expected: [TestUser, { id: string }[]][] = [
    [owner, all],
    [reader, [live, livePublic]],
    [outsider, [livePublic]],
    [blocked, []],
    [blocker, []],
    [moderator, [livePublic, queued]],
  ];
  for (const [user, ms] of expected) {
    const { status, json } = await visible(user);
    assertEquals(status, 200);
    assertEquals(ids(json), sorted(...ms), `${user.name}`);
  }
});

Deno.test('private, checking and removed moments get tokens for the owner only', async () => {
  for (const user of [reader, outsider, blocked, blocker, moderator]) {
    const { json } = await call({ momentIds: [priv.id, checking.id, removed.id] }, user);
    assertEquals(json.data.moments, [], user.name);
  }
  const { json } = await call({ momentIds: [priv.id, checking.id, removed.id] }, owner);
  assertEquals(ids(json), sorted(priv, checking, removed));
});

Deno.test('tokens last 15 minutes and open the full photo and the thumbnail through the Worker', async () => {
  const { json } = await call({ momentIds: [live.id] }, reader);
  assertEquals(json.data.expiresAt, new Date((NOW + PHOTO_TOKEN_TTL_SECONDS) * 1000).toISOString());
  assertEquals(PHOTO_TOKEN_TTL_SECONDS, 900);
  const [m] = json.data.moments;
  const store = { get: (key: string) => Promise.resolve({ body: new Blob([key]).stream(), contentType: 'image/jpeg' }) };
  for (const [url, key] of [[m.full, live.full], [m.thumb, live.thumb]]) {
    const u = new URL(url);
    assertEquals(u.pathname.slice(1), key);
    assertEquals(Number(u.searchParams.get('exp')), NOW + 900);
    const ok = await handlePhotoRequest(new Request(url), store, SECRET, NOW + 899);
    assertEquals(ok.status, 200);
    assertEquals(await ok.text(), key);
    const late = await handlePhotoRequest(new Request(url), store, SECRET, NOW + 900);
    assertEquals(late.status, 403, 'expired after 15 minutes');
    await late.body?.cancel();
  }
});

Deno.test('pending (unchecked) edits get tokens for the owner and moderators of queued items only', async () => {
  const pending = `moments/${owner.id}/${crypto.randomUUID()}/full.jpg`;
  await db.from('moments').update({ pending_photo_path: pending, pending_since: new Date().toISOString() }).eq(
    'id',
    livePublic.id,
  );
  const r = await call({ momentIds: [livePublic.id] }, reader);
  assertEquals(r.json.data.moments[0].pendingFull, undefined, 'readers never get the unchecked photo');
  assert(r.json.data.moments[0].full, 'readers still get the live photo');
  const o = await call({ momentIds: [livePublic.id] }, owner);
  assertEquals(new URL(o.json.data.moments[0].pendingFull).pathname.slice(1), pending);
  const before = await call({ momentIds: [livePublic.id] }, moderator);
  assertEquals(before.json.data.moments[0].pendingFull, undefined, 'not queued yet');
  await insert('moderation_items', { moment_id: livePublic.id, source: 'auto_check', status: 'pending' });
  const after = await call({ momentIds: [livePublic.id] }, moderator);
  assertEquals(new URL(after.json.data.moments[0].pendingFull).pathname.slice(1), pending);
});

Deno.test('a suspended owner’s moments get no tokens for others', async () => {
  await db.from('profiles').update({ status: 'suspended' }).eq('id', owner.id);
  try {
    assertEquals((await call({ momentIds: [livePublic.id] }, outsider)).json.data.moments, []);
    assertEquals((await call({ momentIds: [livePublic.id] }, owner)).json.data.moments.length, 1);
  } finally {
    await db.from('profiles').update({ status: 'active' }).eq('id', owner.id);
  }
});

Deno.test('input is validated and callers must be signed in', async () => {
  for (const body of [{}, { momentIds: [] }, { momentIds: ['nope'] }, { momentIds: [live.id], extra: 1 },
    { momentIds: Array.from({ length: 101 }, () => crypto.randomUUID()) }]) {
    const { status, json } = await call(body, reader);
    assertEquals(status, 400, JSON.stringify(body).slice(0, 60));
    assertEquals(json.error.code, 'invalid_input');
  }
  assertEquals((await call({ momentIds: [live.id] })).status, 401);
  assertEquals((await call({ momentIds: [live.id] }, { ...reader, jwt: 'not.a.jwt' })).status, 401);
  const dup = await call({ momentIds: [live.id, live.id.toUpperCase()] }, reader);
  assertEquals(dup.json.data.moments.length, 1, 'duplicates are signed once');
});

Deno.test({ name: 'cleanup', fn: cleanup, sanitizeResources: false, sanitizeOps: false });
