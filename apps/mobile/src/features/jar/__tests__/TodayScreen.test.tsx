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
const mockBackend = {
  offline: false,
  /** profiles.status and, through my_profile(), suspended_until (FR-SAF-06). */
  profileStatus: 'active',
  suspendedUntil: null as string | null,
  jars: [] as Row[],
  moments: [] as Row[],
  queue: [] as Partial<QueueItem>[],
  updates: [] as { table: string; values: Row; eq: [string, unknown][] }[],
};
// The jar's visibility menu is a bottom sheet (own tests); here only the props Today gives it matter.
const mockSheet: { props: import('@/features/publish/JarVisibilitySheet').JarVisibilitySheetProps | null } = {
  props: null,
};

// Moment options' bottom sheet needs the full Reanimated and gesture-handler mocks; it has its own tests.
jest.mock('@/features/moment/MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/features/onboarding/FirstMomentTip', () => ({ FirstMomentTip: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({
  JarVisibilitySheet: (props: NonNullable<typeof mockSheet.props>) => {
    mockSheet.props = props;
    return null;
  },
}));
jest.mock('@/lib/supabase', () => {
  const answer = (table: string) =>
    mockBackend.offline
      ? { data: null, error: { message: 'TypeError: Network request failed', code: '' } }
      : {
          data:
            table === 'profiles'
              ? {
                  display_name: 'Dale Cruz',
                  avatar_path: null,
                  reader_count: 312,
                  lid_color: 'brand',
                  status: mockBackend.profileStatus,
                }
              : table === 'jars'
                ? mockBackend.jars
                : mockBackend.moments,
          error: null,
        };
  const query = (table: string) => {
    let update: (typeof mockBackend.updates)[number] | null = null;
    const builder = {
      select: () => builder,
      update: (values: Row) => {
        update = { table, values, eq: [] };
        mockBackend.updates.push(update);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        update?.eq.push([column, value]);
        return builder;
      },
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
    rpc: (name: string) => {
      if (name !== 'my_profile') throw new Error(`unexpected rpc ${name}`);
      const builder = {
        select: () => builder,
        maybeSingle: async () => ({ data: { suspended_until: mockBackend.suspendedUntil }, error: null }),
      };
      return builder;
    },
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
  mockBackend.profileStatus = 'active';
  mockBackend.suspendedUntil = null;
  mockBackend.jars = [];
  mockBackend.moments = [];
  mockBackend.queue = [];
  mockBackend.updates = [];
  mockSheet.props = null;
  reportNetworkResult(null);
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Today screen', () => {
  it('Publish opens Publish review while the jar is unpublished (M3-01)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [
      {
        id: 'jar-10',
        local_date: '2026-11-10',
        tz: 'Asia/Manila',
        ends_at: null,
        visibility: 'readers',
        published_at: null,
      },
    ];
    mockBackend.moments = [liveMoment('ootd')];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('1 of 8 moments')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Publish' }));
    expect(mockPush).toHaveBeenCalledWith('/publish');
  });

  it('a published jar: the Published line, likes and chip; the chip changes who can see it (M3-02)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.moments = [liveMoment('ootd')];
    mockBackend.jars = [
      {
        id: 'jar-10',
        local_date: '2026-11-10',
        tz: 'Asia/Manila',
        ends_at: null,
        visibility: 'readers',
        published_at: '2026-11-10T05:30:00Z',
        like_count: 21,
      },
    ];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('1 of 8 moments')).toBeTruthy());
    // 05:30 UTC is 1:30 PM in Manila, the phone's zone.
    expect(screen.getByText('Published 1:30 PM · Readers')).toBeTruthy();
    expect(screen.getByText('Shared with readers · 21 likes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(mockSheet.props?.visible).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Published, Shared with readers' }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSheet.props).toEqual(
      expect.objectContaining({ visible: true, visibility: 'readers', readerCount: 312 }),
    );

    await act(async () => mockSheet.props?.onChange('everyone'));
    expect(mockBackend.updates).toEqual([
      { table: 'jars', values: expect.objectContaining({ visibility: 'everyone' }), eq: [['id', 'jar-10']] },
    ]);
    await waitFor(() => expect(mockSheet.props?.visible).toBe(false));
  });

  it('no jar yet: Publish is off', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [
      { id: 'jar-09', local_date: '2026-11-09', tz: 'Asia/Manila', ends_at: null, published_at: null },
    ];
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('0 of 8 moments')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Publish' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

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
    expect(screen.getByRole('button', { name: /^#ootd, .*, added$/ })).toBeTruthy();
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

  it('a suspended account sees the notice with the end date, and its own jar (FR-SAF-06)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.moments = [liveMoment('whereami')];
    mockBackend.profileStatus = 'suspended';
    // 16:30 UTC is already Nov 17 in Manila, the phone's zone.
    mockBackend.suspendedUntil = '2026-11-16T16:30:00Z';
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByTestId('suspension-banner')).toBeTruthy());
    expect(screen.getByText('Your account is suspended until Tue, Nov 17.')).toBeTruthy();
    expect(screen.getByLabelText(/You can still look at your own days\.$/)).toBeTruthy();
  });

  it('a suspension with no end date says so', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.profileStatus = 'suspended';
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText('Your account is suspended.')).toBeTruthy());
  });

  it('an active account sees no suspension notice', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00') });
    mockBackend.jars = [{ id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila', ends_at: null }];
    mockBackend.suspendedUntil = '2026-11-16T16:30:00Z';
    await renderScreen(newClient());
    await waitFor(() => expect(screen.getByText(/Dale/)).toBeTruthy());
    expect(screen.queryByTestId('suspension-banner')).toBeNull();
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
    expect(screen.getByRole('button', { name: /^#ootd, .*, added$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^#selfie, .*, added$/ })).toBeTruthy();
    expect(screen.getByText('2 of 8 moments')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(requestUploads).toHaveBeenCalledTimes(1));
    expect(replaceItem).toHaveBeenCalledWith(31);
    expect(screen.queryByRole('header', { name: 'Replace your #ootd photo?' })).toBeNull();
  });
});
