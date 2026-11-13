import { buildJarPage, isLiked, withLike, type JarMoment, type JarPageData } from '../jarPage';

const OWNER = 'owner-id';
const READER = 'reader-id';

function moment(over: Partial<JarMoment> & Pick<JarMoment, 'id' | 'slot'>): JarMoment {
  return {
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    caption: null,
    captured_at: null,
    added_at: '2026-11-08T01:00:00Z',
    edits: {},
    like_count: 0,
    thumbUrl: null,
    fullUrl: null,
    ...over,
  };
}

function data(moments: JarMoment[], viewerId: string, counts = { moment_count: 0, visible_count: 0 }): JarPageData {
  return {
    jar: {
      id: 'jar-1',
      user_id: OWNER,
      local_date: '2026-11-08',
      tz: 'Asia/Manila',
      like_count: 0,
      comment_count: 0,
      ...counts,
    },
    author: { username: 'dale', display_name: 'Dale Santos' },
    moments,
    viewerId,
  };
}

const mixed = [
  moment({ id: 'live', slot: 'whereami' }),
  moment({ id: 'private', slot: 'mebusywith', visibility: 'only_me' }),
  moment({ id: 'checking', slot: 'whoamiwith', status: 'checking' }),
  moment({ id: 'removed', slot: 'ootd', status: 'removed' }),
  moment({ id: 'private-checking', slot: 'selfie', status: 'checking', visibility: 'only_me' }),
  moment({ id: 'evening', slot: 'evening' }),
];

const shownIds = (page: ReturnType<typeof buildJarPage>) =>
  [page.cover, ...page.grid].filter((m) => m !== null).map((m) => m.id);

describe('buildJarPage', () => {
  it('never shows private or non-live moments to anyone but the owner, even if a row slips through', () => {
    const page = buildJarPage(data(mixed, READER));
    expect(shownIds(page).sort()).toEqual(['evening', 'live']);
    expect(page.isOwner).toBe(false);
  });

  it('shows the owner their private live moments, but still not checking or removed ones', () => {
    const page = buildJarPage(data(mixed, OWNER));
    expect(shownIds(page).sort()).toEqual(['evening', 'live', 'private']);
  });

  it('counts the moments shown for others and every moment for the owner (D-9, D-50)', () => {
    // visible_count counts every moment that isn't Only me, but a reader may not see an Everyone
    // moment's neighbours or vice versa, so others count what they are shown.
    const counts = { moment_count: 8, visible_count: 6 };
    expect(buildJarPage(data(mixed, READER, counts))).toMatchObject({ count: 2, isFull: false });
    expect(buildJarPage(data(mixed, OWNER, counts))).toMatchObject({ count: 8, isFull: true });
  });

  it('covers with the newest captioned moment and keeps the rest in slot order without repeating it', () => {
    const moments = [
      moment({ id: 'evening', slot: 'evening', caption: 'Older caption', added_at: '2026-11-08T10:00:00Z' }),
      moment({
        id: 'morning',
        slot: 'morning',
        caption: 'Rain again. Coffee first.',
        added_at: '2026-11-08T12:00:00Z',
      }),
      moment({ id: 'selfie', slot: 'selfie', caption: '   ', added_at: '2026-11-08T13:00:00Z' }),
      moment({ id: 'whereami', slot: 'whereami' }),
      // A newer caption on a private moment must not become the reader's cover.
      moment({
        id: 'secret',
        slot: 'ootd',
        visibility: 'only_me',
        caption: 'Secret',
        added_at: '2026-11-08T14:00:00Z',
      }),
    ];
    const page = buildJarPage(data(moments, READER));
    expect(page.cover?.id).toBe('morning');
    expect(page.grid.map((m) => m.id)).toEqual(['whereami', 'selfie', 'evening']);
  });

  it('covers with the first moment in slot order when nothing has a caption', () => {
    const page = buildJarPage(
      data([moment({ id: 'evening', slot: 'evening' }), moment({ id: 'ootd', slot: 'ootd' })], READER),
    );
    expect(page.cover?.id).toBe('ootd');
    expect(page.grid.map((m) => m.id)).toEqual(['evening']);
  });

  it("covers with the owner's pick (D-56) when it is shown, and not when it isn't", () => {
    const moments = [
      moment({ id: 'morning', slot: 'morning', caption: 'Newest', added_at: '2026-11-08T12:00:00Z' }),
      moment({ id: 'whereami', slot: 'whereami' }),
      moment({ id: 'secret', slot: 'ootd', visibility: 'only_me' }),
    ];
    const picked = (id: string, viewer: string) => {
      const d = data(moments, viewer);
      return buildJarPage({ ...d, jar: { ...d.jar, resolved_cover_id: id } });
    };
    const page = picked('whereami', READER);
    expect(page.cover?.id).toBe('whereami');
    expect(page.grid.map((m) => m.id)).toEqual(['morning']);
    // A stale pick of an Only me moment never reaches a reader; the owner still sees theirs.
    expect(picked('secret', READER).cover?.id).toBe('morning');
    expect(picked('secret', OWNER).cover?.id).toBe('secret');
    // A pick that isn't on the page (deleted since) falls back.
    expect(picked('gone', READER).cover?.id).toBe('morning');
  });

  it('has no cover for a jar with nothing to show', () => {
    const page = buildJarPage(data([moment({ id: 'p', slot: 'ootd', visibility: 'only_me' })], READER));
    expect(page).toMatchObject({ cover: null, grid: [] });
  });
});

describe('withLike', () => {
  const page = data(
    [moment({ id: 'a', slot: 'ootd', like_count: 3 }), moment({ id: 'b', slot: 'selfie', like_count: 5 })],
    READER,
  );
  const jarLikes = { ...page, jar: { ...page.jar, like_count: 10 } };

  it('moves the jar count by one and remembers the like', () => {
    const liked = withLike(jarLikes, { kind: 'jar' }, true);
    expect(liked.jar.like_count).toBe(11);
    expect(isLiked(liked, { kind: 'jar' })).toBe(true);
    const unliked = withLike(liked, { kind: 'jar' }, false);
    expect(unliked.jar.like_count).toBe(10);
    expect(isLiked(unliked, { kind: 'jar' })).toBe(false);
  });

  it('changes nothing when the like is already in that state, so a count never moves twice', () => {
    const liked = withLike(jarLikes, { kind: 'jar' }, true);
    expect(withLike(liked, { kind: 'jar' }, true)).toBe(liked);
    expect(withLike(jarLikes, { kind: 'jar' }, false)).toBe(jarLikes);
  });

  it('likes one moment without touching the jar or the other moments', () => {
    const liked = withLike(jarLikes, { kind: 'moment', id: 'b' }, true);
    expect(liked.moments.map((m) => m.like_count)).toEqual([3, 6]);
    expect(liked.jar.like_count).toBe(10);
    expect(isLiked(liked, { kind: 'moment', id: 'b' })).toBe(true);
    expect(isLiked(liked, { kind: 'moment', id: 'a' })).toBe(false);
    expect(isLiked(liked, { kind: 'jar' })).toBe(false);
  });

  it('never shows a negative count when the cached count is behind', () => {
    const stale = { ...jarLikes, jar: { ...jarLikes.jar, like_count: 0 }, liked: { jar: true, moments: [] } };
    expect(withLike(stale, { kind: 'jar' }, false).jar.like_count).toBe(0);
  });
});
