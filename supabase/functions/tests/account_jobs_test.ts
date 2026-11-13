// fn:account-delete, fn:data-export and fn:account-jobs (M4-18; FR-PRV-02, FR-PRV-03) against the local
// stack, handlers in-process. Delete hides the profile at once; the export zip holds exactly the person's
// moments (private ones too) with byte-equal photos; the purge removes the auth user, every object under
// their prefixes and the export, and nothing of anyone else's (similar keys, seed/ keys); the purge waits
// for an export; only the cron secret runs jobs. Edited moments also get a finished copy (T-508): drawn with
// their filter and stickers, the retired sticker and the one from a pack the owner doesn't own included,
// over several runs when the drawing budget runs out.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { deletePrefix, listKeys } from '../_shared/bucket.ts';
import { skia } from '../_shared/moment_render.ts';
import { userClient } from '../_shared/env.ts';
import { userPrefixes } from '../_shared/object_keys.ts';
import { presignObject } from '../_shared/sigv4.ts';
import { handleAccountDelete } from '../account-delete/handler.ts';
import { handleAccountJobs, type JobsStore, serviceStore } from '../account-jobs/handler.ts';
import { handleDataExport } from '../data-export/handler.ts';
import {
  admin,
  cleanup,
  createUser,
  insert,
  localDate,
  localS3,
  localStatus,
  request,
  type TestUser,
} from './local.ts';
import { unzip } from './unzip.ts';

const SECRET = 'account-jobs-test-secret-at-least-32-characters';

// deno-lint-ignore no-explicit-any
type Json = any;

async function body(res: Response): Promise<{ status: number; json: Json }> {
  return { status: res.status, json: await res.json() };
}

const exportCall = async (jwt: string | undefined, method = 'POST') =>
  body(
    await handleDataExport(request('data-export', { jwt, method, body: method === 'POST' ? {} : undefined }), {
      userClient,
      s3: () => s3,
    }),
  );

const deleteCall = async (jwt: string | undefined, method = 'POST') =>
  body(
    await handleAccountDelete(request('account-delete', { jwt, method, body: method === 'POST' ? {} : undefined }), {
      userClient,
    }),
  );

const store = async (): Promise<JobsStore> => serviceStore(await admin(), await localS3());

const jobsCall = async (
  opts: { secret?: string | null; method?: string; store?: JobsStore; renderBudgetMs?: number } = {},
) => {
  const st = opts.store ?? await store();
  const headers: Record<string, string> = {};
  if (opts.secret !== null) headers['x-jobs-secret'] = opts.secret ?? SECRET;
  return body(
    await handleAccountJobs(new Request('http://fn.local/account-jobs', { method: opts.method ?? 'POST', headers }), {
      store: () => st,
      secret: () => SECRET,
      renderBudgetMs: opts.renderBudgetMs,
    }),
  );
};

async function job(userId: string, kind: 'export' | 'delete') {
  const { data, error } = await (await admin()).from('account_jobs').select('*').eq('user_id', userId).eq('kind', kind)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as Json;
}

/** Runs the job runner until this job is no longer pending or running (other due jobs may share a run). */
async function runUntilSettled(userId: string, kind: 'export' | 'delete') {
  for (let i = 0; i < 10; i++) {
    const j = await job(userId, kind);
    if (!j || !['pending', 'running'].includes(j.status)) return j;
    assertEquals((await jobsCall()).status, 200);
  }
  throw new Error('the job did not settle');
}

async function put(key: string, data: Uint8Array<ArrayBuffer>) {
  const headers = { 'content-type': 'image/jpeg', 'content-length': String(data.length) };
  const res = await fetch(await presignObject(s3, key, { method: 'PUT', expiresIn: 60, headers }), {
    method: 'PUT',
    headers,
    body: data,
  });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`put: ${res.status}`);
}

async function exists(key: string): Promise<boolean> {
  const res = await fetch(await presignObject(s3, key, { method: 'HEAD', expiresIn: 60 }), { method: 'HEAD' });
  await res.body?.cancel();
  return res.ok;
}

async function allKeys(userId: string): Promise<string[]> {
  const out: string[] = [];
  for (const p of [...userPrefixes(userId), `exports/${userId}/`]) out.push(...await listKeys(s3, p));
  return out.sort();
}

