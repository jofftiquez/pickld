// Deciding queue items and the audit log (M3-27; FR-MOD-03, FR-MOD-04, FR-MOD-05), in Chromium against the
// local Supabase stack, through the real fn:mod-action (served by `supabase start`). The test makes its own
// owner, moments and queue items and deletes them afterwards. Audit rows can't be deleted and name their
// moderator, so the moderator is one long-lived test account, reused across runs.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { signInWithCode } from './signIn.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const PORT = 3294;
const base = `http://127.0.0.1:${PORT}`;

const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(out.slice(out.indexOf('{')));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MOD_EMAIL = 'mod-e2e-decider@pickld.test';
const MOD_NAME = 'mod_e2e_decider';
const tag = randomUUID().slice(0, 6);
let web, browser, page, ownerId, moderatorId;
const items = {};

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
  // mod_decide needs the moderator to have a profile (0041).
  must(
    await admin.from('profiles').upsert(
      {
        id: user.id,
        username: MOD_NAME,
        display_name: 'E2E Moderator',
        birthday: '1990-01-01',
        home_tz: 'Asia/Manila',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
  );
  return user;
}

async function queued(jarId, slot, item) {
  const m = must(
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
  const row = must(
    await admin
      .from('moderation_items')
      .insert({ moment_id: m.id, source: 'auto_check', ...item })
      .select('id')
      .single(),
  );
  return row.id;
}

const itemStatus = async (id) =>
  must(await admin.from('moderation_items').select('status').eq('id', id).single()).status;

async function waitForStatus(id, want) {
  for (let i = 0; i < 40; i++) {
    if ((await itemStatus(id)) === want) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(await itemStatus(id), want);
}

before(async () => {
  const mod = await moderator();
  moderatorId = mod.id;
  ownerId = must(await admin.auth.admin.createUser({ email: `owner-decide-${tag}@pickld.test`, email_confirm: true }))
    .user.id;
  must(
    await admin.from('profiles').insert({
      id: ownerId,
      username: `dec_${tag}`,
      display_name: 'Decide Owner',
      birthday: '1995-05-05',
      home_tz: 'Asia/Manila',
    }),
  );
  const jar = must(
    await admin
      .from('jars')
      .insert({ user_id: ownerId, local_date: '2026-11-08', tz: 'Asia/Manila', visibility: 'everyone' })
      .select('id')
      .single(),
  );
  const scored = { scores: { provider: 'openai', scores: { violence: 0.9 } }, decision_reason: 'violence' };
  items.keep = await queued(jar.id, 'whereami', scored);
  items.remove = await queued(jar.id, 'ootd', scored);
  items.noReason = await queued(jar.id, 'morning', {});
  items.escalated = await queued(jar.id, 'evening', { status: 'escalated' });

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
  page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await signInWithCode(page, { base, admin, email: MOD_EMAIL });
});

after(async () => {
  await browser?.close();
  web?.kill();
  // The owner's profile, jar, moments and queue items go with the account; the moderator stays (see top).
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
});

const panel = () => page.getByRole('region', { name: 'Item details' });
const open = async (id) => {
  await page.goto(`${base}/queue?filter=all&item=${id}`);
  await panel().getByRole('group', { name: 'Decision' }).waitFor();
};

test('K keeps the item', async () => {
  await open(items.keep);
  await page.keyboard.press('k');
  await waitForStatus(items.keep, 'kept');
});

test('R removes under the guideline the flag maps to', async () => {
  await open(items.remove);
  assert.equal(await panel().getByLabel('Guideline it broke').inputValue(), 'violence');
  await page.keyboard.press('r');
  await waitForStatus(items.remove, 'removed');
});

test('R without a guideline asks for one and changes nothing; E escalates', async () => {
  await open(items.noReason);
  await page.keyboard.press('r');
  await panel().getByText('Pick the guideline it broke before removing.').waitFor();
  assert.equal(await itemStatus(items.noReason), 'pending');
  await page.keyboard.press('e');
  await waitForStatus(items.noReason, 'escalated');
});

test('an escalated item can be kept or removed but not escalated again', async () => {
  await open(items.escalated);
  assert.equal(await panel().getByRole('button', { name: 'Escalate (E)' }).isDisabled(), true);
  assert.equal(await panel().getByRole('button', { name: 'Keep (K)' }).isEnabled(), true);
});

test('the audit log lists the decisions, newest first, and cannot be changed', async () => {
  await page.goto(`${base}/audit`);
  const log = page.getByRole('region', { name: 'Audit entries' });
  await log.getByText('Escalated').first().waitFor();
  const rows = await log.locator('tbody tr').allTextContents();
  const mine = rows.filter((r) => r.includes(`@${MOD_NAME}`)).slice(0, 3);
  assert.match(mine[0], /Escalated/);
  assert.match(mine[1], /Removed.*Guideline: Violence or dangerous acts/);
  assert.match(mine[2], /Kept/);
  assert.equal(await page.locator('main').getByRole('button').count(), 0, 'no controls on the audit page');

  // The same moderator, straight to the database: no update, no delete.
  const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email: MOD_EMAIL }));
  const db = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  must(await db.auth.verifyOtp({ email: MOD_EMAIL, token: link.properties.email_otp, type: 'email' }));
  const [entry] = must(await db.from('audit_log').select('id').eq('actor_id', moderatorId).limit(1));
  const upd = await db.from('audit_log').update({ action: 'keep' }).eq('id', entry.id).select();
  assert.ok(upd.error || upd.data.length === 0, 'update refused');
  const del = await db.from('audit_log').delete().eq('id', entry.id).select();
  assert.ok(del.error || del.data.length === 0, 'delete refused');
  assert.equal(must(await admin.from('audit_log').select('id').eq('id', entry.id)).length, 1, 'the row is still there');
});
