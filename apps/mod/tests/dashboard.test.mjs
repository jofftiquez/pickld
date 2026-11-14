// The Overview and Users pages (FR-MOD-06, FR-MOD-07; D-132), in Chromium against the local Supabase stack.
// The test makes its own owner, jar, moment, queue item and report, and deletes the owner afterwards. Suspend
// and lift write audit rows that name their moderator and can't be deleted, so the moderator is one
// long-lived test account, reused across runs (like decide.test.mjs). Other test files run at the same time,
// so assertions only rely on this file's own rows.
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

const MOD_EMAIL = 'mod-e2e-dashboard@pickld.test';
const MOD_NAME = 'mod_e2e_dashboard';
const tag = randomUUID().slice(0, 6);
const username = `dash_${tag}`;
const ownerEmail = `owner-dash-${tag}@pickld.test`;
let web, browser, page, ownerId, moderatorId, itemId;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function moderator() {
  const { users } = must(await admin.auth.admin.listUsers({ perPage: 1000 }));
  let user = users.find((u) => u.email === MOD_EMAIL);
  if (!user) {
    user = must(
      await admin.auth.admin.createUser({ email: MOD_EMAIL, email_confirm: true, app_metadata: { role: 'moderator' } }),
    ).user;
  }
  // mod_suspend needs the moderator to have a profile (0090), and reports need a reporter profile.
  must(
    await admin.from('profiles').upsert(
      {
        id: user.id,
        username: MOD_NAME,
        display_name: 'Dashboard Moderator',
        birthday: '1990-01-01',
        home_tz: 'Asia/Manila',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
  );
  return user;
}

before(async () => {
  moderatorId = (await moderator()).id;
  ownerId = must(await admin.auth.admin.createUser({ email: ownerEmail, email_confirm: true })).user.id;
  must(
    await admin
      .from('profiles')
      .insert({ id: ownerId, username, display_name: 'Dash Owner', birthday: '1998-03-03', home_tz: 'Asia/Manila' }),
  );
  const jar = must(
    await admin
      .from('jars')
      .insert({ user_id: ownerId, local_date: '2026-11-09', tz: 'Asia/Manila', visibility: 'everyone' })
      .select('id')
      .single(),
  );
  const moment = must(
    await admin
      .from('moments')
      .insert({
        jar_id: jar.id,
        user_id: ownerId,
        slot: 'selfie',
        photo_path: 'seed/photos/selfie.jpg',
        thumb_path: 'seed/thumbs/selfie.jpg',
      })
      .select('id')
      .single(),
  );
  // Three hours old, so the Overview's two-hour warning shows.
  itemId = must(
    await admin
      .from('moderation_items')
      .insert({
        moment_id: moment.id,
        source: 'auto_check',
        created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
      })
      .select('id')
      .single(),
  ).id;
  must(
    await admin.from('reports').insert({
      reporter_id: moderatorId,
      target: 'profile',
      target_id: ownerId,
      reason: 'spam',
      note: 'Links everywhere',
    }),
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
  // The owner's profile, jar, moment and queue items go with the account; reports name their target by id
  // only, so they go first. The moderator stays.
  if (ownerId) {
    await admin.from('reports').delete().eq('target_id', ownerId);
    await admin.auth.admin.deleteUser(ownerId);
  }
});

/** The number in an Overview or Users tile, found by its label. */
async function tile(label) {
  const value = page.locator('dt', { hasText: label }).first().locator('xpath=following-sibling::dd[1]');
  return Number(await value.textContent());
}

test('home is the Overview: the late queue warning and today’s people', async () => {
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  await page
    .getByRole('alert')
    .getByText(/waited over 2 hours/)
    .waitFor();
  const queue = page.getByRole('region', { name: 'Review queue' });
  assert.ok(Number(await queue.locator('dd').first().textContent()) >= 1, 'at least our item is waiting');
  assert.ok((await tile('Sign-ups today')) >= 1, 'our owner signed up today');
  assert.ok((await tile('Posted today')) >= 1, 'our owner posted today');
  assert.equal(await page.locator('main img').count(), 0, 'the Overview shows no photos');
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Console' })
      .getByRole('link', { name: 'Overview' })
      .getAttribute('aria-current'),
    'page',
  );
});

test('Users finds an account by part of its username and by exact email', async () => {
  await page.goto(`${base}/users`);
  await page.getByRole('searchbox', { name: 'Search accounts' }).fill(`ash_${tag}`);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(/q=/);
  const results = page.getByRole('region', { name: 'Accounts' });
  await results.getByRole('link', { name: `@${username}, Active` }).waitFor();

  await page.goto(`${base}/users?q=${encodeURIComponent(ownerEmail.toUpperCase())}`);
  assert.equal(await results.getByRole('link').count(), 1);
  await results.getByRole('link', { name: `@${username}, Active` }).click();
  await page.waitForURL(`${base}/users/${ownerId}`);
  await page.getByRole('heading', { name: `@${username}` }).waitFor();
  await page.getByText(ownerEmail, { exact: false }).waitFor();
});

test('a user’s page shows their moments blurred, the report against them and no strikes', async () => {
  await page.goto(`${base}/users/${ownerId}`);
  const moments = page.getByRole('region', { name: 'Moments', exact: true });
  await moments.getByText('#selfie · Mon, Nov 9').waitFor();
  const reports = page.getByRole('region', { name: 'Reports against them' });
  await reports.getByText('Spam or scam').waitFor();
  await reports.getByText('“Links everywhere”').waitFor();
  await page.getByRole('region', { name: 'Strikes' }).getByText('No removals in the last 90 days.').waitFor();
  const photo = moments.locator('[data-blurred]');
  if ((await photo.count()) > 0) assert.equal(await photo.first().getAttribute('data-blurred'), 'true');
});

test('suspend for 7 days, then lift early, each with a note in the audit log', async () => {
  await page.goto(`${base}/users/${ownerId}`);
  const card = page.getByRole('region', { name: 'Suspension' });
  await card.getByLabel('Why are you suspending this account?').fill('Spam links in every caption');
  await card.getByRole('button', { name: 'Suspend for 7 days' }).click();
  await card.getByText('Suspended by a moderator').waitFor();
  await card.getByText(`@${MOD_NAME}`).waitFor();
  await page.getByText(/^Suspended until /).waitFor();
  const suspended = must(await admin.from('profiles').select('status, suspended_until').eq('id', ownerId).single());
  assert.equal(suspended.status, 'suspended');
  const days = (Date.parse(suspended.suspended_until) - Date.now()) / 86_400_000;
  assert.ok(days > 6.9 && days <= 7, `suspended for ${days} days`);
  assert.equal(await card.getByRole('button', { name: 'Suspend for 7 days' }).count(), 0);

  await card.getByLabel('Why are you lifting it?').fill('Owner cleaned up the captions');
  await card.getByRole('button', { name: 'Lift suspension' }).click();
  await card.getByText('Not suspended.').waitFor();
  assert.equal(must(await admin.from('profiles').select('status').eq('id', ownerId).single()).status, 'active');

  const history = page.getByRole('region', { name: 'Moderation history' });
  await history.getByText('Note: Spam links in every caption').waitFor();
  await history.getByText('Lifted early by a moderator · Note: Owner cleaned up the captions').waitFor();

  await page.goto(`${base}/audit?user=${ownerId}`);
  const log = page.getByRole('region', { name: 'Audit entries' });
  const rows = await log.getByRole('listitem').allTextContents();
  assert.equal(rows.length, 2, 'only actions about this account');
  assert.match(rows[0], /Lifted suspension/);
  assert.match(rows[1], /Suspended.*Note: Spam links in every caption/);
});

test('a moderator can’t suspend their own account', async () => {
  await page.goto(`${base}/users/${moderatorId}`);
  await page.getByRole('heading', { name: `@${MOD_NAME}` }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Suspend for 7 days' }).count(), 0);
});

test('the queue panel links the owner to their page', async () => {
  await page.goto(`${base}/queue?filter=all&item=${itemId}`);
  await page
    .getByRole('region', { name: 'Item details' })
    .getByRole('link', { name: new RegExp(`@${username}`) })
    .click();
  await page.waitForURL(`${base}/users/${ownerId}`);
});
