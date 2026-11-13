import { track } from '@/lib/analytics';
import type { QueueItem } from '@/lib/queue/store';

import { trackMomentAdded } from '../momentAnalytics';

// moment_added and first_moment (NFR-ANL-01): what is sent for a moment just added, and that a private
// moment sends nothing. The server's moment count, the queue and this phone's storage are fakes.

const mockStorage = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStorage.set(key, value),
  },
}));
const mockQueue: { items: Pick<QueueItem, 'id'>[] } = { items: [] };
jest.mock('@/lib/queue/store', () => ({ listQueue: async () => mockQueue.items }));
const mockServer: { count: number | null; error: { message: string } | null } = { count: 0, error: null };
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ count: mockServer.count, error: mockServer.error }) }) }),
  }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const USER = 'u-1';
const NOW = new Date('2026-11-12T04:00:00Z'); // 12:00 in Manila
const moment = (over: Partial<QueueItem> = {}) => ({
  id: 7,
  userId: USER,
  slot: 'afternoon' as const,
  localDate: '2026-11-12',
  tz: 'Asia/Manila',
  replace: false,
  ...over,
});

beforeEach(() => {
  mockStorage.clear();
  mockQueue.items = [{ id: 7 }];
  mockServer.count = 0;
  mockServer.error = null;
  jest.mocked(track).mockClear();
});

describe('trackMomentAdded', () => {
  it('the account’s very first moment sends first_moment and moment_added once; the next only moment_added', async () => {
    await trackMomentAdded(moment(), 'readers', NOW);
    const props = { slot: 'afternoon', is_private: false, backfilled: false };
    expect(jest.mocked(track).mock.calls).toEqual([
      ['first_moment', props],
      ['moment_added', props],
    ]);

    jest.mocked(track).mockClear();
    mockServer.count = 1;
    await trackMomentAdded(moment({ id: 8, slot: 'evening' }), 'readers', NOW);
    expect(jest.mocked(track).mock.calls).toEqual([
      ['moment_added', { slot: 'evening', is_private: false, backfilled: false }],
    ]);
  });

  it('a private moment sends nothing, and the public one after it is not the first', async () => {
    await trackMomentAdded(moment(), 'only_me', NOW);
    expect(track).not.toHaveBeenCalled();

    // Still uploading: the server has none yet, but the queue holds the private one.
    mockQueue.items = [{ id: 7 }, { id: 8 }];
    await trackMomentAdded(moment({ id: 8 }), 'readers', NOW);
    expect(jest.mocked(track).mock.calls).toEqual([
      ['moment_added', { slot: 'afternoon', is_private: false, backfilled: false }],
    ]);
  });

  it('a moment for a past date is backfilled; a user who already has moments gets no first_moment', async () => {
    mockServer.count = 12;
    await trackMomentAdded(moment({ localDate: '2026-11-10' }), 'readers', NOW);
    expect(jest.mocked(track).mock.calls).toEqual([
      ['moment_added', { slot: 'afternoon', is_private: false, backfilled: true }],
    ]);
  });

  it('an Everyone moment is tracked like a Readers one; an unknown visibility sends nothing', async () => {
    mockServer.count = 3;
    await trackMomentAdded(moment(), 'everyone', NOW);
    await trackMomentAdded(moment({ id: 9 }), null, NOW);
    expect(jest.mocked(track).mock.calls).toEqual([
      ['moment_added', { slot: 'afternoon', is_private: false, backfilled: false }],
    ]);
  });

  it('a Replace is not a new moment', async () => {
    await trackMomentAdded(moment({ replace: true }), 'readers', NOW);
    expect(track).not.toHaveBeenCalled();
  });
});
