// fn:data-export (M4-18; FR-PRV-02, T-305). "Download my data" in Settings and on the Delete account
// screen. Everything runs as the caller (their JWT, RLS): POST asks for an export with
// account_request_export() (0026: returns the unfinished one, or a done one from the last 24 hours, so
// it is at most one a day); GET reads their latest export job. fn:account-jobs builds the zip in the
// background, usually within minutes. A deleted account that is not purged yet can still use both: the
// purge waits 7 days after its export finishes.
//
// For a done export, `url` is a GET link to the zip that works for 24 hours from this call (each call
// signs a fresh one) and `expiresAt` is when it stops working.
//
// POST (any body is ignored), GET
//   → { data: { status: 'none'|'pending'|'running'|'done'|'failed', requestedAt, url, expiresAt } }
//   → { error: { code, message } }   401 signed out, 403 not_allowed, 405 method
import type { SupabaseClient } from '../_shared/deps.ts';
import { bearerToken, fail, ok } from '../_shared/http.ts';
import { presignObject, type S3Config } from '../_shared/sigv4.ts';

export const LINK_TTL_SECONDS = 24 * 60 * 60;

export interface DataExportDeps {
  userClient: (jwt: string) => SupabaseClient;
  /** The bucket as the phone reaches it (s3ConfigFromEnv, not the server-side endpoint). */
  s3: () => S3Config;
}

export interface ExportState {
  status: 'none' | 'pending' | 'running' | 'done' | 'failed';
  requestedAt: string | null;
  url: string | null;
  expiresAt: string | null;
}

interface ExportJob {
  status: 'pending' | 'running' | 'done' | 'failed';
  created_at: string;
  result_key: string | null;
}

async function state(job: ExportJob | null, s3: () => S3Config): Promise<ExportState> {
  if (!job) return { status: 'none', requestedAt: null, url: null, expiresAt: null };
  const requestedAt = new Date(job.created_at).toISOString();
  if (job.status !== 'done' || !job.result_key) return { status: job.status, requestedAt, url: null, expiresAt: null };
  const now = new Date();
  const url = await presignObject(s3(), job.result_key, { method: 'GET', expiresIn: LINK_TTL_SECONDS, now });
  return {
    status: 'done',
    requestedAt,
    url,
    expiresAt: new Date(now.getTime() - now.getMilliseconds() + LINK_TTL_SECONDS * 1000).toISOString(),
  };
}

export async function handleDataExport(req: Request, deps: DataExportDeps): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET or POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const db = deps.userClient(jwt);
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in first.');

  if (req.method === 'POST') {
    const { data, error } = await db.rpc('account_request_export');
    if (error) {
      if (error.code === '42501') return fail(403, 'not_allowed', 'This account can’t export its data.');
      throw new Error(`account_request_export: ${error.code}`);
    }
    return ok(await state(data as ExportJob, deps.s3));
  }

  const { data, error } = await db.from('account_jobs')
    .select('status, created_at, result_key')
    .eq('user_id', auth.user.id)
    .eq('kind', 'export')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`account_jobs: ${error.code}`);
  return ok(await state(data as ExportJob | null, deps.s3));
}
