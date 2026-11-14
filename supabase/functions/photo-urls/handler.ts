// fn:photo-urls (M1-16, M3-15; NFR-SEC-02, FR-PUB-05, FR-MOD-03, FR-SOC-11; D-12). Returns 15-minute
// photo URLs for a batch of moments and profiles, only for the ones the caller can view.
//   * Moments: moderators also get queued moments. The visibility decision is made in Postgres by
//     moment_photo_paths() (0007), called as the caller.
//   * Profiles: avatar and cover, read from profiles as the caller, so RLS (0001) leaves out profiles
//     blocked either way and inactive ones. A key is signed only if it is the profile's own avatars/ or
//     covers/ key (or a local seed key); 0018 enforces the same rule in the database.
//
// POST { momentIds?: uuid[], profileIds?: uuid[], stickerArt?: true }
//   (0 to 100 ids each, at least one id in total unless stickerArt is true)
//   → { data: { expiresAt, moments: [{ id, full, medium, thumb, thumbhash?, pendingFull?, pendingMedium?, pendingThumb?,
//                                     pendingThumbhash? }],
//               profiles: [{ id, avatar, cover }], stickerArtBase } }     (avatar / cover null when there is none)
// stickerArtBase is the Worker origin that serves catalog sticker art without a token (D-25): clients draw art
// their bundle lacks from `<stickerArtBase>/<asset_path>?v=<art_version>` (D-131). `{ stickerArt: true }` alone
// asks for just that.
//   → { error: { code, message } }
// medium (NFR-PERF-02) is the 1080 × 1440 copy next to full; it is signed for every moment photo, and the Worker
// serves the full photo under that link when the moment was uploaded before medium copies existed.
// thumbhash (NFR-PERF-02) is the blurred placeholder stored for that thumb key (0121), sent only next to a thumb URL
// the caller gets; moments uploaded before placeholders existed have none.
// Ids the caller can't view are left out, so they can't be told apart from ids that don't exist.
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { isObjectKey, isProfileImageKey, mediumKeyFor } from '../_shared/object_keys.ts';
import { signPhotoUrl } from '../_shared/photo_token.ts';

export const PHOTO_TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_BATCH = 100;

export const PhotoUrlsInput = z
  .strictObject({
    momentIds: z.array(z.uuid()).max(MAX_BATCH).optional(),
    profileIds: z.array(z.uuid()).max(MAX_BATCH).optional(),
    stickerArt: z.literal(true).optional(),
  })
  .refine((v) => v.stickerArt === true || (v.momentIds?.length ?? 0) + (v.profileIds?.length ?? 0) > 0, {
    message: 'Ask for at least one moment or profile.',
  });

export interface MomentPhotoUrls {
  id: string;
  full: string | null;
  medium: string | null;
  thumb: string | null;
  thumbhash?: string;
  pendingFull?: string;
  pendingMedium?: string;
  pendingThumb?: string;
  pendingThumbhash?: string;
}

export interface PhotoUrlsDeps {
  userClient: (jwt: string) => SupabaseClient;
  /** Reads ThumbHash placeholders (0121), which no client may read directly. */
  serviceClient: () => SupabaseClient;
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
    return fail(
      400,
      'invalid_input',
      'The photo request is not valid.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    );
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

  // Placeholders only for the thumb keys this caller is about to get URLs for, so they follow the same rules.
  const thumbKeys = [...new Set(rows.flatMap((r) => [r.thumb_path, r.pending_thumb_path]))]
    .filter((key): key is string => !!key && isObjectKey(key));
  const hashes = new Map<string, string>();
  if (thumbKeys.length > 0) {
    const { data, error } = await deps.serviceClient().from('photo_thumbhashes').select('thumb_path, thumbhash')
      .in('thumb_path', thumbKeys);
    if (error) console.warn(`photo_thumbhashes: ${error.message}`); // photos still load, without a placeholder
    for (const h of (data ?? []) as { thumb_path: string; thumbhash: string }[]) hashes.set(h.thumb_path, h.thumbhash);
  }

  const base = deps.photoBaseUrl();
  const secret = deps.tokenSecret();
  const now = deps.now?.() ?? Math.floor(Date.now() / 1000);
  // A path that isn't a well-formed key would only produce a URL the Worker refuses; leave it out.
  const sign = async (key: string | null) =>
    key && isObjectKey(key) ? (await signPhotoUrl(base, key, secret, PHOTO_TOKEN_TTL_SECONDS, now)).url : null;

  const moments = await Promise.all(rows.map(async (r): Promise<MomentPhotoUrls> => {
    const medium = (key: string | null) => sign(key && mediumKeyFor(key));
    const out: MomentPhotoUrls = {
      id: r.moment_id,
      full: await sign(r.photo_path),
      medium: await medium(r.photo_path),
      thumb: await sign(r.thumb_path),
    };
    const thumbhash = r.thumb_path ? hashes.get(r.thumb_path) : undefined;
    if (out.thumb && thumbhash) out.thumbhash = thumbhash;
    const pendingFull = await sign(r.pending_photo_path);
    const pendingMedium = await medium(r.pending_photo_path);
    const pendingThumb = await sign(r.pending_thumb_path);
    if (pendingFull) out.pendingFull = pendingFull;
    if (pendingMedium) out.pendingMedium = pendingMedium;
    if (pendingThumb) out.pendingThumb = pendingThumb;
    const pendingThumbhash = r.pending_thumb_path ? hashes.get(r.pending_thumb_path) : undefined;
    if (pendingThumb && pendingThumbhash) out.pendingThumbhash = pendingThumbhash;
    return out;
  }));

  const profiles = await Promise.all(profileRows.map(async (p): Promise<ProfilePhotoUrls> => ({
    id: p.id,
    avatar: p.avatar_path && isProfileImageKey('avatar', p.avatar_path, p.id) ? await sign(p.avatar_path) : null,
    cover: p.cover_path && isProfileImageKey('cover', p.cover_path, p.id) ? await sign(p.cover_path) : null,
  })));

  return ok({
    expiresAt: new Date((now + PHOTO_TOKEN_TTL_SECONDS) * 1000).toISOString(),
    moments,
    profiles,
    stickerArtBase: base.replace(/\/+$/, ''),
  });
}
