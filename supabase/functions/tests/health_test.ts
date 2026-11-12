import { assertEquals } from 'jsr:@std/assert@1';
import { dbCheck, handleHealth, storageCheck } from '../health/handler.ts';
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
