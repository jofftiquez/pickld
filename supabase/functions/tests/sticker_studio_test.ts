// fn:sticker-studio (FR-MOD-10) against the local stack: only moderators upload; the art must be a PNG of at
// most 2048 pixels a side; it lands in the bucket under stickers/<slug>/<name>.png and is recorded with its
// size; a draft's art can be replaced (art_version goes up); a published pack's key is never written again.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { deletePrefix, getObject } from '../_shared/bucket.ts';
import { userClient } from '../_shared/env.ts';
import { handleStickerStudio, pngSize } from '../sticker-studio/handler.ts';
import { admin, cleanup, createUser, insert, localS3, type TestUser } from './local.ts';

const s3 = await localS3();
const db = await admin();
const slug = `t-studio-${crypto.randomUUID().slice(0, 8)}`;

/** The first bytes of a PNG: signature and IHDR. Enough for the size check and the bucket. */
function png(width: number, height: number, extra = 64): Uint8Array {
  const out = new Uint8Array(33 + extra);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(out.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  out.set([8, 6, 0, 0, 0], 24);
  crypto.getRandomValues(out.subarray(33, 33 + Math.min(extra, 65536)));
  return out;
}

const call = async (
  user: TestUser | undefined,
  fields: Record<string, string>,
  bytes: Uint8Array | null = png(320, 300),
  method = 'POST',
) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (bytes) form.set('file', new File([bytes as Uint8Array<ArrayBuffer>], 'art.png', { type: 'image/png' }));
  const headers: Record<string, string> = user ? { authorization: `Bearer ${user.jwt}` } : {};
  const req = new Request('http://fn.local/sticker-studio', {
    method,
    headers,
    body: method === 'POST' ? form : undefined,
  });
  const res = await handleStickerStudio(req, { s3: () => s3, userClient });
  // deno-lint-ignore no-explicit-any
  return { status: res.status, json: await res.json() as any };
};

let mod: TestUser, member: TestUser, packId: string, premiumId: string;

Deno.test('setup', async () => {
  mod = await createUser('studio', { role: 'moderator' });
  member = await createUser('member');
  const { data, error } = await userClient(mod.jwt).rpc('mod_studio_create_pack', {
    p_slug: slug,
    p_name: 'Studio test',
  });
  if (error) throw new Error(error.message);
  packId = data.id;
  premiumId =
    (await insert<{ id: string }>('sticker_packs', { slug: `${slug}-p`, name: 'Premium', tier: 'premium' })).id;
});

Deno.test('pngSize reads the IHDR and refuses anything else', () => {
  assertEquals(pngSize(png(640, 2048)), { width: 640, height: 2048 });
  assertEquals(pngSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)])), null);
  assertEquals(pngSize(png(9, 9).subarray(0, 20)), null);
});

Deno.test('only signed-in moderators upload', async () => {
  assertEquals((await call(undefined, { pack: packId, name: 'wave' })).status, 401);
  assertEquals((await call(mod, {}, null, 'GET')).status, 405);
  const asMember = await call(member, { pack: packId, name: 'wave' });
  assertEquals([asMember.status, asMember.json.error.code], [403, 'not_moderator']);
});

Deno.test('the art must be a PNG of at most 2048 pixels a side', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(1)]);
  assertEquals((await call(mod, { pack: packId, name: 'wave' }, jpeg)).json.error.code, 'not_png');
  assertEquals((await call(mod, { pack: packId, name: 'wave' }, png(2049, 10))).json.error.code, 'bad_size');
  assertEquals(
    (await call(mod, { pack: packId, name: 'wave' }, png(10, 10, 2 * 1024 * 1024))).json.error.code,
    'too_large',
  );
  assertEquals((await call(mod, { pack: packId, name: 'Wave Hi' })).json.error.code, 'invalid_input');
  assertEquals((await call(mod, { pack: packId, name: 'wave' }, null)).json.error.code, 'invalid_input');
  const premium = await call(mod, { pack: premiumId, name: 'wave' });
  assertEquals([premium.status, premium.json.error.code], [403, 'not_editable']);
});

Deno.test('a draft takes new art, then replaced art', async () => {
  const first = png(320, 300);
  const added = await call(mod, { pack: packId, name: 'wave', label: 'Hello wave' }, first);
  assertEquals(added.status, 200);
  assertEquals(added.json.data.result, 'added');
  assertEquals(added.json.data.key, `stickers/${slug}/wave.png`);
  assertEquals([added.json.data.width, added.json.data.height, added.json.data.version], [320, 300, 1]);
  assertEquals(await getObject(s3, `stickers/${slug}/wave.png`), first);

  const second = png(400, 410);
  const replaced = await call(mod, { pack: packId, name: 'wave' }, second);
  assertEquals([replaced.json.data.result, replaced.json.data.version], ['replaced', 2]);
  assertEquals(await getObject(s3, `stickers/${slug}/wave.png`), second);
  const { data: row } = await db.from('stickers').select('label, art_width, art_height, art_version')
    .eq('asset_path', `stickers/${slug}/wave.png`).single();
  assertEquals(row, { label: 'Hello wave', art_width: 400, art_height: 410, art_version: 2 });
});

Deno.test('a published pack never rewrites a key, but takes new names', async () => {
  const { data } = await userClient(mod.jwt).rpc('mod_studio_publish', { p_pack: packId });
  assertEquals(data.result, 'published');
  const before = await getObject(s3, `stickers/${slug}/wave.png`);
  const again = await call(mod, { pack: packId, name: 'wave' }, png(50, 50));
  assertEquals([again.status, again.json.error.code], [409, 'name_taken']);
  assertEquals(await getObject(s3, `stickers/${slug}/wave.png`), before, 'the published art is untouched');
  const fresh = await call(mod, { pack: packId, name: 'wave-2' }, png(50, 60));
  assertEquals([fresh.status, fresh.json.data.result], [200, 'added']);
});

Deno.test('cleanup', async () => {
  await deletePrefix(s3, `stickers/${slug}/`);
  await db.from('stickers').delete().in('pack_id', [packId, premiumId]);
  const del = await db.from('sticker_packs').delete().in('id', [packId, premiumId]);
  assert(!del.error, del.error?.message);
  await cleanup();
});
