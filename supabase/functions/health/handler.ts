// fn:health (M4-20; NFR-REL-01, T-306). The target of the uptime checks: a monitor (Sentry Uptime, set up by
// the founders, D-34) calls it every minute and alerts when it is not 200. It proves the Edge runtime is up
// and that the two things every upload needs answer: Postgres and the photo bucket. It reads no user data
// and answers only ok/failed per check, never an error text (those go to Sentry).
//
// GET or HEAD (send the anon key as the bearer token, like every caller of the Functions gateway)
//   → 200 { data: { ok: true, checks: { db: 'ok', storage: 'ok' } } }
//   → 503 { error: { code: 'unhealthy', message, details: { checks: { db: 'ok'|'failed', storage: … } } } }
//   → 405 for other methods
//
// GET /health/queue (M4-20, NFR-REL-01): the moderation queue-age alert, a second monitor on the same
// vendor (D-34). 200 while every open queue item (pending or escalated) is younger than 2 hours, else 503
// naming the queue check. It answers ok/failed only: no count, age or item reaches the caller.
import type { SupabaseClient } from '../_shared/deps.ts';
import { listKeys } from '../_shared/bucket.ts';
import { fail, ok } from '../_shared/http.ts';
import type { S3Config } from '../_shared/sigv4.ts';

export type Check = () => Promise<void>;

export interface HealthDeps {
  checks: Record<string, Check>;
  timeoutMs?: number;
  report?: (name: string, error: unknown) => void;
}

const TIMEOUT_MS = 5_000;

function withTimeout(check: Check, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    check(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timed out')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function handleHealth(req: Request, deps: HealthDeps): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405, 'method_not_allowed', 'Use GET.');
  const names = Object.keys(deps.checks);
  const results = await Promise.allSettled(names.map((n) => withTimeout(deps.checks[n], deps.timeoutMs ?? TIMEOUT_MS)));
  const checks: Record<string, 'ok' | 'failed'> = {};
  results.forEach((r, i) => {
    checks[names[i]] = r.status === 'fulfilled' ? 'ok' : 'failed';
    if (r.status === 'rejected') deps.report?.(names[i], r.reason);
  });
  if (Object.values(checks).every((c) => c === 'ok')) return ok({ ok: true, checks });
  return fail(503, 'unhealthy', 'A dependency is not answering.', { checks });
}

/** Postgres answers a query (a head count on profiles: no rows are read). */
export function dbCheck(db: SupabaseClient): Check {
  return async () => {
    const { error } = await db.from('profiles').select('id', { head: true, count: 'estimated' }).limit(1);
    if (error) throw new Error(`db: ${error.code}`);
  };
}

/** The photo bucket answers a listing (of a prefix nothing is stored under). */
export function storageCheck(s3: S3Config): Check {
  return async () => {
    await listKeys(s3, 'health/');
  };
}

/** Open moderation items (pending or escalated) wait less than maxAgeMs (NFR-REL-01: 2 hours). */
export const QUEUE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function queueAgeCheck(db: SupabaseClient, maxAgeMs = QUEUE_MAX_AGE_MS, now = () => Date.now()): Check {
  return async () => {
    const cutoff = new Date(now() - maxAgeMs).toISOString();
    const { count, error } = await db
      .from('moderation_items')
      .select('id', { head: true, count: 'exact' })
      .in('status', ['pending', 'escalated'])
      .lt('created_at', cutoff);
    if (error) throw new Error(`queue: ${error.code}`);
    if (count) throw new Error(`queue: ${count} open item(s) older than ${Math.round(maxAgeMs / 60_000)} minutes`);
  };
}
