import { assertEquals } from 'jsr:@std/assert@1';
import { handlePhotoRequest, type PhotoStore } from '../src/handler.ts';
import { signPhotoToken, signPhotoUrl, verifyPhotoToken } from '../../../supabase/functions/_shared/photo_token.ts';
import { isObjectKey, keyOwner, newMomentKeys, newProfileImageKey } from '../../../supabase/functions/_shared/object_keys.ts';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const OTHER_SECRET = 'another-secret-that-is-at-least-32-characters';
const NOW = 1_800_000_000;
const USER = '0b6f4a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const BASE = 'https://photos.test';

const keys = newMomentKeys(USER);
const objects = new Map<string, string>([
  [keys.photo, 'FULL'],
  [keys.thumb, 'THUMB'],
]);
const store: PhotoStore = {
  get(key) {
    const v = objects.get(key);
    return Promise.resolve(
      v === undefined ? null : { body: new Blob([v]).stream(), contentType: 'image/jpeg', size: v.length, etag: '"e"' },
    );
  },
};

async function get(url: string, now = NOW, method = 'GET') {
  const res = await handlePhotoRequest(new Request(url, { method }), store, SECRET, now);
  return { status: res.status, body: await res.text(), headers: res.headers };
}

Deno.test('a valid token serves the full photo and the thumbnail', async () => {
  for (const [key, body] of [[keys.photo, 'FULL'], [keys.thumb, 'THUMB']]) {
    const { url } = await signPhotoUrl(BASE, key, SECRET, 900, NOW);
    const res = await get(url);
    assertEquals(res.status, 200);
    assertEquals(res.body, body);
    assertEquals(res.headers.get('content-type'), 'image/jpeg');
    assertEquals(res.headers.get('cache-control'), 'private, max-age=900');
  }
});

Deno.test('HEAD with a valid token returns headers only', async () => {
  const { url } = await signPhotoUrl(BASE, keys.thumb, SECRET, 900, NOW);
  const res = await get(url, NOW, 'HEAD');
  assertEquals(res.status, 200);
  assertEquals(res.body, '');
});

Deno.test('no token is 403', async () => {
  assertEquals((await get(`${BASE}/${keys.photo}`)).status, 403);
  assertEquals((await get(`${BASE}/${keys.photo}?exp=${NOW + 60}`)).status, 403);
});

Deno.test('an expired token is 403', async () => {
  const { url, exp } = await signPhotoUrl(BASE, keys.photo, SECRET, 900, NOW);
  assertEquals((await get(url, exp - 1)).status, 200);
  assertEquals((await get(url, exp)).status, 403);
  assertEquals((await get(url, exp + 3600)).status, 403);
});

Deno.test('a tampered token is 403', async () => {
  const { url } = await signPhotoUrl(BASE, keys.photo, SECRET, 900, NOW);
  const u = new URL(url);
  const sig = u.searchParams.get('sig')!;

  // signature changed by one character
  const flipped = new URL(url);
  flipped.searchParams.set('sig', (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1));
  assertEquals((await get(flipped.toString())).status, 403);

  // expiry extended
  const extended = new URL(url);
  extended.searchParams.set('exp', String(Number(u.searchParams.get('exp')) + 600));
  assertEquals((await get(extended.toString())).status, 403);

  // token moved to another photo (the full photo's token on the thumbnail)
  assertEquals((await get(`${BASE}/${keys.thumb}${u.search}`)).status, 403);

  // signed with another secret
  const forged = await signPhotoUrl(BASE, keys.photo, OTHER_SECRET, 900, NOW);
  assertEquals((await get(forged.url)).status, 403);

  // garbage
  assertEquals((await get(`${BASE}/${keys.photo}?exp=abc&sig=${sig}`)).status, 403);
  assertEquals((await get(`${BASE}/${keys.photo}?exp=${NOW + 60}&sig=not*base64`)).status, 403);
});

Deno.test('a token valid longer than the maximum lifetime is refused', async () => {
  // Signed by someone holding the secret but with an absurd expiry: the Worker caps lifetime at 1 hour.
  const { exp, sig } = await signPhotoToken(keys.photo, SECRET, 3600, NOW + 7200);
  assertEquals(await verifyPhotoToken(keys.photo, String(exp), sig, SECRET, NOW), 'invalid');
});

Deno.test('malformed keys and traversal are 403, unknown keys 404', async () => {
  for (const key of ['../secret.jpg', 'moments/x/y/full.jpg', `moments/${USER}/a/full.png`, 'other/file.jpg']) {
    const { exp, sig } = await signPhotoToken(key, SECRET, 900, NOW);
    assertEquals((await get(`${BASE}/${key}?exp=${exp}&sig=${sig}`)).status, 403, key);
  }
  const missing = newMomentKeys(USER).photo;
  assertEquals((await get((await signPhotoUrl(BASE, missing, SECRET, 900, NOW)).url)).status, 404);
});

Deno.test('writes are refused', async () => {
  const { url } = await signPhotoUrl(BASE, keys.photo, SECRET, 900, NOW);
  for (const method of ['PUT', 'POST', 'DELETE']) {
    const res = await handlePhotoRequest(new Request(url, { method }), store, SECRET, NOW);
    assertEquals(res.status, 405, method);
  }
});

Deno.test('every upload gets a new key, so nothing is overwritten', () => {
  const a = newMomentKeys(USER);
  const b = newMomentKeys(USER);
  assertEquals(a.photo === b.photo, false);
  assertEquals(newProfileImageKey('avatar', USER) === newProfileImageKey('avatar', USER), false);
  for (const k of [a.photo, a.thumb, newProfileImageKey('avatar', USER), newProfileImageKey('cover', USER)]) {
    assertEquals(isObjectKey(k), true, k);
    assertEquals(keyOwner(k), USER, k);
  }
  assertEquals(isObjectKey('seed/photos/morning.jpg'), true);
  assertEquals(keyOwner('seed/photos/morning.jpg'), null);
});
