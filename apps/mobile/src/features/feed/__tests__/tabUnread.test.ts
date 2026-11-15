import { hasUnread, newestJarAt, newestMomentAt, SEEN_EMPTY, seenKey, seenUpdate } from '../tabUnread';

const me = 'user-me';
const friend = 'user-friend';

describe('tab unread dots (FR-EXP-04, D-157)', () => {
  describe('Moments (and Discover’s Moments list)', () => {
    it('takes the newest added_at from other people, whatever the row order; an empty page has none', () => {
      const rows = [
        { author_id: friend, added_at: '2026-11-14T08:00:00+00:00' },
        { author_id: friend, added_at: '2026-11-14T09:30:00.123456+00:00' },
        { author_id: 'user-other', added_at: '2026-11-13T23:59:59Z' },
      ];
      expect(newestMomentAt(rows, me)).toBe('2026-11-14T09:30:00.123456+00:00');
      expect(newestMomentAt([], me)).toBeNull();
    });

    it('ignores the viewer’s own moments, even when theirs is the newest on the page', () => {
      const rows = [
        { author_id: me, added_at: '2026-11-14T12:00:00Z' },
        { author_id: friend, added_at: '2026-11-14T09:00:00Z' },
      ];
      expect(newestMomentAt(rows, me)).toBe('2026-11-14T09:00:00Z');
      // A page with only their own moments has nothing new for them.
      expect(newestMomentAt([rows[0]!], me)).toBeNull();
      // So posting a moment never lights their own Moments dot.
      expect(hasUnread(newestMomentAt(rows, me), '2026-11-14T09:00:00Z')).toBe(false);
    });

    it('compares times across "Z" and "+00:00": a later moment written with fewer digits still wins', () => {
      // As text "…10:00:00Z" sorts after "…10:00:00.5+00:00", but half a second later is later.
      const rows = [
        { author_id: friend, added_at: '2026-11-14T10:00:00Z' },
        { author_id: friend, added_at: '2026-11-14T10:00:00.500000+00:00' },
      ];
      expect(newestMomentAt(rows, me)).toBe('2026-11-14T10:00:00.500000+00:00');
    });
  });

  describe('Jars', () => {
    it('takes the newest feed_at from other people’s published jars', () => {
      const rows = [
        { author_id: friend, feed_at: '2026-11-14T08:00:00+00:00', published_at: '2026-11-14T08:00:00+00:00' },
        { author_id: friend, feed_at: '2026-11-14T11:00:00Z', published_at: '2026-11-13T22:00:00Z' },
      ];
      // feed_at, not published_at: a moment added to a published jar moves it to the top, and that is new.
      expect(newestJarAt(rows, me)).toBe('2026-11-14T11:00:00Z');
    });

    it('ignores the viewer’s own jars, which move up every time they add a moment', () => {
      const rows = [
        { author_id: me, feed_at: '2026-11-14T12:00:00Z', published_at: '2026-11-14T12:00:00Z' },
        { author_id: friend, feed_at: '2026-11-14T07:00:00Z', published_at: '2026-11-14T07:00:00Z' },
      ];
      expect(newestJarAt(rows, me)).toBe('2026-11-14T07:00:00Z');
      expect(newestJarAt([rows[0]!], me)).toBeNull();
    });

    it('never counts a jar that is not published; a cached row without the column counts (the feed is published only)', () => {
      const rows = [
        { author_id: friend, feed_at: '2026-11-14T12:00:00Z', published_at: null },
        { author_id: friend, feed_at: '2026-11-14T07:00:00Z' },
      ];
      expect(newestJarAt(rows, me)).toBe('2026-11-14T07:00:00Z');
      expect(newestJarAt([rows[0]!], me)).toBeNull();
    });
  });

  it('is unread only when the newest item is strictly later than the last seen one', () => {
    expect(hasUnread('2026-11-14T10:00:01Z', '2026-11-14T10:00:00Z')).toBe(true);
    expect(hasUnread('2026-11-14T09:59:59Z', '2026-11-14T10:00:00Z')).toBe(false);
    expect(hasUnread('2026-11-14T10:00:00Z', '2026-11-14T10:00:00Z')).toBe(false);
  });

  it('compares times, not text: the same instant written two ways is not new, a later one in an earlier zone is', () => {
    // Postgres writes "+00:00" with 6 fraction digits; the same instant read back as ISO text differs.
    expect(hasUnread('2026-11-14T10:00:00.000000+00:00', '2026-11-14T10:00:00.000Z')).toBe(false);
    expect(hasUnread('2026-11-14T18:00:00+08:00', '2026-11-14T10:00:00Z')).toBe(false);
    // As text "09:30" sorts after "02:00", but 09:30 in Manila is 01:30 UTC: earlier, so not new.
    expect(hasUnread('2026-11-14T09:30:00+08:00', '2026-11-14T02:00:00Z')).toBe(false);
    expect(hasUnread('2026-11-14T10:30:00+08:00', '2026-11-14T02:00:00Z')).toBe(true);
    // As text "…:00Z" sorts after "…:00.5+00:00"; as times it is half a second earlier.
    expect(hasUnread('2026-11-14T10:00:00.500000+00:00', '2026-11-14T10:00:00Z')).toBe(true);
  });

  it('shows nothing for an empty list, before anything is stored, or for unreadable times', () => {
    expect(hasUnread(null, '2026-11-14T10:00:00Z')).toBe(false);
    expect(hasUnread('2026-11-14T10:00:00Z', null)).toBe(false);
    expect(hasUnread('not a time', '2026-11-14T10:00:00Z')).toBe(false);
  });

  it('first run: a quiet baseline once the list loads, so a new install shows no dot until something new arrives', () => {
    const newest = '2026-11-14T10:00:00Z';
    expect(seenUpdate({ stored: null, newest: null, listLoaded: false, focused: false })).toBeNull();
    expect(seenUpdate({ stored: null, newest, listLoaded: true, focused: false })).toBe(newest);
    // An empty list stores the epoch, so its first item ever counts as new.
    const empty = seenUpdate({ stored: null, newest: null, listLoaded: true, focused: false });
    expect(empty).toBe(SEEN_EMPTY);
    expect(hasUnread(newest, empty)).toBe(true);
  });

  it('marks the newest as seen only while the tab is open (clearing its dot), and never moves it back', () => {
    const seen = '2026-11-14T10:00:00Z';
    const later = '2026-11-14T11:00:00Z';
    expect(seenUpdate({ stored: seen, newest: later, listLoaded: true, focused: false })).toBeNull();
    const opened = seenUpdate({ stored: seen, newest: later, listLoaded: true, focused: true });
    expect(opened).toBe(later);
    expect(hasUnread(later, opened)).toBe(false);
    expect(seenUpdate({ stored: later, newest: seen, listLoaded: true, focused: true })).toBeNull();
    expect(seenUpdate({ stored: seen, newest: seen, listLoaded: true, focused: true })).toBeNull();
    expect(seenUpdate({ stored: seen, newest: null, listLoaded: true, focused: true })).toBeNull();
    // The same instant in another notation is not "later", so nothing is rewritten.
    expect(
      seenUpdate({
        stored: '2026-11-14T10:00:00Z',
        newest: '2026-11-14T10:00:00.000000+00:00',
        listLoaded: true,
        focused: true,
      }),
    ).toBeNull();
  });

  it('keeps one seen time per tab per user, and Discover’s key from before, so no dot comes back on upgrade', () => {
    expect(seenKey('discover', me)).toBe('discoverSeen:user-me');
    expect(seenKey('moments', me)).toBe('unreadSeen:moments:user-me');
    expect(seenKey('jars', me)).toBe('unreadSeen:jars:user-me');
    expect(new Set([seenKey('moments', me), seenKey('jars', me), seenKey('moments', friend)]).size).toBe(3);
  });
});
