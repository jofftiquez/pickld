// fn:public-page (M4-13; FR-WEB-01, C-2, C-6, D-12). The data for the anonymous shared-link pages,
// pickld.me/<username> and pickld.me/j/<id>, with 15-minute photo URLs. The web site calls it with the
// anon key only (rule 2: no service key in a web page) and holds no photo signing secret.
//   * What is public is decided in Postgres by public_profile() / public_jar() (0025), called as anon.
//   * Only keys those functions return are signed: moment photo_path / thumb_path, and the author's own
//     avatar and cover (the same key rule as fn:photo-urls). Readers jars come back as a teaser with no
//     moments, so nothing of theirs is signed.
//
// POST { username } | { jarId }
//   → { data: { kind: 'profile', assetBase, profile: Author, jars: [{ id, local_date, published_at, visible_count, moments }] } }
//   → { data: { kind: 'jar', assetBase, id, local_date, visibility, readers_only, published_at, visible_count, author, moments? } }
//   → { error: { code: 'not_found' | …, message } }   (404 when there is nothing public to show)
// assetBase is the photo Worker origin, for sticker art in moment edits (served without a token, D-25).
// Author = the 0025 author fields plus avatar / cover URLs (null when none); a moment = the 0025 moment
// fields with full / thumb URLs in place of photo_path / thumb_path.
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { fail, ok, readJson } from '../_shared/http.ts';
import { isObjectKey, isProfileImageKey } from '../_shared/object_keys.ts';
import { signPhotoUrl } from '../_shared/photo_token.ts';

export const PUBLIC_PHOTO_TTL_SECONDS = 15 * 60;

// Same rule as the profiles.username check (0001).
export const PublicPageInput = z.union([
  z.strictObject({ username: z.string().regex(/^[A-Za-z0-9._]{3,20}$/) }),
  z.strictObject({ jarId: z.uuid() }),
]);

export interface PublicPageDeps {
  /** A client with only the anon key: no caller, no service key. */
  anonClient: () => SupabaseClient;
  photoBaseUrl: () => string;
  tokenSecret: () => string;
  now?: () => number; // unix seconds
}

type Json = Record<string, unknown>;

export async function handlePublicPage(req: Request, deps: PublicPageDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const body = await readJson(req);
  if (body === null) return fail(400, 'invalid_json', 'The request body must be JSON.');
  const parsed = PublicPageInput.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid_input', 'Ask for one username or one jar id.');

  const client = deps.anonClient();
  const { data, error } = 'username' in parsed.data
    ? await client.rpc('public_profile', { p_username: parsed.data.username })
    : await client.rpc('public_jar', { p_id: parsed.data.jarId });
  if (error) throw new Error(`public page: ${error.message}`);
  if (!data) return fail(404, 'not_found', 'There is nothing public here.');

  const base = deps.photoBaseUrl();
  const secret = deps.tokenSecret();
  const now = deps.now?.() ?? Math.floor(Date.now() / 1000);
  const sign = async (key: unknown) =>
    typeof key === 'string' && isObjectKey(key)
      ? (await signPhotoUrl(base, key, secret, PUBLIC_PHOTO_TTL_SECONDS, now)).url
      : null;

  const author = async ({ avatar_path, cover_path, ...rest }: Json) => {
    const id = String(rest.id);
    const own = (kind: 'avatar' | 'cover', key: unknown) =>
      typeof key === 'string' && isProfileImageKey(kind, key, id) ? sign(key) : null;
    return { ...rest, avatar: await own('avatar', avatar_path), cover: await own('cover', cover_path) };
  };
  const moments = (list: unknown) =>
    Promise.all(((list ?? []) as Json[]).map(async ({ photo_path, thumb_path, ...rest }) => ({
      ...rest,
      full: await sign(photo_path),
      thumb: await sign(thumb_path),
    })));

  const row = data as Json;
  if ('username' in parsed.data) {
    const jars = await Promise.all(((row.jars ?? []) as Json[]).map(async (j) => ({
      ...j,
      moments: await moments(j.moments),
    })));
    return ok({ kind: 'profile', assetBase: base, profile: await author(row.profile as Json), jars });
  }
  const { moments: list, author: a, ...jar } = row;
  return ok({
    kind: 'jar',
    assetBase: base,
    ...jar,
    author: await author(a as Json),
    ...(list === undefined ? {} : { moments: await moments(list) }),
  });
}
