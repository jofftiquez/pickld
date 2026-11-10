// Photo object keys in R2 (and the local S3 stand-in). Every upload gets a fresh random id, so an
// object is never overwritten: a replaced photo is a new object, and the old one stays until it is
// deleted (docs/architecture.md, backups). The database stores these keys in photo_path, thumb_path,
// avatar_path and cover_path.
//
//   moments/<user id>/<upload id>/full.jpg     the 3:4 photo
//   moments/<user id>/<upload id>/thumb.jpg    its thumbnail
//   avatars/<user id>/<upload id>.jpg
//   covers/<user id>/<upload id>.jpg
//   seed/{photos,thumbs,avatars}/<name>.jpg          local seed data only (supabase/seed.sql)

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

/** True for a well-formed object key (no traversal, no other prefixes). */
export function isObjectKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** The user id embedded in a key, or null for a malformed or seed key. */
export function keyOwner(key: string): string | null {
  const m = KEY_PATTERN.exec(key);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}
