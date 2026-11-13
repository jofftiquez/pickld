// fn:account-jobs (M4-18; FR-PRV-02, FR-PRV-03; T-305). Called by a Supabase Cron job with the
// x-jobs-secret header (ACCOUNT_JOBS_SECRET); nothing else may call it. Each run claims a few due
// account_jobs (0026: account_jobs_claim) and runs them one after another:
//
//   export  The person's profile, every moment of theirs that moderation hasn't removed (private ones
//           too: it is their own data), each moment's full photo and a finished copy of it go into a zip
//           written to exports/<user id>/<job id>.zip as a multipart upload, one photo in memory at a time:
//             profile.json                 username, display_name, bio, birthday, created_at
//             moments.json                 [{ date, slot, caption, captured_at, added_at, is_private,
//                                             visibility (of the jar), photo and finished (paths in the zip
//                                             or null) }]
//             photos/<date>/<slot>.jpg     the photo as stored; a pending replacement is <slot>-replacement.jpg
//             finished/<date>/<slot>.jpg   the same moment as people saw it in the app: its filter, stickers,
//                                          bubbles and text drawn on (T-508, _shared/moment_render.ts). A
//                                          moment without edits gets the stored photo again.
//           Drawing is slow (about a quarter second a photo) and a run has 2 s of CPU, so finished copies
//           are drawn first, a few per run within RENDER_BUDGET_MS, into exports/<user id>/<job id>/; until
//           they are all there the job is handed back (account_job_yield, 0061: no attempt is used) for the
//           next run. Then the zip is built from them, the job is marked done with its key, and that folder
//           is deleted. fn:data-export signs links to the zip.
//   delete  Every object under the person's prefixes (moments/, avatars/, covers/ and exports/ under
//           their id; never seed/), then account_delete_purge(): the auth user and every row keyed to
//           them (the job row too) are deleted. It refuses an account whose profile isn't 'deleted'.
//
// A failure puts the job back for another try in 10 minutes, and fails it after the third attempt
// (account_job_fail). Messages name only the step and a status code, never a key or personal data.
//
// Each run also ends strike suspensions whose 7 days are over (moderation_lift_suspensions, 0041; D-11).
//
// POST {}  (x-jobs-secret: …)
//   → { data: { claimed, done, failed, waiting (handed back to draw more), lifted } }
//   → { error: { code, message } }   401 wrong secret, 405 method
import type { SupabaseClient } from '../_shared/deps.ts';
import { deletePrefix, getObject, listAllKeys, MultipartUpload, putObject } from '../_shared/bucket.ts';
import { fail, ok } from '../_shared/http.ts';
import {
  type AssetSource,
  type FinishedRenderer,
  finishedRenderer,
  hasVisibleEdits,
} from '../_shared/moment_render.ts';
import { isObjectKey, userPrefixes } from '../_shared/object_keys.ts';
import type { S3Config } from '../_shared/sigv4.ts';
import { ZipWriter } from '../_shared/zip.ts';

export const BATCH = 3;

/** Milliseconds of drawing per run, shared by its jobs; at least one finished copy is drawn per run. */
export const RENDER_BUDGET_MS = 800;

const SLOTS = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'];

export interface AccountJob {
  id: string;
  user_id: string;
  kind: 'export' | 'delete';
}

export interface ExportProfile {
  username: string;
  display_name: string;
  bio: string | null;
  birthday: string;
  created_at: string;
}

export interface ExportMoment {
  id: string;
  date: string;
  /** The jar's IANA zone (auto stamps show the capture time in it). */
  tz: string;
  slot: string;
  caption: string | null;
  captured_at: string | null;
  added_at: string;
  is_private: boolean;
  visibility: string;
  photo_path: string | null;
  edits: unknown;
  /** A replacement waiting for moderation (0013): it shares the slot with the moment it replaces. */
  replacement: boolean;
}

export interface UploadSink {
  write(chunk: Uint8Array): Promise<void>;
  complete(): Promise<void>;
  abort(): Promise<void>;
}

