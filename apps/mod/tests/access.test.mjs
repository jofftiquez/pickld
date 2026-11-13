// Who gets into the moderation console (M3-25; FR-MOD-01), in Chromium against the local Supabase stack
// (`pnpm db:start`). Run after `next build` (see the test:e2e script). Keys come from `supabase status` at
// runtime; the test makes its own users through the admin API and deletes them afterwards.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3291;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let web, browser;
const users = [];

async function makeUser(role) {
  const email = `mod-e2e-${randomUUID().slice(0, 8)}@pickld.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: role ? { role } : {},
  });
  if (error) throw error;
  users.push(data.user.id);
  return email;
}

/** Signs a fresh browser context in the way the emailed link would (token_hash form of /auth/confirm). */
async function signedIn(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
  return page;
}

before(async () => {
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
});

after(async () => {
  await browser?.close();
  web?.kill();
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

test('signed out: every console page goes to sign-in', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/`);
  assert.equal(new URL(page.url()).pathname, '/sign-in');
  await page.getByRole('heading', { name: 'Moderator sign in' }).waitFor();
  await page.close();
});

test('a regular account sees access denied, not the queue, and can sign out', async () => {
  const email = await makeUser(null);
  const page = await signedIn(email);
  assert.equal(new URL(page.url()).pathname, '/');
  await page.getByRole('heading', { name: 'Moderators only' }).waitFor();
  assert.ok((await page.textContent('body')).includes(email));
  assert.equal(await page.getByRole('heading', { name: 'Review queue' }).count(), 0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(`${base}/sign-in`);
  await page.goto(`${base}/`);
  assert.equal(new URL(page.url()).pathname, '/sign-in');
});

test('a role set in user_metadata (which users can edit) does not let them in', async () => {
  const email = await makeUser(null);
  const { data } = await admin.auth.admin.listUsers();
  const id = data.users.find((u) => u.email === email).id;
  await admin.auth.admin.updateUserById(id, { user_metadata: { role: 'moderator' } });
  const page = await signedIn(email);
  await page.getByRole('heading', { name: 'Moderators only' }).waitFor();
});

test('a moderator gets the console', async () => {
  const email = await makeUser('moderator');
  const page = await signedIn(email);
  await page.getByRole('heading', { name: 'Review queue' }).waitFor();
  await page.getByRole('navigation', { name: 'Console' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Moderators only' }).count(), 0);

  // Help (M3-28): the playbook and the same guidelines file pickld.me/guidelines serves.
  await page.getByRole('link', { name: 'Help' }).click();
  await page.getByRole('heading', { name: 'Moderator playbook' }).waitFor();
  await page
    .getByRole('region', { name: 'Community Guidelines' })
    .getByRole('heading', { name: 'Community Guidelines' })
    .waitFor();
  assert.equal(await page.getByText('This document isn’t written yet.').count(), 0);
});

test('an expired or reused link says so', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/auth/confirm?token_hash=not-a-real-token&type=magiclink`);
  assert.equal(new URL(page.url()).pathname, '/sign-in');
  await page.getByText('That link has expired or was already used').waitFor();
  await page.close();
});

test('asking for a link answers the same for an address with no account', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/sign-in`);
  await page.getByLabel('Email').fill(`nobody-${randomUUID().slice(0, 8)}@pickld.test`);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByText('If that address belongs to a Pickld account').waitFor();
  await page.close();
});
