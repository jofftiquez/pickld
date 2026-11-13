import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/authStore';
import { reportNetworkResult } from '@/lib/connectivity';

import TodayScreen from '../../../../app/(tabs)/today';
import type { TodayJar } from '../useToday';

// The real Today route with its hooks; Supabase, the SQLite stores, the router and the phone zone are
// fakes. The phone is in Tokyo; the previous jar was in Manila (FR-JAR-05, M2-29).

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';

type Row = { id: string; local_date: string; tz: string; ends_at: string | null };
const mockBackend = { offline: false, jars: [] as Row[], olderReads: 0 };

// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/features/onboarding/FirstMomentTip', () => ({ FirstMomentTip: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
jest.mock('@/lib/supabase', () => {
  const query = (table: string) => {
    const filters: { lt?: string; limit?: number } = {};
    const answer = () => {
      if (mockBackend.offline) return { data: null, error: { message: 'TypeError: Network request failed', code: '' } };
      if (table === 'profiles') {
        return {
          data: { display_name: 'Dale Cruz', avatar_path: null, reader_count: 312, lid_color: 'brand' },
          error: null,
        };
      }
      if (table !== 'jars') return { data: [], error: null };
      if (filters.lt !== undefined) mockBackend.olderReads += 1;
      const rows = [...mockBackend.jars]
        .filter((j) => filters.lt === undefined || j.local_date < filters.lt)
        .sort((a, b) => b.local_date.localeCompare(a.local_date))
        .slice(0, filters.limit);
      return { data: rows, error: null };
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      lt: (_column: string, value: string) => {
        filters.lt = value;
        return builder;
      },
      limit: (n: number) => {
        filters.limit = n;
        return builder;
      },
      single: async () => answer(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer()).then(resolve),
    };
    return builder;
  };
  const client = {
    from: query,
    functions: { invoke: async () => ({ data: { data: { moments: [] } }, error: null }) },
  };
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
jest.mock('expo-localization', () => ({
  ...jest.requireActual<object>('expo-localization'),
  getCalendars: () => [{ timeZone: 'Asia/Tokyo' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

const tokyoJar: Row = { id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Tokyo', ends_at: null };
const manilaJar: Row = { id: 'jar-09', local_date: '2026-11-09', tz: 'Asia/Manila', ends_at: null };

function newClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, staleTime: 30_000, networkMode: 'offlineFirst', retry: false } },
  });
}

async function renderScreen(client = newClient()) {
  return render(
    <QueryClientProvider client={client}>
      <TodayScreen />
    </QueryClientProvider>,
  );
}

/** Lets the jar query and the stored acknowledgements settle. */
async function settled() {
  await waitFor(() => expect(screen.getByText('0 of 8 moments')).toBeTruthy());
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-11-10T14:00:00+09:00'),
    doNotFake: ['setTimeout', 'nextTick', 'setImmediate'],
  });
  mockBackend.offline = false;
  mockBackend.jars = [];
  mockBackend.olderReads = 0;
  mockDisk.clear();
  reportNetworkResult(null);
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Today: Time zone banner (FR-JAR-05)', () => {
  it('first jar in a new zone: banner and zone tag; Got it hides it for good, the tag stays', async () => {
    mockBackend.jars = [tokyoJar, manilaJar];
    const first = await renderScreen();
    await waitFor(() => expect(screen.getByTestId('timezone-banner')).toBeTruthy());
    expect(screen.getByText('You’re in Tokyo time')).toBeTruthy();
    expect(screen.getByText('Your last jar was on Manila time. Today’s jar follows Tokyo time.')).toBeTruthy();
    expect(screen.getByText('Tue, Nov 10 · Tokyo time')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    expect(screen.getByText('Tue, Nov 10 · Tokyo time')).toBeTruthy();
    await waitFor(() => expect(mockDisk.get(`pickld-tz-banner-acks:${USER}`)).toBe('["jar-10"]'));
    await first.unmount();

    // Reopening the app: still acknowledged.
    await renderScreen();
    await settled();
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    expect(screen.getByText('Tue, Nov 10 · Tokyo time')).toBeTruthy();
  });

  it('same zone as the previous jar: no banner, the greeting instead of a tag', async () => {
    mockBackend.jars = [tokyoJar, { ...manilaJar, tz: 'Asia/Tokyo' }];
    await renderScreen();
    await settled();
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    expect(screen.getByText('Tue, Nov 10 · Good afternoon, Dale')).toBeTruthy();
  });

  it('first jar ever: no banner', async () => {
    mockBackend.jars = [tokyoJar];
    await renderScreen();
    await settled();
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
  });

  it('reads one more jar when the open jar is the oldest of the recent ones', async () => {
    // Future-dated rows can't exist; two "later" jars here just push the previous jar out of the first read.
    mockBackend.jars = [
      { ...tokyoJar, id: 'jar-12', local_date: '2026-11-12', ends_at: '2026-11-10T00:00:00Z' },
      { ...tokyoJar, id: 'jar-11', local_date: '2026-11-11', ends_at: '2026-11-10T00:00:00Z' },
      tokyoJar,
      manilaJar,
    ];
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('timezone-banner')).toBeTruthy());
    expect(mockBackend.olderReads).toBe(1);
  });

  it('offline with a cache that predates the previous zone: no banner', async () => {
    mockBackend.offline = true;
    const client = newClient();
    const cached: TodayJar = {
      hasAnyJar: true,
      jar: { id: 'jar-10', localDate: '2026-11-10', tz: 'Asia/Tokyo', endsAt: null },
      moments: [],
    };
    client.setQueryData(['jar', USER, '2026-11-10'], cached, { updatedAt: Date.now() - 60_000 });
    await renderScreen(client);
    await settled();
    expect(screen.queryByTestId('timezone-banner')).toBeNull();
    expect(screen.queryByText(/Tokyo time/)).toBeNull();
  });
});
