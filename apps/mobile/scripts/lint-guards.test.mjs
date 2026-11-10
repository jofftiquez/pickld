// Runs under node --test (ESLint's flat config loader needs native dynamic import, which Jest lacks).
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..') });

async function ruleIds(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

test('rejects raw strings in JSX', async () => {
  const ids = await ruleIds('export const A = () => <Text>Today</Text>;\n', 'src/components/A.tsx');
  assert.ok(ids.includes('no-restricted-syntax'), String(ids));
});

test('rejects color literals outside tokens.ts', async () => {
  assert.ok((await ruleIds("export const c = '#7fad33';\n", 'src/components/B.ts')).includes('no-restricted-syntax'));
  assert.ok(
    (await ruleIds("export const c = 'rgba(0,0,0,0.5)';\n", 'src/components/B.ts')).includes('no-restricted-syntax'),
  );
  assert.ok(!(await ruleIds("export const c = '#7fad33';\n", 'src/theme/tokens.ts')).includes('no-restricted-syntax'));
});

test('allows punctuation-only JSX text and copy from t()', async () => {
  const ids = await ruleIds('export const A = () => <Text>· {t("today.title")}</Text>;\n', 'src/components/A.tsx');
  assert.ok(!ids.includes('no-restricted-syntax'), String(ids));
});