// ---------------------------------------------------------------- fixtures
let s3: Awaited<ReturnType<typeof localS3>>;
let owner: TestUser, other: TestUser, reader: TestUser;
let ownerUsername: string;
const photos = new Map<string, Uint8Array>(); // photo key → bytes
const strays: string[] = []; // keys of someone else's, or similar to the owner's: must survive
const SEED_KEY = 'seed/avatars/av_aya.jpg';
const swept: string[] = []; // users whose objects cleanup removes

interface Seeded {
  date: string;
  slot: string;
  caption: string | null;
  is_private: boolean;
  visibility: string;
  key: string;
}
const seeded: Seeded[] = [];
/** Moments with edits: slot → what their finished copy must show. */
const edited = new Map<string, { date: string; key: string }>();

/** A solid PNG of w×h in one color. */
async function solid(w: number, h: number, rgb: [number, number, number]): Promise<Uint8Array<ArrayBuffer>> {
  const { ck } = await skia();
  const surface = ck.MakeSurface(w, h)!;
  surface.getCanvas().clear(ck.Color(rgb[0], rgb[1], rgb[2], 1));
  const img = surface.makeImageSnapshot();
  const out = img.encodeToBytes(ck.ImageFormat.PNG, 100)!;
  img.delete();
  surface.delete();
  return new Uint8Array(out);
}

