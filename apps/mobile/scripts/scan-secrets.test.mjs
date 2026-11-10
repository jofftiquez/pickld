import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { findSecrets, scanPaths } from './scan-secrets.mjs';

// Keys are built at runtime so no key-shaped literal lives in the repo.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.${'s'.repeat(43)}`;
const secret = ['sb', 'secret', 'A1b2C3d4E5f6G7h8I9j0'].join('_');

test('flags a service_role JWT and a secret key, allows the anon key', () => {
  assert.deepEqual(
    findSecrets(`const k = "${jwt('service_role')}"`).map((f) => f.rule),
    ['service_role JWT'],
  );
  assert.equal(findSecrets(`const k = "${secret}"`).length, 1);
  assert.equal(findSecrets(`const k = "${jwt('anon')}"; const p = "sb_publishable_abcdefghijklmnop";`).length, 0);
  // Hermes string tables run strings together; expo-router ships this identifier.
  assert.equal(findSecrets('QueryVectorsb_secret__internal_expo_router_preview_id').length, 0);
});

test('flags public env vars named like secrets', () => {
  const name = ['EXPO', 'PUBLIC', 'SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
  assert.ok(findSecrets(`process.env.${name}`).length > 0);
  assert.equal(findSecrets('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY').length, 0);
});

test('scans directories and bundles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  try {
    writeFileSync(join(dir, 'clean.js'), `var a="${jwt('anon')}";`);
    assert.equal(scanPaths([dir]).length, 0);
    writeFileSync(join(dir, 'entry.hbc'), `var a="${jwt('service_role')}";`);
    assert.equal(scanPaths([dir]).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
