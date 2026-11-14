// The Waitlist page (FR-MOD-08), in Chromium against the local Supabase stack. The test adds its own waitlist
// rows (email only, as from the first form) and deletes them afterwards. Export and removal write audit rows
// that name their moderator and can't be deleted, so the moderator is one long-lived test account, reused
// across runs. Other rows may already be on the list, so assertions only rely on this file's own emails.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { signInWithCode } from './signIn.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3295;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MOD_EMAIL = 'mod-e2e-waitlist@pickld.test';
const tag = randomUUID().slice(0, 6);
const domain = `wl-${tag}.pickld.test`;
// The second one starts with "=", which a spreadsheet would run as a formula.
const emails = [`ana@${domain}`, `=1+1@${domain}`, `remove-me@${domain}`];
let web, browser, page;

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
  // Export and removal need the moderator to have a profile (0091), for the audit row.
  must(
    await admin.from('profiles').upsert(
      {
        id: user.id,
        username: 'mod_e2e_waitlist',
        display_name: 'Waitlist Moderator',
        birthday: '1990-01-01',
        home_tz: 'Asia/Manila',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
  );
  return user;
}

before(async () => {
  await moderator();
  must(await admin.from('waitlist').insert(emails.map((email) => ({ email, source: 'story' }))));

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
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
  await signInWithCode(page, { base, admin, email: MOD_EMAIL });
});

after(async () => {
  await browser?.close();
  web?.kill();
  await admin.from('waitlist').delete().in('email', emails);
});

test('the Waitlist page shows totals, today’s joins and sources', async () => {
  await page.goto(`${base}/waitlist`);
  await page.getByRole('heading', { name: 'Waitlist' }).waitFor();
  const totals = page.getByRole('region', { name: 'Totals' });
  const joinedToday = totals.locator('dt', { hasText: 'Joined today' }).locator('xpath=following-sibling::dd[1]');
  assert.ok(Number(await joinedToday.textContent()) >= 3, 'our three rows joined today');
  const sources = page.getByRole('region', { name: 'Where they joined' });
  await sources.getByText('story', { exact: true }).waitFor();
  assert.equal(await page.locator('figure ol > li').count(), 30, 'one bar per day for 30 days');
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Console' })
      .getByRole('link', { name: 'Waitlist' })
      .getAttribute('aria-current'),
    'page',
  );
});

test('search finds emails by part of the address and filters by state', async () => {
  await page.goto(`${base}/waitlist`);
  await page.getByRole('searchbox', { name: 'Search emails' }).fill(domain.toUpperCase());
  await page.getByLabel('Show').selectOption('email_only');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(/state=email_only/);
  const list = page.getByRole('region', { name: 'Emails' });
  for (const email of emails) await list.getByText(email, { exact: true }).waitFor();
  await list.getByRole('status').getByText('Showing 1–3 of 3').waitFor();

  await page.goto(`${base}/waitlist?q=${domain}&state=member`);
  await list.getByText('No emails match.').waitFor();
});

test('the email list pages through matches 25 at a time', async (t) => {
  const many = `wlp-${tag}.pickld.test`;
  const list = Array.from({ length: 27 }, (_, i) => `p${String(i).padStart(2, '0')}@${many}`);
  must(await admin.from('waitlist').insert(list.map((email) => ({ email, source: 'story' }))));
  t.after(() => admin.from('waitlist').delete().in('email', list));

  await page.goto(`${base}/waitlist?q=${many}`);
  const emails = page.getByRole('region', { name: 'Emails' });
  await emails.getByRole('status').getByText('Showing 1–25 of 27').waitFor();
  assert.equal(await emails.locator('tbody tr').count(), 25);
  await emails.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Next' }).click();
  await page.waitForURL(/page=2/);
  await emails.getByRole('status').getByText('Showing 26–27 of 27').waitFor();
  assert.equal(await emails.locator('tbody tr').count(), 2);
  assert.equal(await emails.getByRole('link', { name: 'Page 2, current page' }).getAttribute('aria-current'), 'page');

  await emails.getByLabel('Rows per page').selectOption('50');
  await page.waitForURL(/size=50/);
  await emails.getByRole('status').getByText('Showing 1–27 of 27').waitFor();
  assert.ok(!page.url().includes('page='), 'changing the page size starts again at page 1');
});

test('Download CSV gives every row, with formulas defused, and is audited', async () => {
  await page.goto(`${base}/waitlist`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download CSV' }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^pickld-waitlist-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), 'utf8');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'email,source,joined_at,state');
  assert.ok(lines.some((l) => l.startsWith(`ana@${domain},story,`) && l.endsWith(',email_only')));
  assert.ok(
    lines.some((l) => l.startsWith(`'=1+1@${domain},story,`)),
    'a leading = is quoted as text',
  );

  await page.goto(`${base}/audit`);
  const row = page.getByRole('region', { name: 'Audit entries' }).locator('tbody tr').first();
  assert.match(await row.textContent(), /Downloaded waitlist.*\d+ emails/);
});

test('removing an email on request needs a note and leaves no email in the audit log', async () => {
  await page.goto(`${base}/waitlist`);
  const form = page.getByRole('region', { name: 'Remove an email' });
  await form.getByLabel('Email').fill(`nobody@${domain}`);
  await form.getByLabel('Note (why, and how they asked)').fill('Asked by email');
  await form.getByRole('button', { name: 'Remove from waitlist' }).click();
  await form.getByRole('alert').getByText('That email is not on the waitlist.').waitFor();

  // The form clears after each submit.
  await form.getByLabel('Email').fill(`REMOVE-ME@${domain}`);
  await form.getByLabel('Note (why, and how they asked)').fill('Asked by email');
  await form.getByRole('button', { name: 'Remove from waitlist' }).click();
  await form.getByRole('status').getByText('Removed.').waitFor();
  assert.equal(must(await admin.from('waitlist').select('email').eq('email', `remove-me@${domain}`)).length, 0);
  assert.equal(must(await admin.from('waitlist').select('email').eq('email', `ana@${domain}`)).length, 1);

  await page.goto(`${base}/audit`);
  const row = await page.getByRole('region', { name: 'Audit entries' }).locator('tbody tr').first().textContent();
  assert.match(row, /Removed waitlist email.*joined from story.*Note: Asked by email/);
  assert.ok(!row.includes(domain), 'the audit row has no email');
});