/** The pixel at (x, y) of an encoded image, and its size. */
async function pixelAt(bytes: Uint8Array, x: number, y: number) {
  const { ck } = await skia();
  const img = ck.MakeImageFromEncoded(bytes)!;
  const px = img.readPixels(x, y, {
    width: 1,
    height: 1,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  const size = [img.width(), img.height()];
  img.delete();
  return { rgb: [px[0], px[1], px[2]], size };
}

const near = (got: number[], want: number[], msg: string, tol = 8) =>
  assert(got.every((v, i) => Math.abs(v - want[i]) <= tol), `${msg}: got ${got}, want ${want}`);

// A premium pack of the test's own, never owned by anyone, with one retired sticker and one on offer.
const PACK = `t508-${crypto.randomUUID().slice(0, 8)}`;
const RETIRED_ART = `stickers/${PACK}/retired.png`;
const UNOWNED_ART = `stickers/${PACK}/unowned.png`;

async function moment(user: TestUser, jarId: string, date: string, visibility: string, slot: string, o: {
  caption?: string;
  isPrivate?: boolean;
  status?: 'live' | 'removed';
  photo?: Uint8Array<ArrayBuffer>;
  edits?: unknown;
} = {}) {
  const key = `moments/${user.id}/${crypto.randomUUID()}/full.jpg`;
  const bytes = o.photo ?? crypto.getRandomValues(new Uint8Array(2000 + Math.floor(Math.random() * 3000)));
  await put(key, bytes);
  await put(key.replace('full.jpg', 'thumb.jpg'), bytes.slice(0, 100));
  const m = await insert<{ id: string }>('moments', {
    jar_id: jarId,
    user_id: user.id,
    slot,
    status: 'checking',
    caption: o.caption ?? null,
    // Its own visibility (0066): Only me when private, else the jar's; is_private follows it.
    visibility: o.isPrivate ? 'only_me' : visibility,
    captured_at: '2026-11-01T01:02:03Z',
    photo_path: key,
    thumb_path: key.replace('full.jpg', 'thumb.jpg'),
    ...(o.edits === undefined ? {} : { edits: o.edits }),
  });
  const { error } = await (await admin()).rpc('moderation_apply', {
    p_moment_id: m.id,
    p_pending_since: null,
    p_decision: o.status === 'removed' ? 'remove' : 'approve',
    p_provider: 'test',
    p_reason: null,
  });
  if (error) throw error;
  photos.set(key, bytes);
  if (user === owner && o.status !== 'removed') {
    seeded.push({ date, slot, caption: o.caption ?? null, is_private: o.isPrivate ?? false, visibility, key });
    if (o.edits !== undefined) edited.set(slot, { date, key });
  }
}

Deno.test('setup', async () => {
  await localStatus();
  s3 = await localS3();
  owner = await createUser('jobowner');
  other = await createUser('jobother');
  reader = await createUser('jobreader');
  swept.push(other.id);
  const db = await admin();
  const { data: p } = await db.from('profiles').update({ bio: 'my bio' }).eq('id', owner.id).select('username')
    .single();
  ownerUsername = p!.username;
  await insert('follows', { reader_id: reader.id, author_id: owner.id });

  const jar = async (user: TestUser, daysAgo: number, visibility: string) => {
    const date = localDate('Asia/Manila', daysAgo);
    const j = await insert<{ id: string }>('jars', {
      user_id: user.id,
      local_date: date,
      tz: 'Asia/Manila',
      visibility,
      published_at: new Date().toISOString(),
    });
    return { id: j.id, date, visibility };
  };
  const a = await jar(owner, 1, 'everyone');
  const b = await jar(owner, 2, 'readers');
  // Sticker art in the bucket, and catalog rows: one retired (0032), both in a pack the owner doesn't own.
  await put(RETIRED_ART, await solid(100, 100, [230, 20, 20]));
  await put(UNOWNED_ART, await solid(100, 100, [20, 40, 230]));
  strays.push(RETIRED_ART, UNOWNED_ART);
  const pack = await insert<{ id: string }>('sticker_packs', { slug: PACK, name: 'T-508 test', tier: 'premium' });
  await insert('stickers', {
    pack_id: pack.id,
    label: 'retired',
    asset_path: RETIRED_ART,
    retired_at: new Date().toISOString(),
  });
  await insert('stickers', { pack_id: pack.id, label: 'unowned', asset_path: UNOWNED_ART });
  const sticker = (id: string, asset: string, x: number, y: number) => ({
    id,
    type: 'sticker',
    x,
    y,
    scale: 0.3,
    rotation: 0,
    asset,
  });

  await moment(owner, a.id, a.date, a.visibility, 'morning', {
    caption: 'coffee ☕',
    photo: await solid(300, 400, [200, 40, 120]),
    edits: {
      v: 1,
      filter: 'mono',
      overlays: [sticker('r', RETIRED_ART, 0.25, 0.25), sticker('u', UNOWNED_ART, 0.75, 0.75)],
    },
  });
  await moment(owner, a.id, a.date, a.visibility, 'selfie', {
    caption: 'just me',
    isPrivate: true,
    photo: await solid(300, 400, [40, 160, 90]),
    edits: { v: 1, filter: 'original', overlays: [sticker('u', UNOWNED_ART, 0.5, 0.5)] },
  });
  await moment(owner, a.id, a.date, a.visibility, 'evening', { caption: 'removed one', status: 'removed' });
  await moment(owner, b.id, b.date, b.visibility, 'whereami');

  // The owner's avatar and cover.
  for (const k of [`avatars/${owner.id}/${crypto.randomUUID()}.jpg`, `covers/${owner.id}/${crypto.randomUUID()}.jpg`]) {
    await put(k, new Uint8Array([1, 2, 3]));
  }
  // Someone else's moment and avatar, and keys that merely start with the owner's id.
  const o = await jar(other, 1, 'everyone');
  await moment(other, o.id, o.date, o.visibility, 'morning');
  for (
    const k of [
      `avatars/${other.id}/${crypto.randomUUID()}.jpg`,
      `moments/${owner.id}0/x/full.jpg`,
      `exports/${owner.id}0/x.zip`,
    ]
  ) {
    await put(k, new Uint8Array([4, 5, 6]));
    strays.push(k);
  }
  strays.push(...[...photos.keys()].filter((k) => k.includes(other.id)));
  // CI doesn't run `deno task seed`; a stand-in keeps the "seed survives" check meaningful there.
  if (!(await exists(SEED_KEY))) await put(SEED_KEY, new Uint8Array([7, 8, 9]));
});

// ---------------------------------------------------------------- export
Deno.test('data-export: nothing yet, then a pending job, then a zip of exactly their data', async () => {
  assertEquals((await exportCall(owner.jwt, 'GET')).json, {
    data: { status: 'none', requestedAt: null, url: null, expiresAt: null },
  });
  const asked = await exportCall(owner.jwt);
  assertEquals(asked.status, 200);
  assertEquals(asked.json.data.status, 'pending');
  assert(asked.json.data.requestedAt);
  assertEquals(
    (await exportCall(owner.jwt)).json.data.requestedAt,
    asked.json.data.requestedAt,
    'asking again: same job',
  );

  // A run whose drawing budget is spent draws one finished copy and hands the job back unharmed.
  const first = await jobsCall({ renderBudgetMs: 0 });
  assert(first.json.data.waiting >= 1, JSON.stringify(first.json));
  const waiting = await job(owner.id, 'export');
  assertEquals([waiting.status, waiting.attempts], ['pending', 0], 'handed back without using an attempt');
  assertEquals((await listKeys(s3, `exports/${owner.id}/${waiting.id}/`)).length, 1, 'one copy drawn');

  const j = await runUntilSettled(owner.id, 'export');
  assertEquals(j.status, 'done', j.error ?? '');
  assertEquals(j.attempts, 1, 'the finishing run is the only attempt');
  assertEquals(await listKeys(s3, `exports/${owner.id}/${j.id}/`), [], 'the drawn copies are cleaned up');
  assertEquals(j.result_key, `exports/${owner.id}/${j.id}.zip`);

  const got = await exportCall(owner.jwt, 'GET');
  assertEquals(got.json.data.status, 'done');
  const expires = Date.parse(got.json.data.expiresAt) - Date.now();
  assert(expires > 23.9 * 3600_000 && expires <= 24 * 3600_000, 'the link lasts 24 hours');
  assert(new URL(got.json.data.url).searchParams.get('X-Amz-Expires') === '86400');
  const res = await fetch(got.json.data.url);
  assertEquals(res.status, 200);
  const files = await unzip(new Uint8Array(await res.arrayBuffer()));

  const profile = JSON.parse(new TextDecoder().decode(files.get('profile.json')));
  assertEquals(profile.username, ownerUsername);
  assertEquals(profile.bio, 'my bio');
  assertEquals(profile.birthday, '1995-05-05');
  assertEquals(profile.display_name, 'jobowner');

  const moments = JSON.parse(new TextDecoder().decode(files.get('moments.json')));
  const [newer, older] = [localDate('Asia/Manila', 1), localDate('Asia/Manila', 2)];
  const at = '2026-11-01T01:02:03+00:00';
  assertEquals(
    moments.map((
      m: Json,
    ) => [m.date, m.slot, m.caption, m.is_private, m.visibility, m.photo, m.finished, m.captured_at]),
    [
      [older, 'whereami', null, false, 'readers', `photos/${older}/whereami.jpg`, `finished/${older}/whereami.jpg`, at],
      [newer, 'selfie', 'just me', true, 'everyone', `photos/${newer}/selfie.jpg`, `finished/${newer}/selfie.jpg`, at],
      [
        newer,
        'morning',
        'coffee ☕',
        false,
        'everyone',
        `photos/${newer}/morning.jpg`,
        `finished/${newer}/morning.jpg`,
        at,
      ],
    ],
    'every moment but the removed one, private included, by date and slot',
  );
  assert(moments.every((m: Json) => typeof m.added_at === 'string'));

  // Photos byte-equal to the uploads; a moment without edits has the same bytes as its finished copy.
  for (const s of seeded) {
    assertEquals(files.get(`photos/${s.date}/${s.slot}.jpg`), photos.get(s.key), s.slot);
    if (!edited.has(s.slot)) assertEquals(files.get(`finished/${s.date}/${s.slot}.jpg`), photos.get(s.key), s.slot);
  }
  assertEquals(files.size, 2 + 2 * seeded.length, 'nothing else in the archive');

  // Finished copies as the app shows them. Mono of (200, 40, 120) is Rec. 709 luma 0.2126·200 +
  // 0.7152·40 + 0.0722·120 ≈ 80; each sticker is 0.3 of the 300-wide photo (90 px) around its point.
  const morning = files.get(`finished/${newer}/morning.jpg`)!;
  assertEquals((await pixelAt(morning, 150, 200)).size, [300, 400]);
  near((await pixelAt(morning, 150, 200)).rgb, [80, 80, 80], 'mono filter');
  near((await pixelAt(morning, 75, 100)).rgb, [230, 20, 20], 'the retired sticker');
  near((await pixelAt(morning, 225, 300)).rgb, [20, 40, 230], 'the sticker from a pack they do not own');
  const selfie = files.get(`finished/${newer}/selfie.jpg`)!;
  near((await pixelAt(selfie, 150, 200)).rgb, [20, 40, 230], 'the private moment, drawn for its owner');
  near((await pixelAt(selfie, 20, 20)).rgb, [40, 160, 90], 'no filter: the photo as it was');

  // One a day: asking again returns the done export and its link.
  const again = await exportCall(owner.jwt);
  assertEquals(again.json.data.status, 'done');
  assertEquals(again.json.data.requestedAt, got.json.data.requestedAt);
  assert(again.json.data.url);
});

Deno.test('someone else cannot see or reach the export', async () => {
  assertEquals((await exportCall(other.jwt, 'GET')).json.data.status, 'none');
  const { data } = await userClient(other.jwt).from('account_jobs').select('id');
  assertEquals(data, []);
});

// ---------------------------------------------------------------- delete
Deno.test('account-delete hides the profile at once and waits 7 days after the export', async () => {
  const before = await userClient(reader.jwt).from('profiles').select('id').eq('id', owner.id);
  assertEquals(before.data?.length, 1);

  const res = await deleteCall(owner.jwt);
  assertEquals(res.status, 200);
  assertEquals(res.json.data.deleted, true);
  const exp = await job(owner.id, 'export');
  assertEquals(Date.parse(res.json.data.purgeAfter), Date.parse(exp.completed_at) + 7 * 86_400_000);

  // Hidden for a reader, an outsider and anonymous visitors.
  for (const u of [reader, other]) {
    const p = await userClient(u.jwt).from('profiles').select('id').eq('id', owner.id);
    assertEquals(p.data, [], u.name);
    const m = await userClient(u.jwt).from('moments').select('id').eq('user_id', owner.id);
    assertEquals(m.data, [], u.name);
  }
  const s = await localStatus();
  const anon = await fetch(`${s.API_URL}/rest/v1/rpc/public_profile`, {
    method: 'POST',
    headers: { apikey: s.ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ p_username: ownerUsername }),
  });
  assertEquals(await anon.json(), null);

  // Idempotent; the deleted account can still reach its export; nothing runs before it is due.
  assertEquals((await deleteCall(owner.jwt)).json.data.purgeAfter, res.json.data.purgeAfter);
  const e = await exportCall(owner.jwt, 'GET');
  assertEquals(e.json.data.status, 'done');
  assertEquals((await fetch(e.json.data.url)).status, 200);
  await runUntilSettled(owner.id, 'export');
  assertEquals((await job(owner.id, 'delete')).status, 'pending');
  assert((await allKeys(owner.id)).length > 0);
});

Deno.test('the purge removes the auth user, every object and the export, and nothing else', async () => {
  const db = await admin();
  const keysBefore = await allKeys(owner.id);
  assert(keysBefore.some((k) => k.startsWith('exports/')) && keysBefore.some((k) => k.startsWith('avatars/')));
  await db.from('account_jobs').update({ run_after: new Date(Date.now() - 60_000).toISOString() })
    .eq('user_id', owner.id).eq('kind', 'delete');

  assertEquals(await runUntilSettled(owner.id, 'delete'), null, 'the job row went with the account');

  assertEquals(await allKeys(owner.id), []);
  const { data } = await db.auth.admin.getUserById(owner.id);
  assertEquals(data.user, null);
  for (const t of ['profiles', 'jars', 'moments', 'account_jobs']) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true }).eq(
      t === 'profiles' ? 'id' : 'user_id',
      owner.id,
    );
    assertEquals(count, 0, t);
  }
  const { count: follows } = await db.from('follows').select('*', { count: 'exact', head: true }).eq(
    'author_id',
    owner.id,
  );
  assertEquals(follows, 0);
  for (const k of strays) assert(await exists(k), 'other people’s and look-alike keys survive');
  assert(await exists(SEED_KEY), 'seed keys survive');
  const { data: o } = await db.auth.admin.getUserById(other.id);
  assert(o.user);
  assertEquals((await deleteCall(owner.jwt)).status, 401, 'the old token no longer resolves');
});

