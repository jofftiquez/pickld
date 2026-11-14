import { DISCOVER_SEEN_EMPTY, discoverSeenUpdate, hasUnreadDiscover, newestDiscoverAt } from '../discoverUnread';

describe('Discover unread dot (FR-EXP-04)', () => {
  it('takes the newest added_at on the first page, whatever the row order; an empty page has none', () => {
    const rows = [
      { added_at: '2026-11-14T08:00:00+00:00' },
      { added_at: '2026-11-14T09:30:00.123456+00:00' },
      { added_at: '2026-11-13T23:59:59Z' },
    ];
    expect(newestDiscoverAt(rows)).toBe('2026-11-14T09:30:00.123456+00:00');
    expect(newestDiscoverAt([])).toBeNull();
  });

  it('is unread only when the newest item is strictly later than the last seen one', () => {
    expect(hasUnreadDiscover('2026-11-14T10:00:01Z', '2026-11-14T10:00:00Z')).toBe(true);
    expect(hasUnreadDiscover('2026-11-14T09:59:59Z', '2026-11-14T10:00:00Z')).toBe(false);
    expect(hasUnreadDiscover('2026-11-14T10:00:00Z', '2026-11-14T10:00:00Z')).toBe(false);
  });

  it('compares times, not text: the same instant written two ways is not new, a later one in an earlier zone is', () => {
    // Postgres writes "+00:00" with 6 fraction digits; the same instant read back as ISO text differs.
    expect(hasUnreadDiscover('2026-11-14T10:00:00.000000+00:00', '2026-11-14T10:00:00.000Z')).toBe(false);
    expect(hasUnreadDiscover('2026-11-14T18:00:00+08:00', '2026-11-14T10:00:00Z')).toBe(false);
    // As text "09:30" sorts after "02:00", but 09:30 in Manila is 01:30 UTC: earlier, so not new.
    expect(hasUnreadDiscover('2026-11-14T09:30:00+08:00', '2026-11-14T02:00:00Z')).toBe(false);
    expect(hasUnreadDiscover('2026-11-14T10:30:00+08:00', '2026-11-14T02:00:00Z')).toBe(true);
  });

  it('shows nothing for an empty Discover, before anything is stored, or for unreadable times', () => {
    expect(hasUnreadDiscover(null, '2026-11-14T10:00:00Z')).toBe(false);
    expect(hasUnreadDiscover('2026-11-14T10:00:00Z', null)).toBe(false);
    expect(hasUnreadDiscover('not a time', '2026-11-14T10:00:00Z')).toBe(false);
  });

  it('first run: a quiet baseline once the list loads, so a new install shows no dot until something new arrives', () => {
    const newest = '2026-11-14T10:00:00Z';
    expect(discoverSeenUpdate({ stored: null, newest: null, listLoaded: false, focused: false })).toBeNull();
    expect(discoverSeenUpdate({ stored: null, newest, listLoaded: true, focused: false })).toBe(newest);
    // An empty Discover stores the epoch, so its first item ever counts as new.
    const empty = discoverSeenUpdate({ stored: null, newest: null, listLoaded: true, focused: false });
    expect(empty).toBe(DISCOVER_SEEN_EMPTY);
    expect(hasUnreadDiscover(newest, empty)).toBe(true);
  });

  it('marks the newest as seen only while Discover is open, and never moves it back', () => {
    const seen = '2026-11-14T10:00:00Z';
    const later = '2026-11-14T11:00:00Z';
    expect(discoverSeenUpdate({ stored: seen, newest: later, listLoaded: true, focused: false })).toBeNull();
    expect(discoverSeenUpdate({ stored: seen, newest: later, listLoaded: true, focused: true })).toBe(later);
    expect(discoverSeenUpdate({ stored: later, newest: seen, listLoaded: true, focused: true })).toBeNull();
    expect(discoverSeenUpdate({ stored: seen, newest: seen, listLoaded: true, focused: true })).toBeNull();
    expect(discoverSeenUpdate({ stored: seen, newest: null, listLoaded: true, focused: true })).toBeNull();
  });
});
