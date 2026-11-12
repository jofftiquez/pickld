// fn:account-jobs (M4-18; FR-PRV-02, FR-PRV-03; T-305). Called by a Supabase Cron job with the
// x-jobs-secret header (ACCOUNT_JOBS_SECRET); nothing else may call it. Each run claims a few due
// account_jobs (0026: account_jobs_claim) and runs them one after another:
//
//   export  The person's profile, every moment of theirs that moderation hasn't removed (private ones
//           too: it is their own data) and each moment's full photo go into a zip written to
//           exports/<user id>/<job id>.zip as a multipart upload, one photo in memory at a time:
//             profile.json                 username, display_name, bio, birthday, created_at
//             moments.json                 [{ date, slot, caption, captured_at, added_at, is_private,
//                                             visibility (of the jar), photo (path in the zip or null) }]
//             photos/<date>/<slot>.jpg     a pending replacement is <slot>-replacement.jpg
//           The job is marked done with that key; fn:data-export signs links to it.
//   delete  Every object under the person's prefixes (moments/, avatars/, covers/ and exports/ under
//           their id; never seed/), then account_delete_purge(): the auth user and every row keyed to
//           them (the job row too) are deleted. It refuses an account whose profile isn't 'deleted'.
//
// A failure puts the job back for another try in 10 minutes, and fails it after the third attempt
// (account_job_fail). Messages name only the step and a status code, never a key or personal data.
//
// POST {}  (x-jobs-secret: …)
//   → { data: { claimed, done, failed } }
//   → { error: { code, message } }   401 wrong secret, 405 method
import type { SupabaseClient } from '../_shared/deps.ts';
import { deletePrefix, getObject, MultipartUpload } from '../_shared/bucket.ts';
import { fail, ok } from '../_shared/http.ts';
import { isObjectKey, userPrefixes } from '../_shared/object_keys.ts';
import type { S3Config } from '../_shared/sigv4.ts';
import { ZipWriter } from '../_shared/zip.ts';

export const BATCH = 3;

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
  date: string;
  slot: string;
  caption: string | null;
  captured_at: string | null;
  added_at: string;
  is_private: boolean;
  visibility: string;
  photo_path: string | null;
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
  exportData(userId: string): Promise<{ profile: ExportProfile; moments: ExportMoment[] }>;
  /** account_delete_purge(): false, with nothing touched, unless the profile is 'deleted'. */
  purgeAccount(userId: string): Promise<boolean>;
  getObject(key: string): Promise<Uint8Array | null>;
  deletePrefix(prefix: string): Promise<number>;
  startUpload(key: string, contentType: string): Promise<UploadSink>;
}

export interface AccountJobsDeps {
  store: () => JobsStore;
  secret: () => string;
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

async function runExport(store: JobsStore, job: AccountJob): Promise<string> {
  const { profile, moments } = await store.exportData(job.user_id);
  moments.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) ||
      Number(a.replacement) - Number(b.replacement)
  );
  const key = exportKey(job);
  const upload = await store.startUpload(key, 'application/zip');
  try {
    const zip = new ZipWriter((chunk) => upload.write(chunk));
    await zip.add('profile.json', json(profile));
    const entries = [];
    for (const m of moments) {
      const bytes = m.photo_path && isObjectKey(m.photo_path) ? await store.getObject(m.photo_path) : null;
      const photo = bytes ? `photos/${m.date}/${m.slot}${m.replacement ? '-replacement' : ''}.jpg` : null;
      if (bytes && photo) await zip.add(photo, bytes);
      entries.push({
        date: m.date,
        slot: m.slot,
        caption: m.caption,
        captured_at: m.captured_at,
        added_at: m.added_at,
        is_private: m.is_private,
        visibility: m.visibility,
        photo,
      });
    }
    await zip.add('moments.json', json(entries));
    await zip.finish();
    await upload.complete();
  } catch (e) {
    await upload.abort().catch(() => undefined);
    throw e;
  }
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
  const jobs = await store.claim(BATCH);
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (job.kind === 'export') await store.done(job.id, await runExport(store, job));
      else await runDelete(store, job); // the job row went with the account
      done += 1;
    } catch (e) {
      failed += 1;
      await store.fail(job.id, e instanceof Error ? e.message : 'failed');
    }
  }
  return ok({ claimed: jobs.length, done, failed });
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
    async exportData(userId) {
      const { data: profile, error } = await db.from('profiles')
        .select('username, display_name, bio, birthday, created_at').eq('id', userId).single();
      if (error) throw new Error(`profile: ${error.code}`);
      const moments: ExportMoment[] = [];
      for (let from = 0;; from += PAGE) {
        const { data, error: mErr } = await db.from('moments')
          .select(
            'id, slot, caption, captured_at, added_at, is_private, photo_path, replaces, jars!inner(local_date, visibility)',
          )
          .eq('user_id', userId)
          .neq('status', 'removed')
          .order('id')
          .range(from, from + PAGE - 1);
        if (mErr) throw new Error(`moments: ${mErr.code}`);
        for (const m of data ?? []) {
          const jar = (Array.isArray(m.jars) ? m.jars[0] : m.jars) as { local_date: string; visibility: string };
          moments.push({
            date: jar.local_date,
            slot: m.slot,
            caption: m.caption,
            captured_at: m.captured_at,
            added_at: m.added_at,
            is_private: m.is_private,
            visibility: jar.visibility,
            photo_path: m.photo_path,
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
    getObject: (key) => getObject(s3, key),
    deletePrefix: (prefix) => deletePrefix(s3, prefix),
    startUpload: (key, contentType) => MultipartUpload.start(s3, key, contentType, partSize),
  };
}
