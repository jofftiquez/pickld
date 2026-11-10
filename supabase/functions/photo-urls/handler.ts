// fn:photo-urls (M1-16; NFR-SEC-02, FR-PUB-05, FR-MOD-03; D-12). Returns 15-minute photo URLs for a
// batch of moments, only for the ones the caller can view. Moderators also get queued moments. The
// visibility decision is made in Postgres by moment_photo_paths() (0007), called as the caller.
//
// POST { momentIds: uuid[] }   (1 to 100)
//   → { data: { expiresAt, moments: [{ id, full, thumb, pendingFull?, pendingThumb? }] } }
//   → { error: { code, message } }
// Ids the caller can't view are left out, so they can't be told apart from ids that don't exist.
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { isObjectKey } from '../_shared/object_keys.ts';
import { signPhotoUrl } from '../_shared/photo_token.ts';

export const PHOTO_TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_BATCH = 100;

export const PhotoUrlsInput = z.strictObject({
  momentIds: z.array(z.uuid()).min(1).max(MAX_BATCH),
});

export interface MomentPhotoUrls {
  id: string;
  full: string | null;
  thumb: string | null;
  pendingFull?: string;
  pendingThumb?: string;
}

export interface PhotoUrlsDeps {
  userClient: (jwt: string) => SupabaseClient;
  /** Photo Worker origin, e.g. https://photos.pickld.me (locally http://127.0.0.1:55430). */
  photoBaseUrl: () => string;
  tokenSecret: () => string;
  now?: () => number; // unix seconds
}

interface PathRow {
  moment_id: string;
  photo_path: string | null;
  thumb_path: string | null;
  pending_photo_path: string | null;
  pending_thumb_path: string | null;
}

export async function handlePhotoUrls(req: Request, deps: PhotoUrlsDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in to see photos.');
  const client = deps.userClient(jwt);
  const { data: auth } = await client.auth.getUser(jwt);
  if (!auth.user) return fail(401, 'unauthorized', 'Sign in to see photos.');

  const body = await readJson(req);
  if (body === null) return fail(400, 'invalid_json', 'The request body must be JSON.');
  const parsed = PhotoUrlsInput.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'invalid_input', 'The photo request is not valid.', parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })));
  }
  const ids = [...new Set(parsed.data.momentIds.map((id) => id.toLowerCase()))];

  const { data, error } = await client.rpc('moment_photo_paths', { ids });
  if (error) throw new Error(`moment_photo_paths: ${error.message}`);
  const rows = (data ?? []) as PathRow[];

  const base = deps.photoBaseUrl();
  const secret = deps.tokenSecret();
  const now = deps.now?.() ?? Math.floor(Date.now() / 1000);
  // A path that isn't a well-formed key would only produce a URL the Worker refuses; leave it out.
  const sign = async (key: string | null) =>
    key && isObjectKey(key) ? (await signPhotoUrl(base, key, secret, PHOTO_TOKEN_TTL_SECONDS, now)).url : null;

  const moments = await Promise.all(rows.map(async (r): Promise<MomentPhotoUrls> => {
    const out: MomentPhotoUrls = { id: r.moment_id, full: await sign(r.photo_path), thumb: await sign(r.thumb_path) };
    const pendingFull = await sign(r.pending_photo_path);
    const pendingThumb = await sign(r.pending_thumb_path);
    if (pendingFull) out.pendingFull = pendingFull;
    if (pendingThumb) out.pendingThumb = pendingThumb;
    return out;
  }));

  return ok({ expiresAt: new Date((now + PHOTO_TOKEN_TTL_SECONDS) * 1000).toISOString(), moments });
}
