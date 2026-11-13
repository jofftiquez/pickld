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

import { signInWithCode } from './signIn.mjs';

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

/** Signs a fresh browser context in through the sign-in form with the emailed code. */
async function signedIn(email) {
  return signInWithCode(await (await browser.newContext()).newPage(), { base, admin, email });
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

test('a wrong or expired code says so and keeps the code step; Use a different email goes back', async () => {
  const email = await makeUser(null);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('Enter the 6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText("That code isn't right, or it has expired.").waitFor();
  assert.equal(new URL(page.url()).pathname, '/sign-in');
  await page.getByLabel('Enter the 6-digit code').waitFor();
  await page.goto(`${base}/`);
  assert.equal(new URL(page.url()).pathname, '/sign-in', 'still signed out');

  await page.getByRole('button', { name: 'Use a different email' }).click();
  await page.getByRole('button', { name: 'Email me a code' }).waitFor();
  assert.equal(await page.getByLabel('Enter the 6-digit code').count(), 0);
  await page.context().close();
});

test('asking for a code answers the same for an address with no account', async () => {
  const page = await (await browser.newContext()).newPage();
  const nobody = `nobody-${randomUUID().slice(0, 8)}@pickld.test`;
  await page.goto(`${base}/sign-in`);
  await page.getByLabel('Email').fill(nobody);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByText(`If ${nobody} belongs to a Pickld account, a 6-digit code is on its way.`).waitFor();
  await page.getByLabel('Enter the 6-digit code').waitFor();
  await page.context().close();
});
