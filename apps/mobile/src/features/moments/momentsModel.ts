// The Moments timeline's rows (FR-SOC-01, D-53): `moments_feed_page` (0067) parsed at the boundary, the
// cursor for the next page and the optimistic like (FR-SOC-05).
import { z } from 'zod';

import { visibilitySchema } from '@/lib/visibility';
import { slots } from '@/theme/tokens';

export const MOMENTS_PAGE_SIZE = 20;

export const momentsFeedRow = z.object({
  moment_id: z.string(),
  jar_id: z.string(),
  author_id: z.string(),
  author_username: z.string(),
  author_display_name: z.string(),
  author_avatar_path: z.string().nullable(),
  slot: z.enum(slots),
  caption: z.string().nullable(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  is_backfilled: z.boolean(),
  visibility: visibilitySchema,
  edits: z.unknown(),
  like_count: z.number(),
  liked: z.boolean(),
  /** The moment's own thread (0068). */
  comment_count: z.number(),
  jar_tz: z.string(),
  jar_local_date: z.string(),
  /** Whether the viewer may open the moment's jar (published and visible to them). */
  jar_visible: z.boolean(),
});
export type MomentsFeedRow = z.infer<typeof momentsFeedRow>;

/** A card: the row plus signed photo URLs from `fn:photo-urls` (null when signing failed). */
export type FeedMoment = MomentsFeedRow & {
  fullUrl: string | null;
  /** The 1080 × 1440 copy the card shows (NFR-PERF-02); absent in a timeline cached before it existed. */
  mediumUrl?: string | null;
  thumbUrl: string | null;
};

export type MomentsCursor = { at: string; id: string };
export type MomentsPage = { moments: FeedMoment[]; nextCursor: MomentsCursor | null };

/** The next page starts after the last row; a short page is the end of the timeline. */
export function nextMomentsCursor(rows: Pick<MomentsFeedRow, 'added_at' | 'moment_id'>[]): MomentsCursor | null {
  const last = rows[rows.length - 1];
  return rows.length < MOMENTS_PAGE_SIZE || last === undefined ? null : { at: last.added_at, id: last.moment_id };
}

/**
 * The pages with the viewer's like on `momentId` set to `liked` and its count moved by one. Setting the state
 * it already has changes nothing, so a count never moves twice.
 */
export function withMomentLike(pages: MomentsPage[], momentId: string, liked: boolean): MomentsPage[] {
  return pages.map((page) => ({
    ...page,
    moments: page.moments.map((m) =>
      m.moment_id === momentId && m.liked !== liked
        ? { ...m, liked, like_count: Math.max(0, m.like_count + (liked ? 1 : -1)) }
        : m,
    ),
  }));
}
