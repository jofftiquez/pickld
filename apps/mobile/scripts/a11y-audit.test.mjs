// Runs under node --test with the other script tests (M5-01).
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { audit } from './a11y-audit.mjs';

function fixture(code) {
  const file = join(mkdtempSync(join(tmpdir(), 'a11y-')), 'Fixture.tsx');
  writeFileSync(file, code);
  return audit([file]).map((p) => p.kind);
}

test('every pressable in app/ and src/ has a label, and text follows the system size', () => {
  assert.deepEqual(audit(), []);
});

test('flags a pressable with only visible text, but not a labelled, hidden or pass-through one', () => {
  assert.deepEqual(fixture('const A = () => <Pressable onPress={f}><Text>{t("x")}</Text></Pressable>;'), ['label']);
  assert.deepEqual(fixture('const A = () => <TouchableOpacity onPress={f} />;'), ['label']);
  assert.deepEqual(fixture('const A = () => <Pressable accessibilityLabel={t("x")} onPress={f} />;'), []);
  assert.deepEqual(fixture('const A = () => <Pressable accessible={false} onPress={f} />;'), []);
  assert.deepEqual(fixture('const A = (p: P) => <Pressable {...p} />;'), []);
});

test('flags fixed-size text unless a comment says why', () => {
  assert.deepEqual(fixture('const A = () => <Text allowFontScaling={false}>1</Text>;'), ['font-scaling']);
  assert.deepEqual(fixture('const A = () => <Text maxFontSizeMultiplier={1.3}>1</Text>;'), ['font-scaling']);
  assert.deepEqual(fixture('const A = () => <Text maxFontSizeMultiplier={2}>1</Text>;'), []);
  assert.deepEqual(
    fixture('const A = () => (\n  // a11y-fixed-size: inside the photo\n  <Text allowFontScaling={false}>1</Text>\n);'),
    [],
  );
});
