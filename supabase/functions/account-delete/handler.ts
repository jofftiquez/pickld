// fn:account-delete (M4-18; FR-PRV-03, T-305). The Delete account screen calls this once the person has
// typed DELETE. account_delete_request() (0026), run as the caller, sets their profile to 'deleted', which
// hides it, their jars and their moments from everyone at once (RLS, public RPCs), and queues the purge
// job. fn:account-jobs then deletes every photo and the auth user, which takes the rest of their data
// with it. The purge is due at once, or 7 days after an export finishes so it can still be downloaded.
// The user id comes from the JWT only; the body is ignored. Calling again returns the same job.
//
// POST (any body is ignored)
//   → { data: { deleted: true, purgeAfter: '<ISO time the purge may run from>' } }
//   → { error: { code, message } }   401 signed out, 403 not_allowed, 405 method
import type { SupabaseClient } from '../_shared/deps.ts';
import { bearerToken, fail, ok } from '../_shared/http.ts';

export interface AccountDeleteDeps {
  userClient: (jwt: string) => SupabaseClient;
}

export async function handleAccountDelete(req: Request, deps: AccountDeleteDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const db = deps.userClient(jwt);
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in first.');

  const { data, error } = await db.rpc('account_delete_request');
  if (error) {
    if (error.code === '42501') return fail(403, 'not_allowed', 'This account can’t be deleted.');
    throw new Error(`account_delete_request: ${error.code}`);
  }
  const job = data as { run_after: string };
  return ok({ deleted: true, purgeAfter: new Date(job.run_after).toISOString() });
}
