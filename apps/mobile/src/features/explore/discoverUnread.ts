// The Discover tab's unread dot (FR-EXP-04): Discover has something newer than the newest item the viewer saw the
// last time they had the tab open. Kept on the phone as one timestamp per user; nothing about the items is stored.

/** Stored when Discover was empty on the first run, so its first item ever counts as new. */
export const DISCOVER_SEEN_EMPTY = '1970-01-01T00:00:00Z';

/** True when `a` is a later time than `b`. Postgres and the phone write the same instant differently
 * (`+00:00` or `Z`, 6 or 3 fraction digits), so they are compared as times, not as text. */
function isLater(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta > tb;
}

/** The newest `added_at` among the first page's rows, or null when the page is empty. */
export function newestDiscoverAt(rows: readonly { added_at: string }[]): string | null {
  return rows.reduce<string | null>(
    (newest, r) => (newest === null || isLater(r.added_at, newest) ? r.added_at : newest),
    null,
  );
}

/** Show the dot: something in Discover is newer than what was last seen. Nothing stored yet shows none. */
export function hasUnreadDiscover(newest: string | null, lastSeen: string | null): boolean {
  return newest !== null && lastSeen !== null && isLater(newest, lastSeen);
}

/**
 * What to store as the last seen time now, or null to leave it. The first run (nothing stored) sets a quiet
 * baseline once the list has loaded, so a new install shows no dot until something genuinely new arrives;
 * while Discover is open, everything it shows counts as seen.
 */
export function discoverSeenUpdate(input: {
  stored: string | null;
  newest: string | null;
  listLoaded: boolean;
  focused: boolean;
}): string | null {
  const { stored, newest, listLoaded, focused } = input;
  if (stored === null) return listLoaded ? (newest ?? DISCOVER_SEEN_EMPTY) : null;
  return focused && hasUnreadDiscover(newest, stored) ? newest : null;
}
