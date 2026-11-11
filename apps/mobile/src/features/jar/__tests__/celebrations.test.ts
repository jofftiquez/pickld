import { filledCount, isJarFull, nextCelebration, type CelebrationsSeen } from '../celebrations';
import { loadCelebrationsSeen, saveCelebrationsSeen } from '../useCelebrations';

const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));

type Status = 'uploading' | 'checking' | 'live' | 'removed';
const moments = (...statuses: Status[]) => statuses.map((status) => ({ status }));
const live = (n: number) => moments(...Array<Status>(n).fill('live'));

const monday = { id: 'jar-mon', localDate: '2026-11-09' };
const tuesday = { id: 'jar-tue', localDate: '2026-11-10' };
const none: CelebrationsSeen = { jars: [], milestones: [] };

describe('filledCount / isJarFull (the server count: every moment that is not removed)', () => {
  it('counts live, checking and uploading, not removed', () => {
    expect(filledCount(moments('live', 'checking', 'uploading', 'removed'))).toBe(3);
  });
  it('is full at exactly 8, not at 7', () => {
    expect(isJarFull(live(7))).toBe(false);
    expect(isJarFull(live(8))).toBe(true);
  });
  it('a removed moment keeps the jar from being full', () => {
    expect(isJarFull([...live(7), { status: 'removed' as const }])).toBe(false);
    expect(isJarFull([...live(7), { status: 'checking' as const }])).toBe(true);
  });
  it('a replacement waiting for moderation is not an extra moment (0013, M2-22)', () => {
    expect(isJarFull([...live(7), { status: 'checking' as const, replaces: 'm-1' }])).toBe(false);
    expect(filledCount([...live(2), { status: 'checking' as const, replaces: null }])).toBe(3);
  });
});

describe('nextCelebration', () => {
  it('shows the Full jar celebration at the 8th moment, not at the 7th', () => {
    expect(nextCelebration({ seen: none, jar: monday, moments: live(7), milestones: [] }).show).toBeNull();
    const at8 = nextCelebration({ seen: none, jar: monday, moments: live(8), milestones: [] });
    expect(at8.show).toEqual({ kind: 'fullJar', jarId: 'jar-mon', localDate: '2026-11-09' });
    expect(at8.seen.jars).toEqual(['jar-mon']);
  });

  it('counts a checking 8th moment (FR-JAR-07 fires when it is added, before moderation)', () => {
    const r = nextCelebration({
      seen: none,
      jar: monday,
      moments: [...live(7), { status: 'checking' }],
      milestones: [],
    });
    expect(r.show?.kind).toBe('fullJar');
  });

  it('does not show the same jar again once seen, and returns the same record', () => {
    const seen: CelebrationsSeen = { jars: ['jar-mon'], milestones: [] };
    const r = nextCelebration({ seen, jar: monday, moments: live(8), milestones: [] });
    expect(r.show).toBeNull();
    expect(r.seen).toBe(seen);
  });

  it('shows again for a second full jar on another day', () => {
    const seen: CelebrationsSeen = { jars: ['jar-mon'], milestones: [] };
    const r = nextCelebration({ seen, jar: tuesday, moments: live(8), milestones: [] });
    expect(r.show).toEqual({ kind: 'fullJar', jarId: 'jar-tue', localDate: '2026-11-10' });
    expect(r.seen.jars).toEqual(['jar-mon', 'jar-tue']);
  });

  it('shows Sticker unlocked after the celebration, only for a newly granted milestone, once', () => {
    const first = nextCelebration({ seen: none, jar: monday, moments: live(8), milestones: ['first_full_jar'] });
    expect(first.show?.kind).toBe('fullJar');
    const second = nextCelebration({ seen: first.seen, jar: monday, moments: live(8), milestones: ['first_full_jar'] });
    expect(second.show).toEqual({ kind: 'sticker', key: 'first_full_jar' });
    const third = nextCelebration({ seen: second.seen, jar: monday, moments: live(8), milestones: ['first_full_jar'] });
    expect(third.show).toBeNull();
  });

  it('shows nothing for a milestone this phone already saw, and ignores unknown keys', () => {
    const seen: CelebrationsSeen = { jars: [], milestones: ['first_full_jar'] };
    expect(
      nextCelebration({ seen, jar: monday, moments: live(3), milestones: ['first_full_jar', 'bogus'] }).show,
    ).toBeNull();
  });

  it('shows one milestone at a time, in milestone order', () => {
    const r = nextCelebration({ seen: none, jar: null, moments: [], milestones: ['jars_30', 'full_jars_7'] });
    expect(r.show).toEqual({ kind: 'sticker', key: 'full_jars_7' });
    expect(
      nextCelebration({ seen: r.seen, jar: null, moments: [], milestones: ['jars_30', 'full_jars_7'] }).show,
    ).toEqual({
      kind: 'sticker',
      key: 'jars_30',
    });
  });

  it('on a phone with no record, records what is already there and shows nothing', () => {
    const r = nextCelebration({ seen: null, jar: monday, moments: live(8), milestones: ['first_full_jar'] });
    expect(r.show).toBeNull();
    expect(r.seen).toEqual({ jars: ['jar-mon'], milestones: ['first_full_jar'] });
    // ...and the next jar still celebrates.
    expect(
      nextCelebration({ seen: r.seen, jar: tuesday, moments: live(8), milestones: ['first_full_jar'] }).show?.kind,
    ).toBe('fullJar');
  });
});

describe('seen record on the phone', () => {
  beforeEach(() => mockDisk.clear());

  it('is null until saved, then keeps jars and milestones per user', async () => {
    expect(await loadCelebrationsSeen('u1')).toBeNull();
    await saveCelebrationsSeen('u1', { jars: ['jar-mon'], milestones: ['first_full_jar'] });
    expect(await loadCelebrationsSeen('u1')).toEqual({ jars: ['jar-mon'], milestones: ['first_full_jar'] });
    expect(await loadCelebrationsSeen('u2')).toBeNull();
  });

  it('keeps only the latest 50 jars', async () => {
    const jars = Array.from({ length: 60 }, (_, i) => `jar-${i}`);
    await saveCelebrationsSeen('u1', { jars, milestones: [] });
    const loaded = await loadCelebrationsSeen('u1');
    expect(loaded?.jars).toHaveLength(50);
    expect(loaded?.jars[49]).toBe('jar-59');
  });

  it('treats a damaged record as no record', async () => {
    mockDisk.set('pickld-celebrations:u1', JSON.stringify({ jars: 'nope' }));
    expect(await loadCelebrationsSeen('u1')).toBeNull();
  });
});
