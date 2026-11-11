import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/authStore';
import { reportNetworkResult } from '@/lib/connectivity';
import { requestUploads } from '@/lib/queue/runner';
import { replaceItem, retryItem, type QueueItem } from '@/lib/queue/store';

import TodayScreen from '../../../../app/(tabs)/today';
import type { TodayJar } from '../useToday';

// The real Today route with its hooks (useToday, useRollover, useIsOffline); only the edges are fakes:
// Supabase, the SQLite queue, the router and the phone zone.

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';

type Row = Record<string, unknown>;
const mockBackend = { offline: false, jars: [] as Row[], moments: [] as Row[], queue: [] as Partial<QueueItem>[] };

jest.mock('@/lib/supabase', () => {
  const answer = (table: string) =>
    mockBackend.offline
      ? { data: null, error: { message: 'TypeError: Network request failed', code: '' } }
      : {
          data:
            table === 'profiles'
              ? { display_name: 'Dale Cruz', avatar_path: null, reader_count: 312, lid_color: 'brand' }
              : table === 'jars'
                ? mockBackend.jars
                : mockBackend.moments,
          error: null,
        };
  const query = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => answer(table),
      // Awaitable like supabase-js's query builder.
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer(table)).then(resolve),
    };
    return builder;
  };
  const client = {
    from: query,
    functions: { invoke: async () => ({ data: { data: { moments: [] } }, error: null }) },
  };
  return { getSupabase: () => client };
});
jest.mock('@/lib/queue/store', () => ({
  listQueue: async () => mockBackend.queue,
  subscribeQueue: () => () => {},
  retryItem: jest.fn(async () => ({})),
  replaceItem: jest.fn(async () => ({})),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => {}) }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
// The Replace prompt (kit Dialog, M2-22) reads Reduce Motion from Reanimated, which can't load in Jest.
jest.mock('react-native-reanimated', () => ({ __esModule: true, useReducedMotion: () => false }));
jest.mock('expo-localization', () => ({
  ...jest.requireActual<object>('expo-localization'),
  getCalendars: () => [{ timeZone: 'Asia/Manila' }],
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

const HOUR = 3_600_000;

function liveMoment(slot: string): Row {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    is_private: false,
    is_backfilled: false,
    captured_at: '2026-11-10T00:30:00Z',
    added_at: '2026-11-10T00:31:00Z',
  };
}

function queued(id: number, slot: QueueItem['slot'], state: QueueItem['state']): Partial<QueueItem> {
  return {
    id,
    slot,
    state,
    localDate: '2026-11-10',
    photoUri: `file:///q/${slot}.webp`,
    thumbUri: null,
    capturedAt: '2026-11-10T04:30:00Z',
    isPrivate: false,
  };
}

function newClient(): QueryClient {
  // The app's defaults (queryClient.ts), without retries so a failed fetch settles at once.
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, staleTime: 30_000, networkMode: 'offlineFirst', retry: false } },
  });
}

