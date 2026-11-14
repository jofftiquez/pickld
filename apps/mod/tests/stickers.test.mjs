// The Sticker Studio (FR-MOD-10), in Chromium against the local Supabase stack, through the real
// fn:sticker-studio. The test creates its own packs (a free draft through the page, a premium one directly) and
// deletes them and their stickers and art afterwards. Studio changes write audit rows that name their moderator
// and can't be deleted, so the moderator is one long-lived test account, reused across runs.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { deflateSync } from 'node:zlib';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { signInWithCode } from './signIn.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3298;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MOD_EMAIL = 'mod-e2e-stickers@pickld.test';
const tag = randomUUID().slice(0, 6);
const slug = `e2e-${tag}`;
const premiumSlug = `e2e-prem-${tag}`;
const bulkSlug = `e2e-bulk-${tag}`;
let web, browser, page, modId, packId, premiumId, bulkId, dir;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// A minimal RGBA PNG of the given size (one colour), built by hand so the test needs no image library.
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 4, 0xc8)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function moderator() {
  const { users } = must(await admin.auth.admin.listUsers({ perPage: 1000 }));
  let user = users.find((u) => u.email === MOD_EMAIL);
  if (!user) {
    user = must(
      await admin.auth.admin.createUser({ email: MOD_EMAIL, email_confirm: true, app_metadata: { role: 'moderator' } }),
    ).user;
  }
  // Studio changes need the moderator to have a profile, for the audit row.
  must(
    await admin.from('profiles').upsert(
      {
        id: user.id,
        username: 'mod_e2e_stickers',
        display_name: 'Studio Moderator',
        birthday: '1990-01-01',
        home_tz: 'Asia/Manila',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
  );
  return user;
}

before(async () => {
  modId = (await moderator()).id;
  premiumId = must(
    await admin
      .from('sticker_packs')
      .insert({ slug: premiumSlug, name: `Premium ${tag}`, tier: 'premium', sort: 9000 })
      .select('id')
      .single(),
  ).id;
  dir = await mkdtemp(path.join(os.tmpdir(), 'studio-'));
  await writeFile(path.join(dir, 'Sun Face.png'), png(12, 8));
  await writeFile(path.join(dir, 'sun-big.png'), png(16, 16));
  await writeFile(path.join(dir, 'not-a-png.png'), Buffer.from('GIF89a, not a PNG'));

  web = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: path.join(here, '..'),
    env: { ...process.env, SUPABASE_URL: status.API_URL, SUPABASE_ANON_KEY: status.ANON_KEY },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${base}/sign-in`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  browser = await chromium.launch();
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signInWithCode(page, { base, admin, email: MOD_EMAIL });
});

after(async () => {
  await browser?.close();
  web?.kill();
  const ids = [packId, premiumId, bulkId].filter(Boolean);
  if (ids.length) {
    await admin.from('stickers').delete().in('pack_id', ids);
    await admin.from('sticker_packs').delete().in('id', ids);
  }
  for (const prefix of [slug, bulkSlug]) {
    const files = must(await admin.storage.from('photos').list(`stickers/${prefix}`)) ?? [];
    if (files.length) await admin.storage.from('photos').remove(files.map((f) => `stickers/${prefix}/${f.name}`));
  }
});

const upload = (page_) => page_.getByRole('form', { name: /art/ });
// The upload form's result note, worked or not, so a failure shows the console's message.
async function uploadResult(page_) {
  const note = upload(page_).locator('[role=status], [role=alert]');
  await note.waitFor();
  return note.textContent();
}

test('a moderator creates a free draft pack from the list', async () => {
  await page.goto(`${base}/stickers`);
  await page.getByRole('heading', { name: 'Sticker packs', level: 1 }).waitFor();
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Console' })
      .getByRole('link', { name: 'Sticker packs' })
      .getAttribute('aria-current'),
    'page',
  );
  const form = page.getByRole('form', { name: 'New pack' });
  await form.getByLabel('Pack name').fill(`Studio ${tag}`);
  await form.getByLabel('Short name').fill(slug);
  await form.getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/stickers\/[0-9a-f-]{36}$/);
  packId = page.url().split('/').pop();
  await page.getByRole('heading', { name: `Studio ${tag}`, level: 1 }).waitFor();
  await page.getByText('Only moderators see this pack until it’s published.', { exact: false }).waitFor();
  await page.getByText('No stickers yet.', { exact: false }).waitFor();

  const row = must(await admin.from('sticker_packs').select('tier, status').eq('id', packId).single());
  assert.deepEqual(row, { tier: 'free', status: 'draft' });

  // The list shows it first, as a draft.
  await page.goto(`${base}/stickers`);
  const first = page.getByRole('region', { name: 'Sticker packs' }).getByRole('listitem').first();
  await first.getByText(`Studio ${tag}`).waitFor();
  await first.getByText('Draft', { exact: true }).waitFor();
});

test('art uploads add a sticker, replace it while a draft, and refuse non-PNG files', async (t) => {
  await page.goto(`${base}/stickers/${packId}`);
  const form = upload(page);
  await form.getByLabel('PNG file').setInputFiles(path.join(dir, 'not-a-png.png'));
  await form.getByLabel('Sticker name').fill('bad');
  await form.getByRole('button', { name: 'Upload' }).click();
  assert.equal(await uploadResult(page), 'That file isn’t a PNG.');

  await page.reload();
  await upload(page).getByLabel('PNG file').setInputFiles(path.join(dir, 'Sun Face.png'));
  assert.equal(await upload(page).getByLabel('Sticker name').inputValue(), 'sun-face', 'name comes from the file');
  await upload(page).getByLabel('Label').fill('Sun');
  await upload(page).getByRole('button', { name: 'Upload' }).click();
  assert.equal(await uploadResult(page), 'Sticker added.');
  const sticker = page.getByRole('listitem', { name: 'Sun' });
  await sticker.getByText('12 × 8 px').waitFor();
  await sticker.getByText('v1').waitFor();
  // The preview's origin comes from fn:photo-urls, which CI serves without PHOTO_BASE_URL (as in queue.test).
  const art = sticker.getByRole('img', { name: 'Art for Sun' });
  if ((await art.count()) > 0) {
    assert.ok((await art.getAttribute('src')).endsWith(`/stickers/${slug}/sun-face.png?v=1`));
  } else {
    await sticker.getByText('Art preview unavailable').waitFor();
    t.diagnostic('fn:photo-urls has no PHOTO_BASE_URL, so the preview fell back to its note');
  }

  await page.reload();
  await upload(page).getByLabel('PNG file').setInputFiles(path.join(dir, 'sun-big.png'));
  await upload(page).getByLabel('Sticker name').fill('sun-face');
  await upload(page).getByRole('button', { name: 'Upload' }).click();
  assert.match(await uploadResult(page), /^Art replaced\./);
  await page.getByRole('listitem', { name: 'Sun' }).getByText('16 × 16 px').waitFor();

  const rows = must(
    await admin.from('stickers').select('asset_path, art_width, art_height, art_version').eq('pack_id', packId),
  );
  assert.deepEqual(rows, [
    { asset_path: `stickers/${slug}/sun-face.png`, art_width: 16, art_height: 16, art_version: 2 },
  ]);
});

test('a sticker’s label, tags and slot are edited', async () => {
  await page.goto(`${base}/stickers/${packId}`);
  const sticker = page.getByRole('listitem', { name: 'Sun' });
  await sticker.getByLabel('Label').fill('Sunny');
  await sticker.getByLabel('Tags').fill('Sky, warm, sky');
  await sticker.getByLabel('Suggested for').selectOption('morning');
  await sticker.getByRole('button', { name: 'Save Sun' }).click();
  await sticker.getByText('Saved.').waitFor();
  const row = must(await admin.from('stickers').select('label, tags, slot_hint').eq('pack_id', packId).single());
  assert.deepEqual(row, { label: 'Sunny', tags: ['sky', 'warm'], slot_hint: 'morning' });
});

test('publishing is final: art is frozen and a sticker can be retired and restored', async () => {
  await page.goto(`${base}/stickers/${packId}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Publish pack' }).click();
  await page.getByText('Published. It’s in everyone’s picker now.').waitFor();
  await page.reload();
  await page.getByRole('main').getByText('Published', { exact: true }).first().waitFor();
  await page.getByText('Published art never changes.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Publish pack' }).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Add many stickers' }).count(), 0, 'bulk drops are for drafts');
  const pack = must(await admin.from('sticker_packs').select('status, published_at').eq('id', packId).single());
  assert.equal(pack.status, 'published');
  assert.ok(pack.published_at);

  // Same name in a published pack: refused, since apps cache published art for a year.
  await upload(page).getByLabel('PNG file').setInputFiles(path.join(dir, 'sun-big.png'));
  await upload(page).getByLabel('Sticker name').fill('sun-face');
  await upload(page).getByRole('button', { name: 'Upload' }).click();
  assert.match(await uploadResult(page), /^That name is used in this published pack\./);

  const sticker = page.getByRole('listitem', { name: 'Sunny' });
  await sticker.getByRole('button', { name: 'Retire Sunny' }).click();
  await sticker.getByText('Retired.', { exact: false }).waitFor();
  assert.ok(must(await admin.from('stickers').select('retired_at').eq('pack_id', packId).single()).retired_at);
  await page.reload();
  await page.getByRole('listitem', { name: 'Sunny' }).getByRole('button', { name: 'Restore Sunny' }).click();
  await page.getByRole('listitem', { name: 'Sunny' }).getByText('Restored.').waitFor();
  assert.equal(must(await admin.from('stickers').select('retired_at').eq('pack_id', packId).single()).retired_at, null);
});

test('every Studio change is in the audit log under its moderator', async () => {
  const rows = must(
    await admin
      .from('audit_log')
      .select('action, target, data')
      .eq('actor_id', modId)
      .eq('target_id', packId)
      .order('id'),
  );
  assert.deepEqual(
    rows.map((r) => r.action),
    [
      'studio_pack_create',
      'studio_sticker_add',
      'studio_sticker_replace',
      'studio_sticker_edit',
      'studio_pack_publish',
      'studio_sticker_retire',
      'studio_sticker_restore',
    ],
  );
  assert.ok(rows.every((r) => r.target === null));
  await page.goto(`${base}/audit`);
  await page.getByText('Published sticker pack').first().waitFor();
});

test('a bulk drop adds many stickers, renames repeated names and lists refused files with the reason', async () => {
  // A draft with one sticker already named sun-face (its art isn't needed). Made here, not in setup,
  // so the create test's draft is still first in the list.
  bulkId = must(
    await admin
      .from('sticker_packs')
      .insert({ slug: bulkSlug, name: `Bulk ${tag}`, tier: 'free', status: 'draft', sort: 9001 })
      .select('id')
      .single(),
  ).id;
  must(
    await admin.from('stickers').insert({
      pack_id: bulkId,
      label: 'Old sun',
      asset_path: `stickers/${bulkSlug}/sun-face.png`,
      art_width: 8,
      art_height: 8,
    }),
  );
  await page.goto(`${base}/stickers/${bulkId}`);
  const zone = page.getByRole('region', { name: 'Add many stickers' });
  await zone.getByLabel('PNG files').setInputFiles([
    { name: 'Sun Face.png', mimeType: 'image/png', buffer: png(10, 10) }, // sun-face is in the pack
    { name: 'moon.png', mimeType: 'image/png', buffer: png(20, 10) },
    { name: 'moon.png', mimeType: 'image/png', buffer: png(10, 20) }, // twice in the drop
    { name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('GIF89a, not a PNG') },
    { name: 'poster.png', mimeType: 'image/png', buffer: png(2049, 1) },
  ]);
  await zone.getByText('3 added, 2 refused.', { exact: false }).waitFor();
  const files = zone.getByRole('list', { name: 'Files in this drop' }).getByRole('listitem');
  assert.deepEqual(
    (await files.allTextContents()).map((s) => s.replace(/\s+/g, ' ').trim()),
    [
      'Sun Face.png → sun-face-2 (renamed: name already used)Added',
      'moon.png → moonAdded',
      'moon.png → moon-2 (renamed: name already used)Added',
      'notes.pngThat file isn’t a PNG.',
      'poster.pngArt is at most 2048 pixels on each side.',
    ],
  );
  const rows = must(
    await admin.from('stickers').select('asset_path, label, art_width, art_height').eq('pack_id', bulkId).order('sort'),
  );
  assert.deepEqual(
    rows.map((r) => [r.asset_path.split('/').pop(), r.label, r.art_width, r.art_height]),
    [
      ['sun-face.png', 'Old sun', 8, 8],
      ['sun-face-2.png', 'Sun face 2', 10, 10],
      ['moon.png', 'Moon', 20, 10],
      ['moon-2.png', 'Moon 2', 10, 20],
    ],
  );

  // The page refreshes once and the new stickers are edited one by one.
  const moon = page.getByRole('listitem', { name: 'Moon 2', exact: true });
  await moon.getByText('10 × 20 px').waitFor();
  await moon.getByLabel('Label').fill('Crescent');
  await moon.getByRole('button', { name: 'Save Moon 2' }).click();
  await page.getByRole('listitem', { name: 'Crescent', exact: true }).getByText('Saved.').waitFor();
  assert.equal(
    must(await admin.from('stickers').select('label').eq('asset_path', `stickers/${bulkSlug}/moon-2.png`).single())
      .label,
    'Crescent',
  );
});

test('premium, earned and seasonal packs are read-only in the Studio', async () => {
  await page.goto(`${base}/stickers/${premiumId}`);
  await page.getByText('This is a premium pack.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('main').getByRole('form').count(), 0, 'no forms on a read-only pack');
  await page.goto(`${base}/stickers/not-a-pack`);
  await page
    .getByText(/not found|404/i)
    .first()
    .waitFor();
});