/** The database as the service role and the photo bucket. */
export interface JobsStore {
  claim(limit: number): Promise<AccountJob[]>;
  done(id: string, resultKey: string | null): Promise<void>;
  fail(id: string, message: string): Promise<void>;
  /** account_job_yield() (0061): back to pending for the next run, without using an attempt. */
  yieldJob(id: string): Promise<void>;
  exportData(userId: string): Promise<{ profile: ExportProfile; moments: ExportMoment[] }>;
  /** account_delete_purge(): false, with nothing touched, unless the profile is 'deleted'. */
  purgeAccount(userId: string): Promise<boolean>;
  getObject(key: string): Promise<Uint8Array | null>;
  putObject(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** Every key under the prefix. */
  listKeys(prefix: string): Promise<string[]>;
  deletePrefix(prefix: string): Promise<number>;
  startUpload(key: string, contentType: string): Promise<UploadSink>;
  /** moderation_lift_suspensions() (0041): ends strike suspensions whose 7 days are over. */
  liftSuspensions(): Promise<number>;
}

export interface AccountJobsDeps {
  store: () => JobsStore;
  secret: () => string;
  /** Draws finished copies (default: finishedRenderer). */
  renderer?: (assets: AssetSource) => FinishedRenderer;
  /** Default RENDER_BUDGET_MS. */
  renderBudgetMs?: number;
}

/** Same-length strings compared without an early exit. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function exportKey(job: AccountJob): string {
  return `exports/${job.user_id}/${job.id}.zip`;
}

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2) + '\n');

/** Where an export keeps its finished copies until the zip is built. */
export function scratchPrefix(job: AccountJob): string {
  return `exports/${job.user_id}/${job.id}/`;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** A finished copy's key: it changes when anything it is drawn from changes. */
async function finishedKey(job: AccountJob, m: ExportMoment): Promise<string> {
  const input = JSON.stringify([m.photo_path, m.edits, m.captured_at, m.added_at, m.tz]);
  const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))).slice(0, 16);
  return `${scratchPrefix(job)}${m.id}-${digest}.jpg`;
}

const hasPhoto = (m: ExportMoment): m is ExportMoment & { photo_path: string } =>
  m.photo_path !== null && isObjectKey(m.photo_path);

interface ExportRun {
  renderer: (assets: AssetSource) => FinishedRenderer;
  /** Drawing time left in this run, shared by its jobs. */
  budget: { ms: number; drawn: number };
}

/**
 * Draws the finished copies this export still needs, within the run's budget. True when every one is in
 * the scratch folder.
 */
async function drawFinished(store: JobsStore, job: AccountJob, moments: ExportMoment[], run: ExportRun) {
  const edited = moments.filter((m) => hasPhoto(m) && hasVisibleEdits(m.edits));
  if (edited.length === 0) return true;
  const have = new Set(await store.listKeys(scratchPrefix(job)));
  let renderer: FinishedRenderer | null = null;
  try {
    for (const m of edited) {
      const key = await finishedKey(job, m);
      if (have.has(key)) continue;
      if (run.budget.drawn > 0 && run.budget.ms <= 0) return false;
      const photo = await store.getObject(m.photo_path!);
      if (!photo) continue; // gone from the bucket: no photo and no finished copy in the zip
      renderer ??= run.renderer((asset) => store.getObject(asset));
      const started = performance.now();
      const bytes = await renderer.render({
        photo,
        edits: m.edits,
        capturedAt: new Date(m.captured_at ?? m.added_at),
        tz: m.tz,
      });
      run.budget.ms -= performance.now() - started;
      run.budget.drawn += 1;
      await store.putObject(key, bytes, 'image/jpeg');
    }
    return true;
  } finally {
    renderer?.close();
  }
}

/** The zip's key when the export is done, or null when it was handed back to draw more next run. */
async function runExport(store: JobsStore, job: AccountJob, run: ExportRun): Promise<string | null> {
  const { profile, moments } = await store.exportData(job.user_id);
  moments.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) ||
      Number(a.replacement) - Number(b.replacement)
  );
  if (!await drawFinished(store, job, moments, run)) return null;

  const key = exportKey(job);
  const upload = await store.startUpload(key, 'application/zip');
  try {
    const zip = new ZipWriter((chunk) => upload.write(chunk));
    await zip.add('profile.json', json(profile));
    const entries = [];
    for (const m of moments) {
      const bytes = hasPhoto(m) ? await store.getObject(m.photo_path) : null;
      const name = `${m.date}/${m.slot}${m.replacement ? '-replacement' : ''}.jpg`;
      const photo = bytes ? `photos/${name}` : null;
      let finished: string | null = null;
      if (bytes && photo) {
        await zip.add(photo, bytes);
        const drawn = hasVisibleEdits(m.edits) ? await store.getObject(await finishedKey(job, m)) : bytes;
        if (!drawn) throw new Error('finished: a drawn copy is missing'); // changed since: retried
        finished = `finished/${name}`;
        await zip.add(finished, drawn);
      }
      entries.push({
        date: m.date,
        slot: m.slot,
        caption: m.caption,
        captured_at: m.captured_at,
        added_at: m.added_at,
        is_private: m.is_private,
        visibility: m.visibility,
        photo,
        finished,
      });
    }
    await zip.add('moments.json', json(entries));
    await zip.finish();
    await upload.complete();
  } catch (e) {
    await upload.abort().catch(() => undefined);
    throw e;
  }
  await store.deletePrefix(scratchPrefix(job));
  return key;
}

