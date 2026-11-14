// Invite codes in the console (INV-10), in Chromium against the local Supabase stack. Codes, audit rows and
// the moderator who wrote them can't be deleted, so the moderator is one long-lived test account and each run's
// code carries its own note; the run switches its code off at the end. The other accounts are made per run and
// deleted afterwards.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { signInWithCode } from './signIn.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3297;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MOD_EMAIL = 'mod-e2e-invites@pickld.test';
const tag = randomUUID().slice(0, 6);
const note = `e2e meetup ${tag}`;
const people = [];
let mod, web, browser, page, code;

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function person(username, extra = {}) {
  const user = must(
    await admin.auth.admin.createUser({ email: `${username}@inv-${tag}.pickld.test`, email_confirm: true }),
  ).user;
  people.push(user.id);
  must(
    await admin.from('profiles').insert({
      id: user.id,
      username,
      display_name: username,
      birthday: '1995-05-05',
      home_tz: 'Asia/Manila',
      ...extra,
    }),
  );
  return user;
}

before(async () => {
  const { users } = must(await admin.auth.admin.listUsers({ perPage: 1000 }));
  mod = users.find((u) => u.email === MOD_EMAIL);
  if (!mod) {
    // A plain moderator, not a founder: “Let people in early” must refuse them.
    mod = must(
      await admin.auth.admin.createUser({ email: MOD_EMAIL, email_confirm: true, app_metadata: { role: 'moderator' } }),
    ).user;
  }
  must(
    await admin.from('profiles').upsert(
      {
        id: mod.id,
        username: 'mod_e2e_invites',
        display_name: 'Invites Moderator',
        birthday: '1990-01-01',
        home_tz: 'Asia/Manila',
      },
      { onConflict: 'id', ignoreDuplicates: true },
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
  for (const id of people) await admin.auth.admin.deleteUser(id);
});

async function audited(action, data) {
  const rows = must(
    await admin
      .from('audit_log')
      .select('action, data')
      .eq('actor_id', mod.id)
      .eq('action', action)
      .order('id', { ascending: false })
      .limit(5),
  );
  return rows.some((r) => Object.entries(data).every(([k, v]) => r.data[k] === v));
}

test('a moderator makes a code with a note; it shows in the table and the audit log', async () => {
  await page.goto(`${base}/invites`);
  await page.getByRole('heading', { name: 'Invite codes', level: 1 }).waitFor();
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Console' })
      .getByRole('link', { name: 'Invite codes' })
      .getAttribute('aria-current'),
    'page',
  );
  const form = page.getByRole('region', { name: 'New code' });
  await form.getByLabel('Note (only moderators see it)').fill(note);
  await form.getByLabel('Uses').fill('3');
  await form.getByRole('button', { name: 'Make code' }).click();
  const made = await form.getByRole('status').textContent({ timeout: 10_000 });
  code = /Made ([A-Z0-9]{6})\./.exec(made ?? '')?.[1];
  assert.ok(code, `a code in “${made}”`);

  const row = page.getByRole('region', { name: 'Codes' }).locator('tr', { hasText: note });
  await row.getByText(code, { exact: true }).waitFor();
  await row.getByText('0 / 3', { exact: true }).waitFor();
  await row.getByText('Invites Moderator (moderator)').waitFor();
  await row.getByText('On', { exact: true }).waitFor();
  assert.ok(await audited('invite_code_create', { code, note, uses: 3 }));
});

test('an empty note is refused', async () => {
  await page.goto(`${base}/invites`);
  const form = page.getByRole('region', { name: 'New code' });
  await form.getByLabel('Note (only moderators see it)').fill('   ');
  await form.getByRole('button', { name: 'Make code' }).click();
  await form.getByRole('alert').getByText('Write a note of up to 200 characters.').waitFor();
});

test('switching the code off shows Off, is audited, and switching on works again', async () => {
  await page.goto(`${base}/invites`);
  const row = page.getByRole('region', { name: 'Codes' }).locator('tr', { hasText: note });
  await row.getByRole('button', { name: `Switch code ${code} off` }).click();
  await row.getByRole('button', { name: `Switch code ${code} on` }).waitFor();
  await row.getByText('Off', { exact: true }).waitFor();
  assert.ok(await audited('invite_code_off', { code }));

  await row.getByRole('button', { name: `Switch code ${code} on` }).click();
  await row.getByRole('button', { name: `Switch code ${code} off` }).waitFor();
  assert.ok(await audited('invite_code_on', { code }));
  await row.getByRole('button', { name: `Switch code ${code} off` }).click();
  await row.getByRole('button', { name: `Switch code ${code} on` }).waitFor();
});

test('a user page shows their invites; a moderator gives a set and pauses them with a note', async () => {
  const user = await person(`inv_${tag}`);
  await page.goto(`${base}/users/${user.id}`);
  const card = page.getByRole('region', { name: 'Invites' });
  await card.getByText('0 of 8 used · 1 set').waitFor();
  await card.getByText('Nobody (joined before invites, or let in from the waiting line)').waitFor();

  await card.getByRole('button', { name: 'Give another set of 8' }).click();
  await card.getByRole('status').getByText('Set 2 added.').waitFor();
  await card.getByText('0 of 16 used · 2 sets').waitFor();

  await card.getByLabel('Why pause them (required)').fill(`e2e pause ${tag}`);
  await card.getByRole('button', { name: 'Pause their invites' }).click();
  await card.getByText(`e2e pause ${tag}`).waitFor();
  await card.getByRole('button', { name: 'Let their invites work again' }).waitFor();
  assert.ok(await audited('invite_freeze', { note: `e2e pause ${tag}` }));
});

test('a moderator who is not a founder cannot let people in early', async () => {
  const waiting = await person(`wait_${tag}`, { status: 'waiting' });
  await page.goto(`${base}/invites`);
  const card = page.getByRole('region', { name: 'Let people in early' });
  await card.getByRole('button', { name: /^Let in the oldest \d+$/ }).click();
  await card.getByRole('alert').getByText('Only founders can let people in early.').waitFor();
  const [profile] = must(await admin.from('profiles').select('status').eq('id', waiting.id));
  assert.equal(profile.status, 'waiting');
});
