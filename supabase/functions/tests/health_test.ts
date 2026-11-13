import { assertEquals } from 'jsr:@std/assert@1';
import { dbCheck, handleHealth, QUEUE_MAX_AGE_MS, queueAgeCheck, storageCheck } from '../health/handler.ts';
import { admin, localS3 } from './local.ts';

const get = () => new Request('http://fn.local/health');
const okCheck = () => Promise.resolve();

Deno.test('health: 200 when the local database and bucket answer', async () => {
  const res = await handleHealth(get(), {
    checks: { db: dbCheck(await admin()), storage: storageCheck(await localS3()) },
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { data: { ok: true, checks: { db: 'ok', storage: 'ok' } } });
});

Deno.test('health: 503 names the failing check, without its error text', async () => {
  const reported: string[] = [];
  const s3 = { ...(await localS3()), secretAccessKey: 'wrong-secret' };
  const res = await handleHealth(get(), {
    checks: { db: okCheck, storage: storageCheck(s3) },
    report: (name) => reported.push(name),
  });
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error.code, 'unhealthy');
  assertEquals(body.error.details, { checks: { db: 'ok', storage: 'failed' } });
  assertEquals(reported, ['storage']);
  assertEquals(JSON.stringify(body).includes('403'), false);
});

Deno.test('health: a check that hangs fails at the timeout instead of hanging the monitor', async () => {
  let release = () => {};
  const hang = () => new Promise<void>((resolve) => (release = resolve));
  const started = Date.now();
  const res = await handleHealth(get(), { checks: { db: hang, storage: okCheck }, timeoutMs: 50 });
  release();
  assertEquals(res.status, 503);
  assertEquals((await res.json()).error.details.checks.db, 'failed');
  assertEquals(Date.now() - started < 2_000, true);
});

Deno.test('health: HEAD works, POST does not', async () => {
  const checks = { db: okCheck };
  assertEquals((await handleHealth(new Request('http://fn.local/health', { method: 'HEAD' }), { checks })).status, 200);
  assertEquals((await handleHealth(new Request('http://fn.local/health', { method: 'POST' }), { checks })).status, 405);
});

// The queue-age monitor (NFR-REL-01). Times are pinned to 1990 so other open items in a shared database
// (all created later, so younger than "now") can't change the outcome.
Deno.test('health/queue: 503 when an open item has waited over 2 hours, 200 once it is decided', async () => {
  const db = await admin();
  const created = '1990-01-01T00:00:00Z';
  const now = () => Date.parse('1990-01-01T03:00:00Z');
  const { data: item, error } = await db
    .from('moderation_items')
    .insert({ source: 'report', status: 'pending', created_at: created })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  try {
    const check = { queue: queueAgeCheck(db, QUEUE_MAX_AGE_MS, now) };
    const stale = await handleHealth(get(), { checks: check });
    assertEquals(stale.status, 503);
    const body = await stale.json();
    assertEquals(body.error.details, { checks: { queue: 'failed' } });
    assertEquals(JSON.stringify(body).includes('minutes'), false);

    // Escalated items still count; at 1 h 59 min the same item is fine.
    await db.from('moderation_items').update({ status: 'escalated' }).eq('id', item.id);
    assertEquals((await handleHealth(get(), { checks: check })).status, 503);
    const early = { queue: queueAgeCheck(db, QUEUE_MAX_AGE_MS, () => Date.parse('1990-01-01T01:59:00Z')) };
    assertEquals((await handleHealth(get(), { checks: early })).status, 200);

    await db.from('moderation_items').update({ status: 'kept', decided_at: created }).eq('id', item.id);
    assertEquals((await handleHealth(get(), { checks: check })).status, 200);
  } finally {
    await db.from('moderation_items').delete().eq('id', item.id);
  }
});
