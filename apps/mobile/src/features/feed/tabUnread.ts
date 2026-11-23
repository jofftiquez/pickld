// The tab bar's unread dots (FR-EXP-04): Moments or Jars has something from someone else that is newer
// than the newest item the viewer saw the last time they had that tab open. Kept on the phone as one timestamp per
// tab per user; nothing about the items is stored. Discover has no dot (0150): it lists people you haven't chosen,
// and a dot there would only pull you back to browse strangers (AGENTS.md "Product principles").
//
// Each list is compared by the server time it is ordered and paged by, never by a capture date: a moment by
// `added_at` (Moments), a jar by `feed_at` (when it was published, or later when a
// moment went into it, which is what moves it to the top of Jars). So a moment added later to a past day counts as
// new once, when it lands at the top, and an old capture date never makes anything fire again.

export type UnreadTab = 'moments' | 'jars';

/** Stored when a list was empty on the first run, so its first item ever counts as new. */
export const SEEN_EMPTY = '1970-01-01T00:00:00Z';

/** True when `a` is a later time than `b`. Postgres and the phone write the same instant differently
 * (`+00:00` or `Z`, 6 or 3 fraction digits), so they are compared as times, not as text. */
function isLater(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta > tb;
}

/** The latest of `times`, or null when there are none. */
function latest(times: readonly string[]): string | null {
  return times.reduce<string | null>((newest, at) => (newest === null || isLater(at, newest) ? at : newest), null);
}

/** The newest `added_at` among other people's moments on the first page, or null when there are none. */
export function newestMomentAt(
  rows: readonly { author_id: string; added_at: string }[],
  userId: string | null,
): string | null {
  return latest(rows.filter((r) => r.author_id !== userId).map((r) => r.added_at));
}

/**
 * The newest `feed_at` among other people's published jars on the first page, or null when there are none. The
 * timelines only send published jars; a row that says otherwise (`published_at` null) still never counts.
 */
export function newestJarAt(
  rows: readonly { author_id: string; feed_at: string; published_at?: string | null }[],
  userId: string | null,
): string | null {
  return latest(rows.filter((r) => r.author_id !== userId && r.published_at !== null).map((r) => r.feed_at));
}

/** Show the dot: something in the list is newer than what was last seen. Nothing stored yet shows none. */
export function hasUnread(newest: string | null, lastSeen: string | null): boolean {
  return newest !== null && lastSeen !== null && isLater(newest, lastSeen);
}

/**
 * What to store as the last seen time now, or null to leave it. The first run (nothing stored) sets a quiet
 * baseline once the list has loaded, so a new install shows no dot until something genuinely new arrives;
 * while the tab is open, everything it shows counts as seen.
 */
export function seenUpdate(input: {
  stored: string | null;
  newest: string | null;
  listLoaded: boolean;
  focused: boolean;
}): string | null {
  const { stored, newest, listLoaded, focused } = input;
  if (stored === null) return listLoaded ? (newest ?? SEEN_EMPTY) : null;
  return focused && hasUnread(newest, stored) ? newest : null;
}

/**
 * Where the "You're all caught up" line goes: the key of the first row that was already in the list on the last
 * visit (its time is at or before `seenAt`, the last seen time as it was when the tab opened), or null for no line.
 * The line only marks a place in the list; the rows keep the order they came in. It shows only under at least one
 * row from someone else that is new since then, so it never sits at the very top or under only the viewer's own
 * posts, and not at all on a first run (`seenAt` null).
 */
export function caughtUpRow<T>(
  rows: readonly T[],
  seenAt: string | null,
  userId: string | null,
  row: (item: T) => { key: string; authorId: string; at: string },
): string | null {
  if (seenAt === null) return null;
  let newAbove = false;
  for (const item of rows) {
    const { key, authorId, at } = row(item);
    if (isLater(at, seenAt)) newAbove ||= authorId !== userId;
    else return newAbove ? key : null;
  }
  return null;
}

/** Where a tab's last seen time is kept for a user. */
export function seenKey(tab: UnreadTab, userId: string): string {
  return `unreadSeen:${tab}:${userId}`;
}
