// The Jar page (FR-SOC-03, FR-JAR-06; design: Story): one person's jar for one day. Rows are read as the
// viewer, so RLS decides what comes back (moments_others_select, 0066: others get the live moments whose
// own visibility lets them see it, D-48 and D-50). The model filters again so a stale cache or an
// owner-only row can never reach another viewer's screen (rule 9).
import { z } from 'zod';

import { visibilitySchema } from '@/lib/visibility';
import { slots, type Slot } from '@/theme/tokens';

export const jarRow = z.object({
  id: z.string(),
  user_id: z.string(),
  local_date: z.string(),
  tz: z.string(),
  moment_count: z.number(),
  visible_count: z.number(),
  like_count: z.number(),
  comment_count: z.number(),
  /** False when read through `moment_jar` (0067): the viewer sees moments in it but can't open the jar. */
  open: z.boolean().optional(),
  /**
   * The cover this viewer may see (0069 `resolved_cover_id`, D-56): the owner's pick if they may view it,
   * else the newest caption, else the first slot. Absent from `moment_jar` rows and older caches.
   */
  resolved_cover_id: z.string().nullish(),
});
export type JarRow = z.infer<typeof jarRow>;

export const authorRow = z.object({
  username: z.string(),
  display_name: z.string(),
  /** For the Share background in the lid color; feed rows don't select it. */
  lid_color: z.string().nullish(),
  /** For the avatar (D-93); missing in caches from before it. */
  avatar_path: z.string().nullish(),
});
export type AuthorRow = z.infer<typeof authorRow>;

export const jarMomentRow = z.object({
  id: z.string(),
  slot: z.enum(slots),
  status: z.string(),
  visibility: visibilitySchema,
  is_backfilled: z.boolean(),
  caption: z.string().nullable(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  edits: z.unknown(),
  like_count: z.number(),
  /** The moment's own thread (0068, D-51). Optional: jar pages cached before it was selected lack it. */
  comment_count: z.number().optional(),
});
export type JarMomentRow = z.infer<typeof jarMomentRow>;

/** A moment with its signed photo URLs from `fn:photo-urls` (null when signing failed). */
export type JarMoment = JarMomentRow & { thumbUrl: string | null; fullUrl: string | null };

export type JarPageData = {
  jar: JarRow;
  author: AuthorRow;
  moments: JarMoment[];
  /** The signed-in viewer; the owner also sees their Only me moments. */
  viewerId: string;
  /** What the viewer has liked on this page (FR-SOC-05). Optional: caches from before M3-09 lack it. */
  liked?: Liked;
};

export type Liked = { jar: boolean; moments: string[] };

/** A like goes on the jar or on one of its moments. */
export type LikeTarget = { kind: 'jar' } | { kind: 'moment'; id: string };

export function isLiked(data: Pick<JarPageData, 'liked'>, target: LikeTarget): boolean {
  return target.kind === 'jar' ? (data.liked?.jar ?? false) : (data.liked?.moments.includes(target.id) ?? false);
}

/**
 * The page with the viewer's like on `target` set to `liked`, and its count moved by one (the optimistic
 * update; FR-SOC-05). Setting the state it already has changes nothing, so a count never moves twice.
 */
export function withLike(data: JarPageData, target: LikeTarget, liked: boolean): JarPageData {
  if (isLiked(data, target) === liked) return data;
  const step = liked ? 1 : -1;
  const current = data.liked ?? { jar: false, moments: [] };
  if (target.kind === 'jar') {
    return {
      ...data,
      jar: { ...data.jar, like_count: Math.max(0, data.jar.like_count + step) },
      liked: { ...current, jar: liked },
    };
  }
  return {
    ...data,
    moments: data.moments.map((m) => (m.id === target.id ? { ...m, like_count: Math.max(0, m.like_count + step) } : m)),
    liked: {
      ...current,
      moments: liked ? [...current.moments, target.id] : current.moments.filter((id) => id !== target.id),
    },
  };
}

export type JarPage = {
  isOwner: boolean;
  /** The count the viewer is allowed to know (D-9, D-50): every moment that isn't removed for the owner, else the moments shown to them. */
  count: number;
  isFull: boolean;
  /**
   * The cover photo (D-56): the server's resolved cover when it is among the shown moments, else the moment
   * with the newest caption, else the first in slot order. Null for an empty jar.
   */
  cover: JarMoment | null;
  /** The rest of the shown moments in slot order; the cover is not repeated. */
  grid: JarMoment[];
  /** Every shown moment in slot order, cover included: what Moment detail swipes through. */
  moments: JarMoment[];
};

/**
 * Whether the viewer may see the moment on this page: live, and Only me ones only by their owner. Whether
 * a Readers moment reaches someone who doesn't read the owner is RLS's call (0066); this is the backstop.
 */
export function isShown(moment: Pick<JarMomentRow, 'status' | 'visibility'>, isOwner: boolean): boolean {
  return moment.status === 'live' && (isOwner || moment.visibility !== 'only_me');
}

const slotIndex = (slot: Slot) => slots.indexOf(slot);

/** The cover caption follows the feed card's quote (0014 last_caption): newest added_at, then later slot. */
export function newestCaptioned<T extends Pick<JarMoment, 'caption' | 'added_at' | 'slot'>>(moments: T[]): T | null {
  const captioned = moments.filter((m) => (m.caption ?? '').trim() !== '');
  captioned.sort((a, b) => b.added_at.localeCompare(a.added_at) || slotIndex(b.slot) - slotIndex(a.slot));
  return captioned[0] ?? null;
}

export function buildJarPage({ jar, moments, viewerId }: JarPageData): JarPage {
  const isOwner = jar.user_id === viewerId;
  const shown = moments.filter((m) => isShown(m, isOwner)).sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));
  const picked = jar.resolved_cover_id ? shown.find((m) => m.id === jar.resolved_cover_id) : undefined;
  const cover = picked ?? newestCaptioned(shown) ?? shown[0] ?? null;
  // A mixed jar shows each viewer only what they may see (D-50), so others count what they are shown.
  const count = isOwner ? jar.moment_count : shown.length;
  return {
    isOwner,
    count,
    isFull: count >= slots.length,
    cover,
    grid: shown.filter((m) => m !== cover),
    moments: shown,
  };
}
