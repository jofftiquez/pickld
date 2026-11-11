// fn:contacts-match (M3-05; FR-ONB-06, FR-SOC-02; D-4). Matches the caller's address book against
// Pickld users by keyed hash. Contacts are normalized and HMAC-hashed in memory with CONTACT_HASH_SECRET;
// only hashes reach the database, and the caller's contacts are never stored or logged, not even hashed.
// The filtering (never the caller, never blocked users either way, active users only) is decided in
// Postgres by contacts_match_find() (0015).
//
// Each call also keeps contact_hashes filled, because the key must never reach Postgres: it saves the
// caller's own sign-up email hash and backfills up to BACKFILL_BATCH users whose hash is missing or stale
// (see 0015 for why).
//
// POST { emails?: string[], phones?: string[] }   (1 to 2,000 contacts in total; each at most 320 chars)
//   → { data: { matches: [{ id, username, displayName, avatarPath, following }] } }
//   → { error: { code, message } }   400 invalid, 401 signed out, 403 inactive, 413 too many, 429 limited
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { contactHash, normalizeEmail, normalizePhone } from './contacts.ts';

export const MAX_CONTACTS = 2000;
export const BACKFILL_BATCH = 500;
const TOO_MANY = 'too_many_contacts';

const Contacts = z.array(z.string().max(320)).max(MAX_CONTACTS, TOO_MANY);
export const ContactsMatchInput = z.strictObject({ emails: Contacts.optional(), phones: Contacts.optional() })
  .superRefine((v, ctx) => {
    const n = (v.emails?.length ?? 0) + (v.phones?.length ?? 0);
    if (n > MAX_CONTACTS) ctx.addIssue({ code: 'custom', message: TOO_MANY });
    if (n === 0) ctx.addIssue({ code: 'custom', message: 'Send at least one email or phone number.' });
  });

export interface ContactMatch {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  following: boolean;
}

/** The database side, as the service role (0015). Only hashes cross this boundary, never contacts. */
export interface ContactStore {
  /** Records a call for the rate limit: 10 an hour (contact_match_take). */
  take(userId: string): Promise<'ok' | 'limited' | 'inactive'>;
  /** Users whose own-email hash is missing or stale, with their sign-up email. */
  pending(limit: number): Promise<{ userId: string; email: string }[]>;
  save(rows: { userId: string; hash: string }[]): Promise<void>;
  find(userId: string, hashes: string[]): Promise<ContactMatch[]>;
}

export interface ContactsMatchDeps {
  userClient: (jwt: string) => SupabaseClient;
  store: () => ContactStore;
  secret: () => string;
}

export async function handleContactsMatch(req: Request, deps: ContactsMatchDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in to find friends.');
  const { data: auth } = await deps.userClient(jwt).auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in to find friends.');
  const me = auth.user;

  const body = await readJson(req);
  if (body === null) return fail(400, 'invalid_json', 'The request body must be JSON.');
  const parsed = ContactsMatchInput.safeParse(body);
  if (!parsed.success) {
    // Issue messages and paths only: never the submitted values.
    const details = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    if (parsed.error.issues.some((i) => i.message === TOO_MANY)) {
      return fail(413, TOO_MANY, `Send at most ${MAX_CONTACTS} contacts at a time.`);
    }
    return fail(400, 'invalid_input', 'The contacts request is not valid.', details);
  }

  const secret = deps.secret();
  if (secret.length < 32) throw new Error('CONTACT_HASH_SECRET must be at least 32 characters');
  const store = deps.store();

  const taken = await store.take(me.id);
  if (taken === 'inactive') return fail(403, 'inactive', 'This account can’t find friends right now.');
  if (taken === 'limited') return fail(429, 'rate_limited', 'Too many searches. Please try again later.');

  // Keep contact_hashes filled: the caller's own email, then a batch of missing or stale users.
  const own = me.email ? normalizeEmail(me.email) : null;
  const pending = await store.pending(BACKFILL_BATCH);
  const toSave = new Map<string, string>(); // userId → normalized email
  for (const p of pending) {
    const e = normalizeEmail(p.email);
    if (e) toSave.set(p.userId, e);
  }
  if (own) toSave.set(me.id, own);
  if (toSave.size > 0) {
    await store.save(
      await Promise.all(
        [...toSave].map(async ([userId, e]) => ({ userId, hash: await contactHash(secret, 'email', e) })),
      ),
    );
  }

  // The caller's contacts: normalized, deduplicated, hashed, and then only the hashes go on.
  const normalized = new Set<string>();
  for (const e of parsed.data.emails ?? []) {
    const n = normalizeEmail(e);
    if (n) normalized.add(`email:${n}`);
  }
  for (const p of parsed.data.phones ?? []) {
    const n = normalizePhone(p);
    if (n) normalized.add(`phone:${n}`);
  }
  if (normalized.size === 0) return ok({ matches: [] });
  const hashes = await Promise.all([...normalized].map((k) => {
    const i = k.indexOf(':');
    return contactHash(secret, k.slice(0, i) as 'email' | 'phone', k.slice(i + 1));
  }));

  const matches = (await store.find(me.id, hashes)).filter((m) => m.id !== me.id);
  return ok({ matches });
}

interface FindRow {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  is_following: boolean;
}

/** The ContactStore over the service-role client and the 0015 functions. */
export function serviceStore(db: SupabaseClient): ContactStore {
  return {
    async take(userId) {
      const { data, error } = await db.rpc('contact_match_take', { p_user: userId });
      if (error) throw new Error(`contact_match_take: ${error.message}`);
      return data as 'ok' | 'limited' | 'inactive';
    },
    async pending(limit) {
      const { data, error } = await db.rpc('contact_hashes_pending', { p_limit: limit });
      if (error) throw new Error(`contact_hashes_pending: ${error.code}`); // never echo emails
      return ((data ?? []) as { user_id: string; email: string }[]).map((r) => ({ userId: r.user_id, email: r.email }));
    },
    async save(rows) {
      const { error } = await db.rpc('contact_hashes_save', {
        p_user_ids: rows.map((r) => r.userId),
        p_hashes: rows.map((r) => r.hash),
      });
      if (error) throw new Error(`contact_hashes_save: ${error.code}`);
    },
    async find(userId, hashes) {
      const { data, error } = await db.rpc('contacts_match_find', { p_user: userId, p_hashes: hashes });
      if (error) throw new Error(`contacts_match_find: ${error.code}`);
      return ((data ?? []) as FindRow[]).map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        avatarPath: r.avatar_path,
        following: r.is_following,
      }));
    },
  };
}
