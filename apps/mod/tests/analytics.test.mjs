// The Analytics page and a person's usage (FR-MOD-09), in Chromium against the local Supabase stack. The test
// makes its own person, two counted moments and one Only me moment, and a draft sticker pack nobody else can
// see, and deletes them afterwards. Other people may post while it runs, so site-wide numbers are only
// checked against each other on one render; the test's own sticker and person are checked exactly.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { signInWithCode } from './signIn.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3296;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MOD_EMAIL = 'mod-e2e-analytics@pickld.test';
const tag = randomUUID().slice(0, 6);
const slug = `e2e-an-${tag}`;
const label = `Analytics ${tag}`;
let ownerId, packId, web, browser, page;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function moderator() {
  const { users } = must(await admin.auth.admin.listUsers({ perPage: 1000 }));
  if (users.some((u) => u.email === MOD_EMAIL)) return;
  must(
    await admin.auth.admin.createUser({ email: MOD_EMAIL, email_confirm: true, app_metadata: { role: 'moderator' } }),
  );
}

before(async () => {
  await moderator();
  ownerId = must(await admin.auth.admin.createUser({ email: `owner-${tag}@an.pickld.test`, email_confirm: true })).user
    .id;
  must(
    await admin.from('profiles').insert({
      id: ownerId,
      username: `an_${tag}`,
      display_name: 'Analytics Owner',
      birthday: '1999-04-04',
      home_tz: 'Asia/Manila',
    }),
  );
  // A draft pack: only moderators can read it, and nobody can add it to a moment in the app (0100).
  packId = must(
    await admin
      .from('sticker_packs')
      .insert({ slug, name: `E2E ${tag}`, tier: 'free', status: 'draft' })
      .select('id')
      .single(),
  ).id;
  const sticker = must(
    await admin
      .from('stickers')
      .insert({ pack_id: packId, label, asset_path: `stickers/${slug}/wave.png`, art_width: 512, art_height: 512 })
      .select('id')
      .single(),
  );
  const jar = must(
    await admin
      .from('jars')
      .insert({
        user_id: ownerId,
        local_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
        tz: 'Asia/Manila',
        visibility: 'readers',
      })
      .select('id')
      .single(),
  );
  const edits = { overlays: [{ type: 'sticker', stickerId: sticker.id, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }] };
  must(
    await admin.from('moments').insert(
      [
        ['ootd', 'readers'],
        ['evening', 'everyone'],
        ['selfie', 'only_me'],
      ].map(([slot, visibility]) => ({
        jar_id: jar.id,
        user_id: ownerId,
        slot,
        visibility,
        is_private: visibility === 'only_me',
        status: 'checking',
        photo_path: `seed/photos/${slot}.jpg`,
        thumb_path: `seed/thumbs/${slot}.jpg`,
        edits,
      })),
    ),
  );

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
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  if (packId) {
    await admin.from('stickers').delete().eq('pack_id', packId);
    await admin.from('sticker_packs').delete().eq('id', packId);
  }
});

function tile(name) {
  return page
    .locator('dl > div')
    .filter({ has: page.locator('dt', { hasText: name }) })
    .locator('dd');
}

test('Analytics is a nav group of pages; Charts shows usage and the slots add up to the moments', async () => {
  // The old address opens Charts.
  await page.goto(`${base}/analytics`);
  await page.waitForURL(`${base}/analytics/charts`);
  await page.getByRole('heading', { level: 1, name: 'Charts' }).waitFor();
  const group = page.getByRole('group', { name: 'Analytics' });
  assert.equal(await group.getByRole('link', { name: 'Charts' }).getAttribute('aria-current'), 'page');
  for (const name of ['Audience', 'Packs', 'Top stickers']) {
    assert.equal(await group.getByRole('link', { name }).getAttribute('aria-current'), null, name);
  }
  await page.getByRole('heading', { name: 'Usage, last 30 days' }).waitFor();

  const moments = Number(await tile('Moments added').textContent());
  const slots = page.getByRole('region', { name: 'Moments per slot' }).locator('li');
  assert.equal(await slots.count(), 8);
  let sum = 0;
  for (const text of await slots.locator(':scope > span:last-child').allTextContents()) sum += Number(text);
  assert.ok(moments >= 2, 'the test’s two counted moments are included');
  assert.equal(sum, moments, 'every counted moment is in one slot');
  assert.equal(await page.getByRole('region', { name: 'By age' }).count(), 0, 'the tables are on their own page');
});

test('Audience shows the age and time zone groups', async () => {
  // The earlier Tables address opens Audience.
  await page.goto(`${base}/analytics/tables`);
  await page.waitForURL(`${base}/analytics/audience`);
  await page.goto(`${base}/analytics/charts`);
  await page.getByRole('group', { name: 'Analytics' }).getByRole('link', { name: 'Audience' }).click();
  await page.waitForURL(`${base}/analytics/audience`);
  await page.getByRole('heading', { level: 1, name: 'Audience' }).waitFor();
  const ages = page.getByRole('region', { name: 'By age' });
  assert.equal(await ages.locator('tbody tr').count(), 6);
  await page.getByRole('region', { name: 'By home time zone' }).waitFor();
  assert.equal(await page.getByRole('figure', { name: 'Moments per day' }).count(), 0, 'the graphs are on Charts');
});

