// fn:upload-url against the local stack: validation, ownership, suspended users, expiry, and real
// uploads to the local bucket with the returned URLs.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { userClient } from '../_shared/env.ts';
import { handleUploadUrl, SIZE_LIMITS, UPLOAD_URL_TTL_SECONDS } from '../upload-url/handler.ts';
import { admin, cleanup, createUser, insert, localDate, localS3, request, type TestUser } from './local.ts';

const s3 = await localS3();
const deps = { s3: () => s3, userClient };
const call = async (body: unknown, user?: TestUser, opts: { now?: Date; method?: string } = {}) => {
  const res = await handleUploadUrl(request('upload-url', { jwt: user?.jwt, body, method: opts.method }), {
    ...deps,
    now: opts.now ? () => opts.now! : undefined,
  });
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

const owner = await createUser('owner');
const other = await createUser('other');
const suspended = await createUser('suspended');
await (await admin()).from('profiles').update({ status: 'suspended' }).eq('id', suspended.id);
const ownJar = await insert<{ id: string }>('jars', {
  user_id: owner.id,
  local_date: localDate(),
  tz: 'Asia/Manila',
  visibility: 'everyone',
  published_at: new Date().toISOString(),
});
const othersJar = await insert<{ id: string }>('jars', {
  user_id: other.id,
  local_date: localDate(),
  tz: 'Asia/Manila',
  visibility: 'everyone', // published and visible to owner, but not theirs
  published_at: new Date().toISOString(),
});
const suspendedJar = await insert<{ id: string }>('jars', {
  user_id: suspended.id,
  local_date: localDate(),
  tz: 'Asia/Manila',
});

const PHOTO = new Uint8Array(1200).fill(1);
const THUMB = new Uint8Array(300).fill(2);
const momentBody = (jarId: string) => ({
  kind: 'moment',
  jarId,
  photo: { contentType: 'image/webp', size: PHOTO.length },
  thumb: { contentType: 'image/webp', size: THUMB.length },
});

Deno.test('owner gets photo and thumbnail URLs that upload to new keys', async () => {
  const { status, json } = await call(momentBody(ownJar.id), owner);
  assertEquals(status, 200);
  const { photo, thumb } = json.data.files;
  assertMatch(photo.key, new RegExp(`^moments/${owner.id}/[0-9a-f-]{36}/full\\.jpg$`));
  assertEquals(thumb.key, photo.key.replace('full.jpg', 'thumb.jpg'));
  for (const [u, bytes] of [[photo, PHOTO], [thumb, THUMB]] as const) {
    const res = await fetch(u.url, { method: 'PUT', headers: u.headers, body: bytes });
    assertEquals(res.status, 200, await res.text());
  }
  const again = await call(momentBody(ownJar.id), owner);
  assert(again.json.data.files.photo.key !== photo.key, 'a second request gets a different key');
});

Deno.test('URLs expire within 10 minutes and sign the content type and size', async () => {
  const now = new Date();
  const { json } = await call(momentBody(ownJar.id), owner, { now });
  const url = new URL(json.data.files.photo.url);
  assertEquals(Number(url.searchParams.get('X-Amz-Expires')), UPLOAD_URL_TTL_SECONDS);
  assert(UPLOAD_URL_TTL_SECONDS <= 600);
  assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  assert(new Date(json.data.expiresAt).getTime() - now.getTime() <= 600_000);
});

Deno.test('the bucket refuses an upload that differs from what was signed, or an expired URL', async () => {
  const { json } = await call(momentBody(ownJar.id), owner);
  const { photo } = json.data.files;
  const bigger = new Uint8Array(PHOTO.length + 10);
  const wrongSize = await fetch(photo.url, {
    method: 'PUT',
    headers: { ...photo.headers, 'content-length': String(bigger.length) },
    body: bigger,
  });
  await wrongSize.body?.cancel();
  assert(wrongSize.status >= 400, `different size refused (got ${wrongSize.status})`);
  const wrongType = await fetch(photo.url, {
    method: 'PUT',
    headers: { ...photo.headers, 'content-type': 'image/png' },
    body: PHOTO,
  });
  await wrongType.body?.cancel();
  assert(wrongType.status >= 400, `different content type refused (got ${wrongType.status})`);

  const old = await call(momentBody(ownJar.id), owner, { now: new Date(Date.now() - 11 * 60_000) });
  const p = old.json.data.files.photo;
  const expired = await fetch(p.url, { method: 'PUT', headers: p.headers, body: PHOTO });
  await expired.body?.cancel();
  assert(expired.status >= 400, `URL signed 11 minutes ago is refused (got ${expired.status})`);
});

Deno.test('a jar the caller does not own is refused, even a published one they can see', async () => {
  const { status, json } = await call(momentBody(othersJar.id), owner);
  assertEquals(status, 403);
  assertEquals(json.error.code, 'jar_not_owned');
  const missing = await call(momentBody(crypto.randomUUID()), owner);
  assertEquals(missing.status, 403);
});

Deno.test('a suspended user is refused for moments, avatars and covers', async () => {
  for (const body of [momentBody(suspendedJar.id), { kind: 'avatar', file: { contentType: 'image/jpeg', size: 100 } }]) {
    const { status, json } = await call(body, suspended);
    assertEquals(status, 403);
    assertEquals(json.error.code, 'account_inactive');
  }
});

Deno.test('avatar and cover URLs', async () => {
  for (const kind of ['avatar', 'cover'] as const) {
    const { status, json } = await call({ kind, file: { contentType: 'image/jpeg', size: PHOTO.length } }, owner);
    assertEquals(status, 200);
    const f = json.data.files.file;
    assertMatch(f.key, new RegExp(`^${kind}s/${owner.id}/[0-9a-f-]{36}\\.jpg$`));
    const res = await fetch(f.url, { method: 'PUT', headers: f.headers, body: PHOTO });
    assertEquals(res.status, 200, await res.text());
  }
});

Deno.test('input is validated', async () => {
  const bad: unknown[] = [
    { kind: 'moment', jarId: 'not-a-uuid', photo: { contentType: 'image/jpeg', size: 1 }, thumb: { contentType: 'image/jpeg', size: 1 } },
    { ...momentBody(ownJar.id), photo: { contentType: 'image/png', size: 100 } },
    { ...momentBody(ownJar.id), photo: { contentType: 'image/jpeg', size: SIZE_LIMITS.photo + 1 } },
    { ...momentBody(ownJar.id), thumb: { contentType: 'image/jpeg', size: SIZE_LIMITS.thumb + 1 } },
    { ...momentBody(ownJar.id), photo: { contentType: 'image/jpeg', size: 0 } },
    { ...momentBody(ownJar.id), userId: other.id },
    { kind: 'avatar', file: { contentType: 'image/jpeg', size: SIZE_LIMITS.avatar + 1 } },
    { kind: 'sticker', file: { contentType: 'image/jpeg', size: 10 } },
    {},
  ];
  for (const body of bad) {
    const { status, json } = await call(body, owner);
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(json.error.code, 'invalid_input');
  }
  const notJson = await call('{nope', owner);
  assertEquals(notJson.status, 400);
  assertEquals(notJson.json.error.code, 'invalid_json');
});

Deno.test('callers must be signed in and use POST', async () => {
  assertEquals((await call(momentBody(ownJar.id))).status, 401);
  assertEquals((await call(momentBody(ownJar.id), { ...owner, jwt: 'not.a.jwt' })).status, 401);
  assertEquals((await call(undefined, owner, { method: 'GET' })).status, 405);
});

Deno.test({ name: 'cleanup', fn: cleanup, sanitizeResources: false, sanitizeOps: false });
