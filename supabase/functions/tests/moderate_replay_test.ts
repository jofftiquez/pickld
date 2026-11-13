// Threshold replay (M5-05; FR-SAF-03): every labelled item in fixtures/moderation/labelled.json is decided
// again with the current THRESHOLDS. A threshold change must keep every expected decision, or update the
// fixture on purpose in the same commit with a history line in thresholds.ts saying why. Two safety rules
// hold whatever the expectations say: nothing a moderator removed may be approved (it would go live
// unchecked), and nothing a moderator kept may be removed automatically (a wrongful strike).
// Labelled beta items are exported with scripts/moderation-labels.sql.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { z } from '../_shared/deps.ts';
import { CATEGORIES, decide, THRESHOLDS } from '../moderate/thresholds.ts';

const Item = z.object({
  id: z.string(),
  source: z.enum(['synthetic', 'beta']),
  kind: z.enum(['photo', 'text']),
  human: z.enum(['keep', 'remove']),
  expect: z.enum(['approve', 'review', 'remove']),
  scores: z.partialRecord(z.enum(CATEGORIES), z.number().min(0).max(1)),
  note: z.string(),
});
const Fixture = z.object({ about: z.string(), items: z.array(Item).min(1) });

const fixture = Fixture.parse(
  JSON.parse(await Deno.readTextFile(new URL('./fixtures/moderation/labelled.json', import.meta.url))),
);

Deno.test('labelled items have unique ids', () => {
  const ids = fixture.items.map((i) => i.id);
  assertEquals(new Set(ids).size, ids.length);
});

Deno.test(`thresholds ${THRESHOLDS.version} reproduce every labelled decision`, () => {
  const wrong = fixture.items
    .map((item) => ({ item, got: decide(item.scores, THRESHOLDS[item.kind]).decision }))
    .filter(({ item, got }) => got !== item.expect)
    .map(({ item, got }) => `${item.id}: expected ${item.expect}, got ${got} (${item.note})`);
  assertEquals(wrong, []);
});

Deno.test('no item a moderator removed is approved, and none they kept is removed automatically', () => {
  for (const item of fixture.items) {
    const got = decide(item.scores, THRESHOLDS[item.kind]).decision;
    if (item.human === 'remove') assert(got !== 'approve', `${item.id} would go live: ${item.note}`);
    if (item.human === 'keep') assert(got !== 'remove', `${item.id} would be removed wrongly: ${item.note}`);
  }
});

Deno.test('the fixture covers each outcome for photos and an approve and a review for text', () => {
  const seen = new Set(fixture.items.map((i) => `${i.kind}:${i.expect}`));
  for (const k of ['photo:approve', 'photo:review', 'photo:remove', 'text:approve', 'text:review']) {
    assert(seen.has(k), `no labelled item for ${k}`);
  }
});

Deno.test('the thresholds history explains the current version', async () => {
  const source = await Deno.readTextFile(new URL('../moderate/thresholds.ts', import.meta.url));
  assert(source.includes(`//   ${THRESHOLDS.version}  `), `add a history line for ${THRESHOLDS.version}`);
});
