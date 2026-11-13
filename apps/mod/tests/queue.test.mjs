// The review queue (M3-26; FR-MOD-02, FR-MOD-03), in Chromium against the local Supabase stack. The test
// makes its own owner, jar, moments and queue items through the admin API and deletes them afterwards;
// assertions only look at its own rows, so other data in the database doesn't matter.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3292;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tag = randomUUID().slice(0, 6);
const username = `qe2e_${tag}`;
let web, browser, page, moderatorId, ownerId;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function makeUser(prefix, role) {
  const { user } = must(
    await admin.auth.admin.createUser({
      email: `${prefix}-${tag}@pickld.test`,
      email_confirm: true,
      app_metadata: role ? { role } : {},
    }),
  );
  return user;
}

async function moment(jarId, slot) {
  const row = must(
    await admin
      .from('moments')
      .insert({
        jar_id: jarId,
        user_id: ownerId,
        slot,
        photo_path: `seed/photos/${slot}.jpg`,
        thumb_path: `seed/thumbs/${slot}.jpg`,
      })
      .select('id')
      .single(),
  );
  return row.id;
}

const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

before(async () => {
  const moderator = await makeUser('mod-queue', 'moderator');
  moderatorId = moderator.id;
  ownerId = (await makeUser('owner-queue', null)).id;
  must(
    await admin
      .from('profiles')
      .insert({ id: ownerId, username, display_name: 'Queue Owner', birthday: '1995-05-05', home_tz: 'Asia/Manila' }),
  );
  const jar = must(
    await admin
      .from('jars')
      .insert({ user_id: ownerId, local_date: '2026-11-07', tz: 'Asia/Manila', visibility: 'everyone' })
      .select('id')
      .single(),
  );
  const auto = await moment(jar.id, 'whereami');
  const reported = await moment(jar.id, 'mebusywith');
  const escalated = await moment(jar.id, 'ootd');
  must(await admin.from('moments').update({ caption: 'Fireworks on the pier' }).eq('id', auto));
  // One at a time, so each row keeps the column defaults it doesn't set.
  for (const row of [
    {
      moment_id: auto,
      source: 'auto_check',
      scores: { provider: 'openai', scores: { violence: 0.82 } },
      decision_reason: 'violence',
      created_at: minutesAgo(180),
    },
    { moment_id: reported, source: 'report', created_at: minutesAgo(90) },
    { moment_id: escalated, source: 'auto_check', status: 'escalated', created_at: minutesAgo(30) },
  ]) {
    must(await admin.from('moderation_items').insert(row));
  }

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
  const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email: moderator.email }));
  page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`);
});

after(async () => {
  await browser?.close();
  web?.kill();
  // Deleting the owner cascades to the profile, jar, moments and their queue items.
  for (const id of [ownerId, moderatorId]) if (id) await admin.auth.admin.deleteUser(id);
});

const rows = () => page.getByRole('link', { name: new RegExp(`from @${username}`) });

test('All lists open items oldest first; decided-or-not filters narrow it', async () => {
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: 'Review queue' }).waitFor();
  const labels = await rows().evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(
    labels.map((l) => l.split(' from ')[0]),
    ['Violence or dangerous acts', 'No reason given', 'No reason given'],
    'auto-check (3 h), report (1 h 30), escalated (30 min)',
  );
  assert.match(labels[0], /waiting 3h$/);

  await page.getByRole('navigation', { name: 'Filter the queue' }).getByRole('link', { name: 'Escalated' }).click();
  await page.waitForURL(/filter=escalated/);
  assert.equal(await rows().count(), 1);
  await page.getByRole('navigation', { name: 'Filter the queue' }).getByRole('link', { name: 'Reports' }).click();
  await page.waitForURL(/filter=report/);
  assert.equal(await rows().count(), 1);
});

test('counts match the open items in the database', async () => {
  await page.goto(`${base}/`);
  const { count } = await admin
    .from('moderation_items')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'escalated']);
  const pill = page.getByRole('navigation', { name: 'Console' }).getByLabel(`${count} open`).first();
  await pill.waitFor();
  assert.equal(await pill.textContent(), String(count));
});

test('the panel shows the selected item, with the photo blurred until Show photo', async (t) => {
  await page.goto(`${base}/?filter=auto_check`);
  await rows().first().click();
  const panel = page.getByRole('region', { name: 'Item details' });
  await panel.getByRole('heading', { name: '#whereami · Sat, Nov 7' }).waitFor();
  await panel.getByText('Violence or dangerous acts (score 0.82)').waitFor();
  await panel.getByText('“Fireworks on the pier”').waitFor();
  await panel.getByText(`@${username} · joined`, { exact: false }).waitFor();
  // Photo URLs come from fn:photo-urls, which CI doesn't serve (its Edge Function tests call handlers
  // directly); without them the panel says so, and there is nothing to blur.
  if (await panel.getByText('Photo unavailable').isVisible()) {
    t.skip('fn:photo-urls is not being served (run pnpm fn:serve to check the blur)');
    return;
  }
  assert.equal(await panel.locator('[data-blurred]').getAttribute('data-blurred'), 'true');
  await panel.getByRole('button', { name: 'Show photo' }).click();
  assert.equal(await panel.locator('[data-blurred]').getAttribute('data-blurred'), 'false');
});
