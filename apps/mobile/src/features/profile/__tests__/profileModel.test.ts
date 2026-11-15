import type { JarRow } from '@/features/jar/jarPage';

import {
  buildProfileJars,
  compactCount,
  followAction,
  profileMomentDays,
  profileMoments,
  relationshipOf,
  withReading,
  type ProfileMoment,
} from '../profileModel';

function jar(id: string, local_date: string, over: Partial<JarRow> = {}): JarRow {
  return {
    id,
    user_id: 'mika',
    local_date,
    tz: 'Asia/Manila',
    moment_count: 3,
    visible_count: 2,
    like_count: 0,
    comment_count: 0,
    ...over,
  };
}

function moment(over: Partial<ProfileMoment> & Pick<ProfileMoment, 'id' | 'jar_id' | 'slot'>): ProfileMoment {
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

describe('buildProfileJars', () => {
  const jars = [jar('j-old', '2026-11-06'), jar('j-new', '2026-11-08'), jar('j-private', '2026-11-07')];
  const moments = [
    moment({ id: 'a', jar_id: 'j-old', slot: 'evening' }),
    moment({ id: 'b', jar_id: 'j-old', slot: 'whereami' }),
    moment({ id: 'c', jar_id: 'j-new', slot: 'ootd', caption: 'New shoes' }),
    moment({ id: 'd', jar_id: 'j-new', slot: 'whereami' }),
    moment({ id: 'e', jar_id: 'j-private', slot: 'selfie', visibility: 'only_me' }),
  ];

  it('lists jars newest first with the Jar page cover', () => {
    const result = buildProfileJars(jars, moments, 'dale');
    expect(result.map((j) => j.jar.id)).toEqual(['j-new', 'j-old']);
    // Captioned moment wins the cover; otherwise the first slot in order.
    expect(result.map((j) => j.cover.id)).toEqual(['c', 'b']);
  });

  it('hides a jar with only private moments from others but not from its owner', () => {
    expect(buildProfileJars(jars, moments, 'dale').some((j) => j.jar.id === 'j-private')).toBe(false);
    expect(buildProfileJars(jars, moments, 'mika').some((j) => j.jar.id === 'j-private')).toBe(true);
  });

  it('shows others the visible count and the owner the full count (D-9)', () => {
    expect(buildProfileJars(jars, moments, 'dale')[0]?.count).toBe(2);
    expect(buildProfileJars(jars, moments, 'mika')[0]?.count).toBe(3);
  });

  it('never shows a non-live moment, even to the owner', () => {
    const result = buildProfileJars(
      [jar('j', '2026-11-08')],
      [moment({ id: 'x', jar_id: 'j', slot: 'selfie', status: 'checking' })],
      'mika',
    );
    expect(result).toEqual([]);
  });
});

describe('profileMoments', () => {
  it('keeps days newest first and puts the latest moment of each day first', () => {
    const jars = buildProfileJars(
      [jar('j1', '2026-11-07'), jar('j2', '2026-11-08')],
      [
        moment({ id: 'early', jar_id: 'j2', slot: 'morning', captured_at: '2026-11-08T00:00:00Z' }),
        moment({ id: 'late', jar_id: 'j2', slot: 'evening', captured_at: '2026-11-08T12:00:00Z' }),
        moment({ id: 'prev', jar_id: 'j1', slot: 'evening', captured_at: '2026-11-07T12:00:00Z' }),
      ],
      'dale',
    );
    expect(profileMoments(jars).map((m) => m.moment.id)).toEqual(['late', 'early', 'prev']);
  });
});

describe('profileMomentDays (D-146)', () => {
  const days = (items: ReturnType<typeof profileMoments>) =>
    profileMomentDays(items).map((d) => [d.localDate, d.moments.map((m) => m.moment.id)]);

  it('keeps one header for a day that a page boundary splits', () => {
    const first = profileMoments(
      buildProfileJars(
        [jar('j3', '2026-11-08'), jar('j2', '2026-11-07')],
        [
          moment({ id: 'a', jar_id: 'j3', slot: 'evening' }),
          moment({ id: 'b', jar_id: 'j2', slot: 'evening', captured_at: '2026-11-07T12:00:00Z' }),
        ],
        'dale',
      ),
    );
    // The next page starts inside Nov 7 (the same jar again with its older moment), then Nov 6.
    const next = profileMoments(
      buildProfileJars(
        [jar('j2', '2026-11-07'), jar('j1', '2026-11-06')],
        [
          moment({ id: 'c', jar_id: 'j2', slot: 'morning', captured_at: '2026-11-07T00:00:00Z' }),
          moment({ id: 'd', jar_id: 'j1', slot: 'evening' }),
        ],
        'dale',
      ),
    );
    expect(days([...first, ...next])).toEqual([
      ['2026-11-08', ['a']],
      ['2026-11-07', ['b', 'c']],
      ['2026-11-06', ['d']],
    ]);
  });

  it('puts a backfilled moment under its own day, not the day it was added', () => {
    const items = profileMoments(
      buildProfileJars(
        [jar('today', '2026-11-15'), jar('old', '2023-03-02')],
        [
          moment({ id: 'new', jar_id: 'today', slot: 'morning', added_at: '2026-11-15T01:00:00Z' }),
          moment({
            id: 'backfilled',
            jar_id: 'old',
            slot: 'evening',
            is_backfilled: true,
            captured_at: '2023-03-02T11:00:00Z',
            added_at: '2026-11-15T02:00:00Z',
          }),
        ],
        'dale',
      ),
    );
    expect(days(items)).toEqual([
      ['2026-11-15', ['new']],
      ['2023-03-02', ['backfilled']],
    ]);
  });

  it('uses the jar date in its own zone near midnight, whatever the UTC or phone date', () => {
    // 00:30 on Nov 15 in Manila is still Nov 14 in UTC (and in Los Angeles); 23:50 on Nov 14 in Manila too.
    const items = profileMoments(
      buildProfileJars(
        [jar('j15', '2026-11-15'), jar('j14', '2026-11-14')],
        [
          moment({ id: 'after', jar_id: 'j15', slot: 'evening', captured_at: '2026-11-14T16:30:00Z' }),
          moment({ id: 'before', jar_id: 'j14', slot: 'evening', captured_at: '2026-11-14T15:50:00Z' }),
        ],
        'dale',
      ),
    );
    expect(days(items)).toEqual([
      ['2026-11-15', ['after']],
      ['2026-11-14', ['before']],
    ]);
  });
});

describe('relationshipOf', () => {
  it('tells reading apart from reads-you', () => {
    const rows = [{ reader_id: 'mika', author_id: 'dale' }];
    expect(relationshipOf(rows, 'dale', 'mika')).toEqual({ reading: false, readsYou: true });
    expect(relationshipOf(rows, 'mika', 'dale')).toEqual({ reading: true, readsYou: false });
  });
});

describe('compactCount', () => {
  it.each([
    [0, '0', false],
    [999, '999', false],
    [1000, '1', true],
    [1250, '1.2', true],
    [1999, '1.9', true],
    [48_700, '48', true],
  ])('%i → %s', (n, value, thousands) => {
    expect(compactCount(n, 'en-US')).toEqual({ value, thousands });
  });
});

describe('followAction (D-7)', () => {
  it.each([
    [{ reading: false, readsYou: false }, 'read'],
    [{ reading: false, readsYou: true }, 'readBack'],
    [{ reading: true, readsYou: true }, 'reading'],
    [{ reading: true, readsYou: false }, 'reading'],
  ] as const)('%o → %s', (relationship, action) => {
    expect(followAction(relationship)).toBe(action);
  });
});

describe('withReading', () => {
  const data = {
    profile: {
      id: 'mika',
      username: 'mika',
      display_name: 'Mika',
      bio: null,
      lid_color: '#7fad33',
      reader_count: 2,
      author_count: 1,
      jar_count: 1,
    },
    relationship: { reading: false, readsYou: true },
  };

  it('moves the reader count with the state, once', () => {
    const on = withReading(data, true);
    expect(on.profile.reader_count).toBe(3);
    expect(on.relationship).toEqual({ reading: true, readsYou: true });
    expect(withReading(on, true)).toBe(on);
    expect(withReading(on, false).profile.reader_count).toBe(2);
  });

  it('never goes below zero', () => {
    const odd = {
      ...data,
      profile: { ...data.profile, reader_count: 0 },
      relationship: { reading: true, readsYou: false },
    };
    expect(withReading(odd, false).profile.reader_count).toBe(0);
  });
});
