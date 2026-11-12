// fn:photo-urls (M1-16, M3-15; NFR-SEC-02, FR-PUB-05, FR-MOD-03, FR-SOC-11; D-12). Returns 15-minute
// photo URLs for a batch of moments and profiles, only for the ones the caller can view.
//   * Moments: moderators also get queued moments. The visibility decision is made in Postgres by
//     moment_photo_paths() (0007), called as the caller.
//   * Profiles: avatar and cover, read from profiles as the caller, so RLS (0001) leaves out profiles
//     blocked either way and inactive ones. A key is signed only if it is the profile's own avatars/ or
//     covers/ key (or a local seed key); 0018 enforces the same rule in the database.
//
// POST { momentIds?: uuid[], profileIds?: uuid[] }   (0 to 100 each, at least one id in total)
//   → { data: { expiresAt, moments: [{ id, full, thumb, pendingFull?, pendingThumb? }],
//               profiles: [{ id, avatar, cover }] } }     (avatar / cover null when there is none)
//   → { error: { code, message } }
// Ids the caller can't view are left out, so they can't be told apart from ids that don't exist.
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { isObjectKey, isProfileImageKey } from '../_shared/object_keys.ts';
import { signPhotoUrl } from '../_shared/photo_token.ts';

export const PHOTO_TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_BATCH = 100;

export const PhotoUrlsInput = z
  .strictObject({
    momentIds: z.array(z.uuid()).max(MAX_BATCH).optional(),
    profileIds: z.array(z.uuid()).max(MAX_BATCH).optional(),
  })
  .refine((v) => (v.momentIds?.length ?? 0) + (v.profileIds?.length ?? 0) > 0, {
    message: 'Ask for at least one moment or profile.',
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

export interface ProfilePhotoUrls {
  id: string;
  avatar: string | null;
  cover: string | null;
}

interface ProfileRow {
  id: string;
  avatar_path: string | null;
  cover_path: string | null;
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
  const unique = (list: string[] | undefined) => [...new Set((list ?? []).map((id) => id.toLowerCase()))];
  const ids = unique(parsed.data.momentIds);
  const profileIds = unique(parsed.data.profileIds);

  let rows: PathRow[] = [];
  if (ids.length > 0) {
    const { data, error } = await client.rpc('moment_photo_paths', { ids });
    if (error) throw new Error(`moment_photo_paths: ${error.message}`);
    rows = (data ?? []) as PathRow[];
  }
  let profileRows: ProfileRow[] = [];
  if (profileIds.length > 0) {
    const { data, error } = await client.from('profiles').select('id, avatar_path, cover_path').in('id', profileIds);
    if (error) throw new Error(`profiles: ${error.message}`);
    profileRows = (data ?? []) as ProfileRow[];
  }

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

  const profiles = await Promise.all(profileRows.map(async (p): Promise<ProfilePhotoUrls> => ({
    id: p.id,
    avatar: p.avatar_path && isProfileImageKey('avatar', p.avatar_path, p.id) ? await sign(p.avatar_path) : null,
    cover: p.cover_path && isProfileImageKey('cover', p.cover_path, p.id) ? await sign(p.cover_path) : null,
  })));

  return ok({ expiresAt: new Date((now + PHOTO_TOKEN_TTL_SECONDS) * 1000).toISOString(), moments, profiles });
}
