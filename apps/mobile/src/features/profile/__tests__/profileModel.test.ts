import type { JarRow } from '@/features/jar/jarPage';

import {
  buildProfileJars,
  compactCount,
  followAction,
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
