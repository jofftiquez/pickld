import { buildJarPage, type JarMoment, type JarPageData } from '../jarPage';

const OWNER = 'owner-id';
const READER = 'reader-id';

function moment(over: Partial<JarMoment> & Pick<JarMoment, 'id' | 'slot'>): JarMoment {
  return {
    status: 'live',
    is_private: false,
    is_backfilled: false,
    caption: null,
    captured_at: null,
    added_at: '2026-11-08T01:00:00Z',
    edits: {},
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
  moment({ id: 'private', slot: 'mebusywith', is_private: true }),
  moment({ id: 'checking', slot: 'whoamiwith', status: 'checking' }),
  moment({ id: 'removed', slot: 'ootd', status: 'removed' }),
  moment({ id: 'private-checking', slot: 'selfie', status: 'checking', is_private: true }),
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

  it('counts visible moments for others and every moment for the owner (D-9)', () => {
    const counts = { moment_count: 8, visible_count: 6 };
    expect(buildJarPage(data(mixed, READER, counts))).toMatchObject({ count: 6, isFull: false });
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
      moment({ id: 'secret', slot: 'ootd', is_private: true, caption: 'Secret', added_at: '2026-11-08T14:00:00Z' }),
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

  it('has no cover for a jar with nothing to show', () => {
    const page = buildJarPage(data([moment({ id: 'p', slot: 'ootd', is_private: true })], READER));
    expect(page).toMatchObject({ cover: null, grid: [] });
  });
});
