// Photo object keys in R2 (and the local S3 stand-in). Every upload gets a fresh random id, so an
// object is never overwritten: a replaced photo is a new object, and the old one stays until it is
// deleted (backups). The database stores these keys in photo_path, thumb_path,
// avatar_path and cover_path.
//
//   moments/<user id>/<upload id>/full.jpg     the 3:4 photo (WebP or JPEG; the suffix is fixed, the stored content type is served)
//   moments/<user id>/<upload id>/medium.jpg   a 1080 × 1440 copy for feeds (NFR-PERF-02); optional: moments uploaded
//                                              before it have none, and the Worker then serves full.jpg
//   moments/<user id>/<upload id>/thumb.jpg    its thumbnail
//   avatars/<user id>/<upload id>.jpg
//   covers/<user id>/<upload id>.jpg
//   seed/{photos,thumbs,avatars}/<name>.jpg          local seed data only (supabase/seed.sql)
//   exports/<user id>/<job id>.zip             a data export (fn:account-jobs, FR-PRV-02); not a photo key
//
// Sticker art is public catalog data (FR-STK-04, C-6), kept apart from photo keys:
//   stickers/<pack slug>/<name>.png            stickers.asset_path (0012), uploaded by workers/photos `deno task stickers`
// Art never changes under a key: new art gets a new file name (and a new asset_path), so it can be cached forever.

export type ObjectKind = 'moment' | 'avatar' | 'cover';
export type MomentVariant = 'full' | 'medium' | 'thumb';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(
  `^(?:moments/(${UUID})/${UUID}/(?:full|medium|thumb)|avatars/(${UUID})/${UUID}|covers/(${UUID})/${UUID}|seed/(?:photos|thumbs|avatars)/[a-z0-9_]{1,40})\\.jpg$`,
);

/** Keys for one new upload. Call once per upload; ids are never reused. */
export function newMomentKeys(userId: string): { photo: string; medium: string; thumb: string } {
  const base = `moments/${userId}/${crypto.randomUUID()}`;
  return { photo: `${base}/full.jpg`, medium: `${base}/medium.jpg`, thumb: `${base}/thumb.jpg` };
}

const FULL_SUFFIX = '/full.jpg';
const MEDIUM_SUFFIX = '/medium.jpg';

/** The medium key that sits next to a moment's full photo key, or null for anything else (seed photos have none). */
export function mediumKeyFor(photoKey: string): string | null {
  if (!photoKey.startsWith('moments/') || !photoKey.endsWith(FULL_SUFFIX) || !isObjectKey(photoKey)) return null;
  return photoKey.slice(0, -FULL_SUFFIX.length) + MEDIUM_SUFFIX;
}

/** The full photo key a medium key was made from, or null when `key` is not a medium key. */
export function fullKeyForMedium(key: string): string | null {
  if (!key.startsWith('moments/') || !key.endsWith(MEDIUM_SUFFIX) || !isObjectKey(key)) return null;
  return key.slice(0, -MEDIUM_SUFFIX.length) + FULL_SUFFIX;
}

export function newProfileImageKey(kind: 'avatar' | 'cover', userId: string): string {
  return `${kind}s/${userId}/${crypto.randomUUID()}.jpg`;
}

// Same rule as the stickers_asset_path_format check in 0012.
const STICKER_KEY_PATTERN = /^stickers\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}\.png$/;

/** True for a well-formed sticker art key. Sticker keys are not photo keys: isObjectKey() refuses them. */
export function isStickerKey(key: string): boolean {
  return STICKER_KEY_PATTERN.test(key);
}

/** True for a well-formed photo object key (no traversal, no other prefixes). */
export function isObjectKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** The user id embedded in a key, or null for a malformed or seed key. */
export function keyOwner(key: string): string | null {
  const m = KEY_PATTERN.exec(key);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

/** The profile's own avatar or cover key, or a local seed key; anything else is never signed. */
export function isProfileImageKey(kind: 'avatar' | 'cover', key: string, profileId: string): boolean {
  if (!isObjectKey(key)) return false;
  if (key.startsWith(kind === 'avatar' ? 'seed/avatars/' : 'seed/photos/')) return true;
  return key.startsWith(`${kind}s/`) && keyOwner(key) === profileId;
}

/** Every prefix the app uploads to for one user: what fn:account-purge and an account delete sweep. */
export function userPrefixes(userId: string): string[] {
  return [`moments/${userId}/`, `avatars/${userId}/`, `covers/${userId}/`];
}