async function renderScreen(client: QueryClient) {
  await render(
    <QueryClientProvider client={client}>
      <TodayScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockBackend.offline = false;
  mockBackend.jars = [];
  mockBackend.moments = [];
  mockBackend.queue = [];
  reportNetworkResult(null);
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Today screen', () => {
  it('at 00:00 Manila switches to an empty jar for the new date, without a restart (FR-JAR-04)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T23:59:30+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.moments = [liveMoment('ootd'), liveMoment('selfie')];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('2 of 8 moments')).toBeTruthy());
    expect(screen.getByText('Tue, Nov 10 · Good evening, Dale')).toBeTruthy();

    await act(() => jest.advanceTimersByTime(30_000));
    // The server still has yesterday's jar; it is closed now, so Today is a new, empty day.
    await waitFor(() => expect(screen.getByText('0 of 8 moments')).toBeTruthy());
    expect(screen.getByText('Wed, Nov 11 · Good evening, Dale')).toBeTruthy();
    expect(screen.getByRole('button', { name: '#ootd, empty' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '#selfie, empty' })).toBeTruthy();
  });

  it('offline: renders the persisted jar, waiting and failed tiles, and the banner count (NFR-OFF-01, NFR-OFF-03)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.offline = true;
    mockBackend.queue = [queued(21, 'whereami', 'queued'), queued(22, 'morning', 'failed')];
    // What PersistQueryClientProvider restores from SQLite after a restart: last known data, stale.
    const client = newClient();
    const cached: TodayJar = {
      hasAnyJar: true,
      jar: { id: 'jar-10', localDate: '2026-11-10', tz: 'Asia/Manila', endsAt: null },
      moments: [{ ...(liveMoment('ootd') as Omit<TodayJar['moments'][number], 'thumbUrl'>), thumbUrl: null }],
    };
    const updatedAt = Date.now() - 2 * HOUR;
    client.setQueryData(['jar', USER, '2026-11-10'], cached, { updatedAt });
    client.setQueryData(
      ['me', USER],
      { displayName: 'Dale Cruz', avatarUrl: null, readerCount: 312, lidColor: 'brand' },
      { updatedAt },
    );
    await renderScreen(client);

    // The refetch failed with a network error: the banner counts the one waiting moment (failed needs Retry).
    await waitFor(() =>
      expect(screen.getByTestId('offline-banner')).toHaveTextContent(
        'You’re offline. 1 moment is saved on your phone and will upload when you’re back.',
      ),
    );
    expect(screen.getByText('3 of 8 moments')).toBeTruthy();
    expect(screen.getByText('in today’s jar · 312 readers')).toBeTruthy();
    expect(screen.getByRole('image', { name: /^#ootd, .*, added$/ })).toBeTruthy();
    expect(screen.getByText('Waiting for connection')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry #morning' }));
    await waitFor(() => expect(requestUploads).toHaveBeenCalledTimes(1));
    expect(retryItem).toHaveBeenCalledWith(22);
  });

  it('online: no banner even with moments in the queue', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.queue = [queued(21, 'whereami', 'uploading')];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('Uploading')).toBeTruthy());
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('a checking tile and a removed tile open /moment/<id>; the removed slot can be captured again (M2-21)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.moments = [
      { ...liveMoment('mebusywith'), id: 'm-checking', status: 'checking' },
      { ...liveMoment('ootd'), id: 'm-removed', status: 'removed' },
    ];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByRole('button', { name: '#ootd, removed, tap to see why' })).toBeTruthy());
    expect(screen.getByText('1 of 8 moments')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tile-mebusywith'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/moment/[id]', params: { id: 'm-checking' } });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/moment/[id]', params: { id: 'm-removed' } });
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('an upload that ended as a conflict asks to Replace; the old photo shows until the swap (M2-22)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.moments = [
      liveMoment('ootd'),
      { ...liveMoment('selfie'), id: 'm-new', status: 'checking', replaces: 'm-selfie' },
      liveMoment('selfie'),
    ];
    mockBackend.queue = [queued(31, 'ootd', 'conflict')];
    await renderScreen(newClient());

    await waitFor(() => expect(screen.getByRole('header', { name: 'Replace your #ootd photo?' })).toBeTruthy());
    // The old photos hold their slots: the conflict's local photo and the server's pending replacement don't show.
    expect(screen.getByRole('image', { name: /^#ootd, .*, added$/ })).toBeTruthy();
    expect(screen.getByRole('image', { name: /^#selfie, .*, added$/ })).toBeTruthy();
    expect(screen.getByText('2 of 8 moments')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(requestUploads).toHaveBeenCalledTimes(1));
    expect(replaceItem).toHaveBeenCalledWith(31);
    expect(screen.queryByRole('header', { name: 'Replace your #ootd photo?' })).toBeNull();
  });
});