Deno.test('a delete waits while an export is unfinished, and runs 7 days after it finishes', async () => {
  const u = await createUser('jobwait');
  swept.push(u.id);
  await exportCall(u.jwt);
  const res = await deleteCall(u.jwt);
  const wait = Date.parse(res.json.data.purgeAfter) - Date.now();
  assert(wait > 6.9 * 86_400_000 && wait <= 7 * 86_400_000, 'unfinished export: now + 7 days');

  // Even when due, the delete isn't claimed while the export runs; the export's finish pushes it back.
  const db = await admin();
  await db.from('account_jobs').update({ run_after: new Date(Date.now() - 60_000).toISOString() })
    .eq('user_id', u.id).eq('kind', 'delete');
  const st = await store();
  const claimed: string[] = [];
  const watching: JobsStore = {
    ...st,
    claim: async (n) => {
      const jobs = await st.claim(n);
      claimed.push(...jobs.filter((j) => j.user_id === u.id).map((j) => j.kind));
      return jobs;
    },
  };
  await jobsCall({ store: watching });
  assertEquals(claimed, ['export']);
  const exp = await job(u.id, 'export');
  assertEquals(exp.status, 'done');
  const del = await job(u.id, 'delete');
  assertEquals(del.status, 'pending');
  assertEquals(Date.parse(del.run_after), Date.parse(exp.completed_at) + 7 * 86_400_000);
  const { data } = await db.auth.admin.getUserById(u.id);
  assert(data.user, 'not purged');
});