test('a sticker’s uses count Readers and Everyone moments, not Only me ones', async () => {
  await page.goto(`${base}/analytics/stickers`);
  await page.getByRole('heading', { level: 1, name: 'Top stickers' }).waitFor();
  const row = page.getByRole('region', { name: 'Most used stickers' }).getByRole('row').filter({ hasText: label });
  assert.deepEqual(await row.locator('th, td').allTextContents(), [label, slug, '2', '1', 'New', '2']);
  await page.goto(`${base}/analytics/packs`);
  await page.getByRole('heading', { level: 1, name: 'Packs' }).waitFor();
  const pack = page.getByRole('region', { name: 'Sticker packs' }).getByRole('row').filter({ hasText: slug });
  assert.match(await pack.textContent(), /draft/);
  assert.deepEqual((await pack.locator('td').allTextContents()).slice(0, 5), ['Free', '—', '—', '1', '2']);
});

/** The likes cell's two lines: the all-time count, then the window's. */
async function thumbLines(row) {
  const cell = row.locator('td').last();
  const [full, inWindow] = await Promise.all([cell.textContent(), cell.locator('span span').textContent()]);
  return [full.slice(0, full.length - inWindow.length), inWindow];
}

test('Sticker packs and the Studio list show each pack’s likes, all time and in the window', async () => {
  const thumbsCell = async () => {
    await page.goto(`${base}/analytics/packs`);
    const row = page.getByRole('region', { name: 'Sticker packs' }).getByRole('row').filter({ hasText: 'everyday ·' });
    return thumbLines(row);
  };
  const studioCell = async () => {
    await page.goto(`${base}/stickers`);
    const row = page
      .getByRole('region', { name: 'Sticker packs' })
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: /^Everyday,/ }) });
    return row.locator('td').last().textContent();
  };
  const [all, inWindow] = (await thumbsCell()).map((line) => parseInt(line, 10));
  const studio = Number(await studioCell());
  assert.equal(studio, all, 'the Studio list shows the all-time count');

  // One more thumb, from the test person (an active account): both counts go up by one.
  const everyday = must(await admin.from('sticker_packs').select('id').eq('slug', 'everyday').single()).id;
  must(await admin.from('pack_thumbs').insert({ user_id: ownerId, pack_id: everyday }));
  assert.deepEqual(await thumbsCell(), [String(all + 1), `${inWindow + 1} in this window`]);
  assert.equal(Number(await studioCell()), all + 1);

  // A draft can't get thumbs, so the test's draft pack shows none.
  const draft = page.getByRole('region', { name: 'Sticker packs' }).getByRole('row').filter({ hasText: slug });
  await page.goto(`${base}/analytics/packs`);
  assert.deepEqual(await thumbLines(draft), ['0', '0 in this window']);
});

test('the window can be 7 or 90 days, and it carries over between the Analytics pages', async () => {
  await page.goto(`${base}/analytics/charts`);
  await page.getByRole('link', { name: '7 days' }).click();
  await page.waitForURL(`${base}/analytics/charts?days=7`);
  await page.getByRole('heading', { name: 'Usage, last 7 days' }).waitFor();
  assert.equal(await page.getByRole('link', { name: '7 days' }).getAttribute('aria-current'), 'page');
  await page.getByRole('group', { name: 'Analytics' }).getByRole('link', { name: 'Packs' }).click();
  await page.waitForURL(`${base}/analytics/packs?days=7`);
  assert.equal(await page.getByRole('link', { name: '7 days' }).getAttribute('aria-current'), 'page');
  await page.goto(`${base}/analytics?days=90`);
  await page.waitForURL(`${base}/analytics/charts?days=90`);
  await page.getByRole('heading', { name: 'Stickers, last 90 days' }).waitFor();
  assert.equal(await page.getByRole('figure', { name: 'Moments per day' }).locator('li').count(), 90);
});

test('a person’s page shows their usage for the last 30 days', async () => {
  await page.goto(`${base}/users/${ownerId}`);
  const usage = page.getByRole('region', { name: 'Usage, last 30 days' });
  await usage.waitFor();
  assert.match(await usage.textContent(), /Moments: 2 · Days active: 1 · All time: 2/);
  assert.match(await usage.textContent(), new RegExp(`${label} · ${slug} · 2 uses`));
  const slots = usage.getByRole('region', { name: 'Moments per slot' });
  assert.equal(
    await slots.locator('li').filter({ hasText: '#selfie' }).locator(':scope > span:last-child').textContent(),
    '0',
  );
  assert.equal(
    await slots.locator('li').filter({ hasText: '#ootd' }).locator(':scope > span:last-child').textContent(),
    '1',
  );
});
