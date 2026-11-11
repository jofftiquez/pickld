// Photo object keys in R2 (and the local S3 stand-in). Every upload gets a fresh random id, so an
// object is never overwritten: a replaced photo is a new object, and the old one stays until it is
// deleted (docs/architecture.md, backups). The database stores these keys in photo_path, thumb_path,
// avatar_path and cover_path.
//
//   moments/<user id>/<upload id>/full.jpg     the 3:4 photo (WebP or JPEG; the suffix is fixed, the stored content type is served)
//   moments/<user id>/<upload id>/thumb.jpg    its thumbnail
//   avatars/<user id>/<upload id>.jpg
//   covers/<user id>/<upload id>.jpg
//   seed/{photos,thumbs,avatars}/<name>.jpg          local seed data only (supabase/seed.sql)
//
// Sticker art is public catalog data (FR-STK-04, C-6), kept apart from photo keys:
//   stickers/<pack slug>/<name>.png            stickers.asset_path (0012), uploaded by workers/photos `deno task stickers`
// Art never changes under a key: new art gets a new file name (and a new asset_path), so it can be cached forever.

export type ObjectKind = 'moment' | 'avatar' | 'cover';
export type MomentVariant = 'full' | 'thumb';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(
  `^(?:moments/(${UUID})/${UUID}/(?:full|thumb)|avatars/(${UUID})/${UUID}|covers/(${UUID})/${UUID}|seed/(?:photos|thumbs|avatars)/[a-z0-9_]{1,40})\\.jpg$`,
);

/** Keys for one new upload. Call once per upload; ids are never reused. */
export function newMomentKeys(userId: string): { photo: string; thumb: string } {
  const base = `moments/${userId}/${crypto.randomUUID()}`;
  return { photo: `${base}/full.jpg`, thumb: `${base}/thumb.jpg` };
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