Deno.test('with no export the purge is due at once; failures retry, then fail', async () => {
  const u = await createUser('jobfail');
  swept.push(u.id);
  const key = `avatars/${u.id}/${crypto.randomUUID()}.jpg`;
  await put(key, new Uint8Array([7]));
  const res = await deleteCall(u.jwt);
  assert(Math.abs(Date.parse(res.json.data.purgeAfter) - Date.now()) < 60_000);

  const st = await store();
  const broken: JobsStore = { ...st, deletePrefix: () => Promise.reject(new Error('delete object: 503')) };
  const out = await jobsCall({ store: broken });
  assert(out.json.data.failed >= 1);
  let j = await job(u.id, 'delete');
  assertEquals([j.status, j.attempts, j.error], ['pending', 1, 'delete object: 503']);
  assert(Date.parse(j.run_after) - Date.now() > 9 * 60_000, 'retried in 10 minutes');
  assert(await exists(key));

  const db = await admin();
  await db.from('account_jobs').update({ run_after: new Date().toISOString(), attempts: 2 }).eq('id', j.id);
  await jobsCall({ store: broken });
  j = await job(u.id, 'delete');
  assertEquals([j.status, j.attempts], ['failed', 3]);

  // Asking again queues a fresh delete, which then succeeds.
  await deleteCall(u.jwt);
  assertEquals(await runUntilSettled(u.id, 'delete'), null);
  assertEquals(await allKeys(u.id), []);
});