async function runDelete(store: JobsStore, job: AccountJob): Promise<void> {
  for (const prefix of [...userPrefixes(job.user_id), `exports/${job.user_id}/`]) await store.deletePrefix(prefix);
  if (!await store.purgeAccount(job.user_id)) throw new Error('purge: the account is not deleted');
}

export async function handleAccountJobs(req: Request, deps: AccountJobsDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const secret = deps.secret();
  const given = req.headers.get('x-jobs-secret') ?? '';
  if (secret.length < 32 || !sameSecret(given, secret)) return fail(401, 'unauthorized', 'Not allowed.');

  const store = deps.store();
  const lifted = await store.liftSuspensions();
  const jobs = await store.claim(BATCH);
  const run: ExportRun = {
    renderer: deps.renderer ?? finishedRenderer,
    budget: { ms: deps.renderBudgetMs ?? RENDER_BUDGET_MS, drawn: 0 },
  };
  let done = 0;
  let failed = 0;
  let waiting = 0;
  for (const job of jobs) {
    try {
      if (job.kind === 'export') {
        const key = await runExport(store, job, run);
        if (key === null) {
          await store.yieldJob(job.id);
          waiting += 1;
          continue;
        }
        await store.done(job.id, key);
      } else await runDelete(store, job); // the job row went with the account
      done += 1;
    } catch (e) {
      failed += 1;
      await store.fail(job.id, e instanceof Error ? e.message : 'failed');
    }
  }
  return ok({ claimed: jobs.length, done, failed, waiting, lifted });
}

const PAGE = 1000;

/** The JobsStore over the service-role client and the S3 API (s3ServerConfigFromEnv). */
export function serviceStore(db: SupabaseClient, s3: S3Config, partSize?: number): JobsStore {
  return {
    async claim(limit) {
      const { data, error } = await db.rpc('account_jobs_claim', { p_limit: limit });
      if (error) throw new Error(`account_jobs_claim: ${error.code}`);
      return (data ?? []) as AccountJob[];
    },
    async done(id, resultKey) {
      const { error } = await db.rpc('account_job_done', { p_id: id, p_result_key: resultKey });
      if (error) throw new Error(`account_job_done: ${error.code}`);
    },
    async fail(id, message) {
      const { error } = await db.rpc('account_job_fail', { p_id: id, p_error: message });
      if (error) throw new Error(`account_job_fail: ${error.code}`);
    },
    async yieldJob(id) {
      const { error } = await db.rpc('account_job_yield', { p_id: id });
      if (error) throw new Error(`account_job_yield: ${error.code}`);
    },
    async exportData(userId) {
      const { data: profile, error } = await db.from('profiles')
        .select('username, display_name, bio, birthday, created_at').eq('id', userId).single();
      if (error) throw new Error(`profile: ${error.code}`);
      const moments: ExportMoment[] = [];
      for (let from = 0;; from += PAGE) {
        const { data, error: mErr } = await db.from('moments')
          .select(
            'id, slot, caption, captured_at, added_at, is_private, photo_path, edits, replaces, jars!moments_jar_id_fkey!inner(local_date, tz, visibility)',
          )
          .eq('user_id', userId)
          .neq('status', 'removed')
          .order('id')
          .range(from, from + PAGE - 1);
        if (mErr) throw new Error(`moments: ${mErr.code}`);
        for (const m of data ?? []) {
          const jar = (Array.isArray(m.jars) ? m.jars[0] : m.jars) as {
            local_date: string;
            tz: string;
            visibility: string;
          };
          moments.push({
            id: m.id,
            date: jar.local_date,
            tz: jar.tz,
            slot: m.slot,
            caption: m.caption,
            captured_at: m.captured_at,
            added_at: m.added_at,
            is_private: m.is_private,
            visibility: jar.visibility,
            photo_path: m.photo_path,
            edits: m.edits,
            replacement: m.replaces !== null,
          });
        }
        if ((data ?? []).length < PAGE) break;
      }
      return { profile: profile as ExportProfile, moments };
    },
    async purgeAccount(userId) {
      const { data, error } = await db.rpc('account_delete_purge', { p_user: userId });
      if (error) throw new Error(`account_delete_purge: ${error.code}`);
      return data === true;
    },
    async liftSuspensions() {
      const { data, error } = await db.rpc('moderation_lift_suspensions');
      if (error) throw new Error(`moderation_lift_suspensions: ${error.code}`);
      return Number(data ?? 0);
    },
    getObject: (key) => getObject(s3, key),
    putObject: (key, data, contentType) => putObject(s3, key, data, contentType),
    listKeys: (prefix) => listAllKeys(s3, prefix),
    deletePrefix: (prefix) => deletePrefix(s3, prefix),
    startUpload: (key, contentType) => MultipartUpload.start(s3, key, contentType, partSize),
  };
}
