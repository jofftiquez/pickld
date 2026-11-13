import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { reportNetworkResult } from '@/lib/connectivity';

import TodayScreen from '../../../../app/(tabs)/today';

// The real Today route and useCelebrations; fakes only at the edges: Supabase, the phone's key-value
// store, the queue, the router (with a focus switch) and the phone zone.

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';
const SEEN_KEY = `pickld-celebrations:${USER}`;
const slotNames = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'];

type Row = Record<string, unknown>;
const mockBackend = {
  jars: [] as Row[],
  moments: [] as Row[],
  milestones: [] as string[],
  jarNumber: 129 as number | null,
};

// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/features/onboarding/FirstMomentTip', () => ({ FirstMomentTip: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
jest.mock('@/lib/supabase', () => {
  const answer = (table: string, head: boolean) => {
    if (table === 'profiles') {
      return {
        data: { display_name: 'Dale Cruz', avatar_path: null, reader_count: 3, lid_color: 'brand' },
        error: null,
      };
    }
    if (table === 'jars')
      return head ? { data: null, count: mockBackend.jarNumber, error: null } : { data: mockBackend.jars, error: null };
    if (table === 'milestones') return { data: mockBackend.milestones.map((key) => ({ key })), error: null };
    return { data: mockBackend.moments, error: null };
  };
  const query = (table: string) => {
    let head = false;
    const builder = {
      select: (_cols: string, opts?: { head?: boolean }) => {
        head = opts?.head ?? false;
        return builder;
      },
      eq: () => builder,
      gt: () => builder,
      lte: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => answer(table, head),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer(table, head)).then(resolve),
    };
    return builder;
  };
  const client = { from: query, functions: { invoke: async () => ({ data: { data: { moments: [] } }, error: null }) } };
  return { getSupabase: () => client };
});
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));
jest.mock('@/lib/queue/store', () => ({
  listQueue: async () => [],
  subscribeQueue: () => () => {},
  retryItem: jest.fn(async () => ({})),
}));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => {}) }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
// The Replace prompt (kit Dialog, M2-22) reads Reduce Motion from Reanimated, which can't load in Jest.
jest.mock('react-native-reanimated', () => ({ __esModule: true, useReducedMotion: () => false }));
jest.mock('expo-localization', () => ({
  ...jest.requireActual<object>('expo-localization'),
  getCalendars: () => [{ timeZone: 'Asia/Manila' }],
}));

// Today's focus: a pushed celebration blurs it, closing the celebration focuses it again.
const mockFocus = {
  focused: true,
  listeners: new Set<() => void>(),
  set(value: boolean) {
    this.focused = value;
    this.listeners.forEach((l) => l());
  },
};
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      const focused = React.useSyncExternalStore(
        (l: () => void) => {
          mockFocus.listeners.add(l);
          return () => mockFocus.listeners.delete(l);
        },
        () => mockFocus.focused,
      );
      React.useEffect(() => (focused ? cb() : undefined), [focused, cb]);
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

function moments(n: number, status = 'live'): Row[] {
  return slotNames.slice(0, n).map((slot) => ({
    id: `m-${slot}`,
    slot,
    status,
    visibility: 'readers',
    is_backfilled: false,
    captured_at: '2026-11-10T00:30:00Z',
    added_at: '2026-11-10T00:31:00Z',
  }));
}

function newClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, staleTime: 30_000, networkMode: 'offlineFirst', retry: false } },
  });
}

const app = (key: string) => (
  <QueryClientProvider key={key} client={newClient()}>
    <TodayScreen />
  </QueryClientProvider>
);

async function launch() {
  const view = await render(app('first'));
  await settle();
  return view;
}

/** Lets the queries, the store read and the jar number settle (the machine may be slow). */
async function settle() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

async function refocus() {
  await act(async () => mockFocus.set(false));
  await act(async () => mockFocus.set(true));
  await settle();
}

const calls = (n: number) => waitFor(() => expect(mockPush).toHaveBeenCalledTimes(n), { timeout: 10_000 });

jest.setTimeout(60_000);

const seenRecord = () => JSON.parse(mockDisk.get(SEEN_KEY) ?? 'null') as unknown;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-11-10T09:00:00Z')); // 17:00 in Manila
  mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
  mockBackend.moments = [];
  mockBackend.milestones = [];
  mockBackend.jarNumber = 129;
  mockDisk.clear();
  mockDisk.set(SEEN_KEY, JSON.stringify({ jars: [], milestones: [] }));
  mockPush.mockClear();
  jest.mocked(track).mockClear();
  mockFocus.focused = true;
  reportNetworkResult(null);
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => jest.useRealTimers());

describe('Today celebrations', () => {
  it('opens nothing at 7 moments', async () => {
    mockBackend.moments = moments(7);
    await launch();
    await refocus();
    expect(mockPush).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('opens the Full jar celebration at 8 moments with the jar number, then Sticker unlocked once it closes', async () => {
    mockBackend.moments = [...moments(7), ...moments(8, 'checking').slice(7)];
    mockBackend.milestones = ['first_full_jar'];
    await launch();
    await calls(1);
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/full-jar',
      params: { jarId: 'jar-10', localDate: '2026-11-10', number: '129' },
    });
    expect(seenRecord()).toEqual({ jars: ['jar-10'], milestones: [] });

    await refocus(); // the celebration closed
    await calls(2);
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/sticker-unlocked',
      params: { key: 'first_full_jar', earned: '1' },
    });

    await refocus(); // Sticker unlocked closed: nothing more
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(jest.mocked(track).mock.calls).toEqual([['jar_full', {}]]);
  });

  it('leaves the number out when it cannot be read', async () => {
    mockBackend.moments = moments(8);
    mockBackend.jarNumber = null;
    await launch();
    await calls(1);
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/full-jar',
      params: { jarId: 'jar-10', localDate: '2026-11-10' },
    });
  });

  it('does not open again after a relaunch once seen', async () => {
    mockBackend.moments = moments(8);
    mockBackend.milestones = ['first_full_jar'];
    const first = await launch();
    await calls(1);
    await refocus();
    await calls(2);

    // Relaunch: a fresh Today and query cache on the same phone store.
    mockPush.mockClear();
    await first.rerender(app('second'));
    await settle();
    await refocus();
    expect(mockPush).not.toHaveBeenCalled();
    expect(jest.mocked(track).mock.calls).toEqual([['jar_full', {}]]); // the first launch's, once
  });

  it('opens for the next day’s full jar', async () => {
    mockDisk.set(SEEN_KEY, JSON.stringify({ jars: ['jar-09'], milestones: ['first_full_jar'] }));
    mockBackend.moments = moments(8);
    mockBackend.milestones = ['first_full_jar'];
    await launch();
    await calls(1);
    expect(mockPush).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: '/full-jar' }));
    await refocus();
    expect(mockPush).toHaveBeenCalledTimes(1); // the milestone was already seen
  });

  it('on a phone with no record, opens nothing for a jar and milestones already there', async () => {
    mockDisk.delete(SEEN_KEY);
    mockBackend.moments = moments(8);
    mockBackend.milestones = ['first_full_jar'];
    await launch();
    await waitFor(() => expect(seenRecord()).not.toBeNull(), { timeout: 10_000 });
    await refocus();
    expect(mockPush).not.toHaveBeenCalled();
    expect(seenRecord()).toEqual({ jars: ['jar-10'], milestones: ['first_full_jar'] });
  });

  it('waits while Today is not focused', async () => {
    mockFocus.focused = false;
    mockBackend.moments = moments(8);
    await launch();
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => mockFocus.set(true));
    await calls(1);
  });
});