// ---------------------------------------------------------------- access
Deno.test('only the cron secret runs jobs; only POST', async () => {
  assertEquals((await jobsCall({ secret: null })).status, 401);
  assertEquals((await jobsCall({ secret: 'wrong' })).status, 401);
  assertEquals((await jobsCall({ secret: SECRET.slice(0, -1) })).status, 401);
  assertEquals((await jobsCall({ method: 'GET' })).status, 405);
  const short = await handleAccountJobs(
    new Request('http://fn.local/account-jobs', { method: 'POST', headers: { 'x-jobs-secret': 'short' } }),
    {
      store: () => {
        throw new Error('unused');
      },
      secret: () => 'short',
    },
  );
  assertEquals(short.status, 401, 'a secret under 32 characters never works');
});

Deno.test('signed-out callers get 401; wrong methods 405', async () => {
  assertEquals((await deleteCall(undefined)).status, 401);
  assertEquals((await deleteCall('not-a-jwt')).status, 401);
  assertEquals((await exportCall(undefined)).status, 401);
  assertEquals((await exportCall('not-a-jwt', 'GET')).status, 401);
  assertEquals((await deleteCall(other.jwt, 'GET')).status, 405);
  assertEquals((await exportCall(other.jwt, 'PUT')).status, 405);
  const { data } = await (await admin()).from('profiles').select('status').eq('id', other.id).single();
  assertEquals(data?.status, 'active');
});

Deno.test('the sweep refuses seed/ and anything wider than one person’s folder', async () => {
  for (const p of ['seed/avatars/', 'moments/', '', 'moments', 'moments//', `/moments/${other.id}/`]) {
    await assertRejects(() => deletePrefix(s3, p), Error, 'bad prefix', p);
  }
});

Deno.test('cleanup', async () => {
  for (const k of strays) {
    const res = await fetch(await presignObject(s3, k, { method: 'DELETE', expiresIn: 60 }), { method: 'DELETE' });
    await res.body?.cancel();
  }
  for (const id of swept) for (const p of [...userPrefixes(id), `exports/${id}/`]) await deletePrefix(s3, p);
  // The test pack would break the catalog checks in supabase/tests (its stickers cascade).
  const { error } = await (await admin()).from('sticker_packs').delete().eq('slug', PACK);
  if (error) throw new Error(`delete test pack: ${error.message}`);
  await cleanup();
});
