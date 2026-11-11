// The Jars feed's rows (FR-SOC-01): `feed_page` and `feed_authors` (0014) parsed at the boundary, the
// card mosaic (one large photo, up to three small ones and a "+n" tile; design: Feed) and the card's age.
import { z } from 'zod';

export const FEED_PAGE_SIZE = 20;
/** Photos a card shows; `feed_page` returns at most this many previews. */
export const MOSAIC_PHOTOS = 4;

export const feedRow = z.object({
  jar_id: z.string(),
  author_id: z.string(),
  author_username: z.string(),
  author_display_name: z.string(),
  author_avatar_path: z.string().nullable(),
  local_date: z.string(),
  feed_at: z.string(),
  visible_count: z.number(),
  like_count: z.number(),
  comment_count: z.number(),
  preview_moment_ids: z.array(z.string()),
  last_caption: z.string().nullable(),
  is_new: z.boolean(),
});
export type FeedRow = z.infer<typeof feedRow>;

export const feedAuthorRow = z.object({
  author_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  has_new: z.boolean(),
});
export type FeedAuthor = z.infer<typeof feedAuthorRow>;

/** A feed card: the row plus signed thumbnail URLs in preview order (null when signing failed). */
export type FeedJar = FeedRow & { previewUrls: (string | null)[] };

export type FeedPage = { jars: FeedJar[]; nextCursor: FeedCursor | null };
export type FeedCursor = { at: string; id: string };

/** The next page starts after the last row; a short page is the end of the feed. */
export function nextCursor(rows: FeedRow[]): FeedCursor | null {
  const last = rows[rows.length - 1];
  return rows.length < FEED_PAGE_SIZE || last === undefined ? null : { at: last.feed_at, id: last.jar_id };
}

export type MosaicPhoto = { momentId: string; url: string | null };

/** Large photo, up to three small ones, and how many visible moments are left for the "+n" cell (0: none). */
export type Mosaic = { large: MosaicPhoto | null; small: MosaicPhoto[]; more: number };

/**
 * The first preview is the large photo and the next three fill the small grid. Visible moments beyond
 * those get a dark "+n" cell in the grid's last place (6 visible → 4 photos and "+2", as in the design).
 */
export function buildMosaic(jar: Pick<FeedJar, 'preview_moment_ids' | 'previewUrls' | 'visible_count'>): Mosaic {
  const photos = jar.preview_moment_ids
    .slice(0, MOSAIC_PHOTOS)
    .map((momentId, i): MosaicPhoto => ({ momentId, url: jar.previewUrls[i] ?? null }));
  const [large, ...small] = photos;
  return { large: large ?? null, small, more: Math.max(0, jar.visible_count - photos.length) };
}

export type Age = { unit: 'now' | 'minutes' | 'hours' | 'days'; count: number };

/** How long ago a card was updated, rounded down: "now" under a minute, then minutes, hours and days. */
export function ageOf(updatedAt: string, now: Date): Age {
  const minutes = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 60_000);
  if (minutes < 1) return { unit: 'now', count: 0 };
  if (minutes < 60) return { unit: 'minutes', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hours', count: hours };
  return { unit: 'days', count: Math.floor(hours / 24) };
}
