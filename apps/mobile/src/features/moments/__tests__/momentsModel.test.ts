import {
  MOMENTS_PAGE_SIZE,
  nextMomentsCursor,
  cardPhotoUrl,
  withMomentLike,
  type FeedMoment,
  type MomentsPage,
} from '../momentsModel';

const row = (i: number) => ({ moment_id: `m${i}`, added_at: `2026-11-10T10:${String(i).padStart(2, '0')}:00Z` });

describe('nextMomentsCursor', () => {
  it('a full page continues after its last row', () => {
    const rows = Array.from({ length: MOMENTS_PAGE_SIZE }, (_, i) => row(i));
    expect(nextMomentsCursor(rows)).toEqual({
      at: rows[MOMENTS_PAGE_SIZE - 1]?.added_at,
      id: `m${MOMENTS_PAGE_SIZE - 1}`,
    });
  });

  it('a short or empty page is the end', () => {
    expect(nextMomentsCursor([row(1), row(2)])).toBeNull();
    expect(nextMomentsCursor([])).toBeNull();
  });
});

describe('withMomentLike', () => {
  const m = (id: string, liked: boolean, like_count: number) => ({ moment_id: id, liked, like_count }) as FeedMoment;
  const pages: MomentsPage[] = [
    { moments: [m('a', false, 2), m('b', true, 5)], nextCursor: null },
    { moments: [m('c', false, 0)], nextCursor: null },
  ];

  it('likes and unlikes one moment, moving its count by one', () => {
    const liked = withMomentLike(pages, 'a', true);
    expect(liked[0]?.moments[0]).toMatchObject({ liked: true, like_count: 3 });
    expect(liked[0]?.moments[1]).toBe(pages[0]?.moments[1]);
    expect(withMomentLike(pages, 'b', false)[0]?.moments[1]).toMatchObject({ liked: false, like_count: 4 });
  });

  it('setting the state it already has changes nothing, and a count never goes below 0', () => {
    expect(withMomentLike(pages, 'b', true)[0]?.moments[1]).toMatchObject({ liked: true, like_count: 5 });
    const odd: MomentsPage[] = [{ moments: [m('z', true, 0)], nextCursor: null }];
    expect(withMomentLike(odd, 'z', false)[0]?.moments[0]).toMatchObject({ liked: false, like_count: 0 });
  });
});

describe('cardPhotoUrl (NFR-PERF-02)', () => {
  it('draws the medium copy, else the full photo, else the thumbnail', () => {
    expect(cardPhotoUrl({ mediumUrl: 'm', fullUrl: 'f', thumbUrl: 't' })).toBe('m');
    expect(cardPhotoUrl({ mediumUrl: null, fullUrl: 'f', thumbUrl: 't' })).toBe('f');
    expect(cardPhotoUrl({ fullUrl: null, thumbUrl: 't' })).toBe('t');
    expect(cardPhotoUrl({ fullUrl: null, thumbUrl: null })).toBeNull();
  });
});
