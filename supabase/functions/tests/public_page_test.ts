// fn:public-page against the local stack: what an anonymous visitor of pickld.me gets, and that only
// those keys are signed. Each returned URL is fetched through the photo Worker's handler.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { anonClient } from '../_shared/env.ts';
import { handlePhotoRequest } from '../../../workers/photos/src/handler.ts';
import { handlePublicPage } from '../public-page/handler.ts';
import { admin, cleanup, createUser, insert, localDate, localStatus, request, type TestUser } from './local.ts';

const SECRET = 'public-page-test-secret-at-least-32-chars';
const BASE = 'http://photos.test';
const deps = { anonClient, photoBaseUrl: () => BASE, tokenSecret: () => SECRET };

// deno-lint-ignore no-explicit-any
const call = async (body: unknown, method = 'POST'): Promise<{ status: number; json: any }> => {
  const res = await handlePublicPage(request('public-page', { body, method }), deps);
  return { status: res.status, json: await res.json() };
};

let owner: TestUser, username: string;
let everyoneJar: string, readersJar: string, onlyMeJar: string, draftJar: string;
let livePublic: string, livePublic2: string, priv: string, checking: string, readersMoment: string;
let readersInEveryone: string;
let avatarKey: string;

Deno.test('setup', async () => {
  await localStatus();
  owner = await createUser('webowner');
  const db = await admin();
  avatarKey = `avatars/${owner.id}/${crypto.randomUUID()}.jpg`;
  const { data: p, error } = await db.from('profiles').update({
    avatar_path: avatarKey,
  }).eq('id', owner.id).select('username').single();
  if (error) throw error;
  username = p.username;

  const jar = async (visibility: string, daysAgo: number, published = true) =>
    (await insert<{ id: string }>('jars', {
      user_id: owner.id,
      local_date: localDate('Asia/Manila', daysAgo),
      tz: 'Asia/Manila',
      visibility,
      published_at: published ? new Date().toISOString() : null,
    })).id;
  everyoneJar = await jar('everyone', 1);
  readersJar = await jar('readers', 2);
  onlyMeJar = await jar('only_me', 3);
  draftJar = await jar('everyone', 4, false);

  // Each moment has its own visibility (0066); the web page shows only Everyone moments (D-32).
  async function moment(jarId: string, slot: string, live: boolean, visibility: string) {
    const base = `moments/${owner.id}/${crypto.randomUUID()}`;
    const m = await insert<{ id: string }>('moments', {
      jar_id: jarId,
      user_id: owner.id,
      slot,
      status: 'checking',
      visibility,
      photo_path: `${base}/full.jpg`,
      thumb_path: `${base}/thumb.jpg`,
    });
    if (live) {
      const { error } = await db.rpc('moderation_apply', {
        p_moment_id: m.id,
        p_pending_since: null,
        p_decision: 'approve',
        p_provider: 'test',
        p_reason: null,
      });
      if (error) throw error;
    }
    return m.id;
  }
  livePublic = await moment(everyoneJar, 'evening', true, 'everyone');
  livePublic2 = await moment(everyoneJar, 'whereami', true, 'everyone');
  priv = await moment(everyoneJar, 'selfie', true, 'only_me');
  checking = await moment(everyoneJar, 'morning', false, 'everyone');
  readersInEveryone = await moment(everyoneJar, 'ootd', true, 'readers');
  readersMoment = await moment(readersJar, 'morning', true, 'readers');
  await moment(onlyMeJar, 'morning', true, 'everyone');
  await moment(draftJar, 'morning', true, 'everyone');
});

/** A signed URL is for exactly this key and opens through the photo Worker. */
async function opens(url: string, key: string) {
  assert(url.startsWith(`${BASE}/${key}?`), url);
  const store = { get: (k: string) => Promise.resolve({ body: new Blob([k]).stream() }) };
  const res = await handlePhotoRequest(new Request(url), store, SECRET);
  assertEquals(res.status, 200, url);
  assertEquals(await res.text(), key);
}

Deno.test('an Everyone jar shows only live Everyone moments, in slot order, with working URLs', async () => {
  const { status, json } = await call({ jarId: everyoneJar });
  assertEquals(status, 200);
  const d = json.data;
  assertEquals(d.kind, 'jar');
  assertEquals(d.assetBase, BASE);
  assertEquals(d.readers_only, false);
  assertEquals(d.moments.map((m: { id: string }) => m.id), [livePublic2, livePublic]);
  assertEquals(d.visible_count, 2);
  for (const m of d.moments) {
    assertEquals('photo_path' in m || 'thumb_path' in m, false);
    const key = m.full.slice(BASE.length + 1).split('?')[0];
    assert(key.startsWith(`moments/${owner.id}/`) && key.endsWith('/full.jpg'), key);
    await opens(m.full, key);
    await opens(m.thumb, key.replace('/full.jpg', '/thumb.jpg'));
  }
  const text = JSON.stringify(json);
  for (const hidden of [priv, checking, readersInEveryone]) assert(!text.includes(hidden));
  assertEquals(d.author.username, username);
  await opens(d.author.avatar, avatarKey);
  assertEquals(d.author.cover, null);
  assertEquals('avatar_path' in d.author, false);
});

Deno.test('a Readers jar is a teaser: no moments, nothing signed', async () => {
  const { status, json } = await call({ jarId: readersJar });
  assertEquals(status, 200);
  assertEquals(json.data.readers_only, true);
  assertEquals('moments' in json.data, false);
  assertEquals(json.data.visible_count, 1);
  assert(!JSON.stringify(json).includes(readersMoment));
});

Deno.test('Only me, unpublished and unknown jars all answer 404', async () => {
  for (const id of [onlyMeJar, draftJar, crypto.randomUUID()]) {
    const { status, json } = await call({ jarId: id });
    assertEquals(status, 404);
    assertEquals(json.error.code, 'not_found');
  }
});

Deno.test('a profile lists only its public jars, ignoring username case', async () => {
  const { status, json } = await call({ username: username.toUpperCase() });
  assertEquals(status, 200);
  assertEquals(json.data.kind, 'profile');
  assertEquals(json.data.jars.map((j: { id: string }) => j.id), [everyoneJar]);
  assertEquals(json.data.profile.cover, null);
  for (const hidden of [priv, readersInEveryone]) assert(!JSON.stringify(json).includes(hidden));
  assertEquals((await call({ username: 'nobody_here_x' })).status, 404);
});

Deno.test('a suspended author has no public page', async () => {
  const db = await admin();
  await db.from('profiles').update({ status: 'suspended' }).eq('id', owner.id);
  try {
    assertEquals((await call({ username })).status, 404);
    assertEquals((await call({ jarId: everyoneJar })).status, 404);
  } finally {
    await db.from('profiles').update({ status: 'active' }).eq('id', owner.id);
  }
});

Deno.test('bad input', async () => {
  assertEquals((await call({ username: '../etc' })).status, 400);
  assertEquals((await call({ jarId: 'nope' })).status, 400);
  assertEquals((await call({ username, jarId: everyoneJar })).status, 400);
  assertEquals((await call('not json')).status, 400);
  assertEquals((await call(undefined, 'GET')).status, 405);
});

Deno.test('cleanup', cleanup);
