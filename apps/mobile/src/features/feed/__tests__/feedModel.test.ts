import { ageOf, buildMosaic, FEED_PAGE_SIZE, nextCursor, type FeedRow } from '../feedModel';

function row(i: number): FeedRow {
  return {
    jar_id: `jar-${i}`,
    author_id: 'a',
    author_username: 'mika',
    author_display_name: 'Mika Reyes',
    author_avatar_path: null,
    local_date: '2026-11-10',
    feed_at: `2026-11-10T0${i % 10}:00:00Z`,
    visible_count: 1,
    like_count: 0,
    comment_count: 0,
    preview_moment_ids: [],
    last_caption: null,
    is_new: false,
  };
}

describe('nextCursor', () => {
  it('continues after the last row of a full page', () => {
    const rows = Array.from({ length: FEED_PAGE_SIZE }, (_, i) => row(i));
    expect(nextCursor(rows)).toEqual({ at: rows[FEED_PAGE_SIZE - 1]?.feed_at, id: `jar-${FEED_PAGE_SIZE - 1}` });
  });
  it('ends the feed on a short page', () => {
    expect(nextCursor(Array.from({ length: FEED_PAGE_SIZE - 1 }, (_, i) => row(i)))).toBeNull();
    expect(nextCursor([])).toBeNull();
  });
});

describe('buildMosaic', () => {
  const ids = ['m1', 'm2', 'm3', 'm4'];
  it('puts the first preview large and counts the rest of the visible moments as "+n" (design: 6 → +2)', () => {
    const m = buildMosaic({ preview_moment_ids: ids, previewUrls: ['u1', null, 'u3', 'u4'], visible_count: 6 });
    expect(m.large).toEqual({ momentId: 'm1', url: 'u1' });
    expect(m.small).toEqual([
      { momentId: 'm2', url: null },
      { momentId: 'm3', url: 'u3' },
      { momentId: 'm4', url: 'u4' },
    ]);
    expect(m.more).toBe(2);
  });
  it('counts moments without a thumbnail in "+n" too', () => {
    // 3 visible, only 2 thumbnails ready.
    const m = buildMosaic({ preview_moment_ids: ['m1', 'm2'], previewUrls: ['u1', 'u2'], visible_count: 3 });
    expect(m.small).toHaveLength(1);
    expect(m.more).toBe(1);
  });
  it('shows no "+n" when every moment is shown, and caps at four photos', () => {
    expect(buildMosaic({ preview_moment_ids: ids, previewUrls: [], visible_count: 4 }).more).toBe(0);
    const capped = buildMosaic({ preview_moment_ids: [...ids, 'm5'], previewUrls: [], visible_count: 5 });
    expect(capped.small).toHaveLength(3);
    expect(capped.more).toBe(1);
  });
  it('has no large photo when there are no previews', () => {
    expect(buildMosaic({ preview_moment_ids: [], previewUrls: [], visible_count: 2 })).toEqual({
      large: null,
      small: [],
      more: 2,
    });
  });
});

describe('ageOf', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it.each([
    ['2026-11-10T11:59:30Z', { unit: 'now', count: 0 }],
    ['2026-11-10T11:59:00Z', { unit: 'minutes', count: 1 }],
    ['2026-11-10T11:00:01Z', { unit: 'minutes', count: 59 }],
    ['2026-11-10T11:00:00Z', { unit: 'hours', count: 1 }],
    ['2026-11-09T12:00:01Z', { unit: 'hours', count: 23 }],
    ['2026-11-09T12:00:00Z', { unit: 'days', count: 1 }],
    ['2026-11-07T11:00:00Z', { unit: 'days', count: 3 }],
  ])('%s → %o', (at, age) => {
    expect(ageOf(at, now)).toEqual(age);
  });
});
