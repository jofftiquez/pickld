// fn:account-purge (M4-03; FR-ACC-04, G-20). The Under 13 screen calls this right after someone enters a
// birthday under 13 during sign-up. It deletes the caller's auth user and everything they uploaded, and
// stores nothing about the attempt (COPPA): no row, no log line, and the birthday is never sent here.
//
// Who can be purged: only the caller (the user id comes from their JWT, never from the body), and only
// while they have no profile row. In the sign-up flow an under-13 person never gets one: About you calls
// this before writing anything, profiles refuses an under-13 birthday (0001 check), and without an active
// profile upload-url and every write refuse them (D-11). So "no profile" is exactly the Under 13 state,
// and an established account can never be deleted this way (deleting an account from Settings is a
// separate, reviewed flow, FR-ACC-06): it gets 403 not_eligible and nothing is touched. account_purge()
// (0023) checks again under a row lock, so a profile created in between still stops the delete.
//
// Order. The profile check, then the photos (every prefix the app uploads to: moments/, avatars/ and
// covers/ under the caller's id; normally empty, swept anyway), then account_purge() deletes the auth user
// and every auth row naming them in one transaction. A failure before that leaves the account signed in
// and still eligible, so the app retries the same call; deleting a photo twice is harmless. After success
// the JWT no longer resolves, so a repeat call answers 401.
//
// POST (any body is ignored)
//   → { data: { purged: true } }
//   → { error: { code, message } }   401 signed out, 403 not_eligible, 405 method
import type { SupabaseClient } from '../_shared/deps.ts';
import { bearerToken, fail, ok } from '../_shared/http.ts';
import { presignObject, presignUrl, type S3Config } from '../_shared/sigv4.ts';

/** Every prefix the app uploads to for one user (_shared/object_keys.ts). */
export function userPrefixes(userId: string): string[] {
  return [`moments/${userId}/`, `avatars/${userId}/`, `covers/${userId}/`];
}

/** The privileged side: the photo bucket and the database as the service role. */
export interface PurgeStore {
  hasProfile(userId: string): Promise<boolean>;
  /** Deletes every object under `prefix`; returns how many were deleted. */
  deletePrefix(prefix: string): Promise<number>;
  /** account_purge() (0023): false, with nothing touched, when the user has a profile. */
  purgeAccount(userId: string): Promise<boolean>;
}

export interface AccountPurgeDeps {
  userClient: (jwt: string) => SupabaseClient;
  store: () => PurgeStore;
}

const NOT_ELIGIBLE = 'This account can’t be removed this way.';

export async function handleAccountPurge(req: Request, deps: AccountPurgeDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const { data: auth } = await deps.userClient(jwt).auth.getUser(jwt);
  const me = auth.user;
  if (!me) return fail(401, 'unauthorized', 'Sign in first.');

  const store = deps.store();
  if (await store.hasProfile(me.id)) return fail(403, 'not_eligible', NOT_ELIGIBLE);

  for (const prefix of userPrefixes(me.id)) await store.deletePrefix(prefix);
  if (!await store.purgeAccount(me.id)) return fail(403, 'not_eligible', NOT_ELIGIBLE);
  return ok({ purged: true });
}

const URL_TTL_SECONDS = 60;
const MAX_PAGES = 50; // 50,000 objects, far more than one person's photos

function xmlText(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** The PurgeStore over the S3 API (R2, or local Supabase Storage) and the service-role client. */
export function serviceStore(db: SupabaseClient, s3: S3Config): PurgeStore {
  return {
    async hasProfile(userId) {
      const { data, error } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (error) throw new Error(`profile lookup: ${error.code}`);
      return data !== null;
    },
    async deletePrefix(prefix) {
      // List one page, delete it, list again from the start: the listing shrinks until it is empty.
      let deleted = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const listUrl = `${s3.endpoint.replace(/\/+$/, '')}/${s3.bucket}?list-type=2&max-keys=1000&prefix=${
          encodeURIComponent(prefix)
        }`;
        const res = await fetch(await presignUrl(listUrl, s3, { method: 'GET', expiresIn: URL_TTL_SECONDS }));
        const xml = await res.text();
        if (!res.ok) throw new Error(`list objects: ${res.status}`);
        const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => xmlText(m[1]))
          .filter((k) => k.startsWith(prefix));
        if (keys.length === 0) return deleted;
        for (const key of keys) {
          const del = await fetch(await presignObject(s3, key, { method: 'DELETE', expiresIn: URL_TTL_SECONDS }), {
            method: 'DELETE',
          });
          await del.body?.cancel();
          if (!del.ok && del.status !== 404) throw new Error(`delete object: ${del.status}`);
          deleted++;
        }
      }
      throw new Error('delete objects: the listing did not shrink');
    },
    async purgeAccount(userId) {
      const { data, error } = await db.rpc('account_purge', { p_user: userId });
      if (error) throw new Error(`account_purge: ${error.code}`);
      return data === true;
    },
  };
}
