import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import type { QueueItem } from '@/lib/queue/store';

import PublishScreen from '../../../../app/publish';

// The real /publish route with useToday and the publish mutation; only the edges are fakes: Supabase,
// the SQLite queue, the router, analytics and the phone zone.

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';

type Row = Record<string, unknown>;
const mockBackend = {
  jars: [] as Row[],
  moments: [] as Row[],
  queue: [] as Partial<QueueItem>[],
  defaultVisibility: 'readers',
  updates: [] as { table: string; patch: Row; filters: Row }[],
  updateError: null as { code: string; message: string } | null,
};

jest.mock('@/lib/supabase', () => {
  const query = (table: string) => {
    let patch: Row | null = null;
    const filters: Row = {};
    const answer = () => {
      if (patch) {
        mockBackend.updates.push({ table, patch, filters: { ...filters } });
        return mockBackend.updateError
          ? { data: null, error: mockBackend.updateError }
          : { data: [{ published_at: '2026-11-10T06:00:00Z' }], error: null };
      }
      return {
        data:
          table === 'profiles'
            ? {
                display_name: 'Dale Cruz',
                avatar_path: null,
                reader_count: 312,
                lid_color: 'brand',
                default_visibility: mockBackend.defaultVisibility,
              }
            : table === 'jars'
              ? mockBackend.jars
              : mockBackend.moments,
        error: null,
      };
    };
    const builder = {
      select: () => builder,
      update: (next: Row) => {
        patch = next;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      lt: () => builder,
      single: async () => answer(),
      // Awaitable like supabase-js's query builder.
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
jest.mock('@/lib/queue/store', () => ({
  listQueue: async () => mockBackend.queue,
  subscribeQueue: () => () => {},
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(() => true) }));
jest.mock('expo-localization', () => ({
  ...jest.requireActual<object>('expo-localization'),
  getCalendars: () => [{ timeZone: 'Asia/Manila' }],
}));
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    useRouter: () => mockRouter,
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

const JAR = {
  id: 'jar-10',
  local_date: '2026-11-10',
  tz: 'Asia/Manila',
  ends_at: null,
  visibility: 'readers',
  published_at: null,
};

function moment(slot: string, over: Row = {}): Row {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    captured_at: '2026-11-10T00:30:00Z',
    added_at: '2026-11-10T00:31:00Z',
    edits: null,
    replaces: null,
    ...over,
  };
}

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <PublishScreen />
    </QueryClientProvider>,
  );
}

const radio = (name: RegExp) => screen.getByRole('radio', { name });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-10T14:00:00+08:00'), doNotFake: ['nextTick', 'setImmediate'] });
  mockBackend.jars = [JAR];
  mockBackend.moments = [];
  mockBackend.queue = [];
  mockBackend.defaultVisibility = 'readers';
  mockBackend.updates = [];
  mockBackend.updateError = null;
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('/publish: Publish review (FR-PUB-01, FR-PUB-03)', () => {
  it('starts on the profile’s default visibility and counts private and missing moments', async () => {
    mockBackend.defaultVisibility = 'everyone';
    mockBackend.moments = [
      moment('whereami'),
      moment('selfie', { visibility: 'only_me' }),
      moment('mebusywith', { status: 'checking' }),
      // Removed: its slot is free again (D-27), so it is missing, not private, even though it was private.
      moment('ootd', { status: 'removed', visibility: 'only_me' }),
    ];
    // A private photo still in the offline queue is one of the jar's moments too.
    mockBackend.queue = [
      {
        id: 7,
        slot: 'morning',
        state: 'queued',
        localDate: '2026-11-10',
        photoUri: 'file:///q/morning.webp',
        thumbUri: null,
        capturedAt: '2026-11-10T00:10:00Z',
        visibility: 'only_me',
      },
    ];
    await renderScreen();

    await waitFor(() => expect(radio(/^Everyone/).props.accessibilityState).toEqual({ checked: true }));
    expect(radio(/^Readers/).props.accessibilityState).toEqual({ checked: false });
    expect(radio(/^Only me/).props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByTestId('publish-subtitle')).toHaveTextContent('Tue, Nov 10 · 4 of 8 moments');
    expect(screen.getByTestId('publish-note')).toHaveTextContent(
      '2 private moments won’t be shared. You can still add the 4 missing ones later today.',
    );
    expect(screen.getByLabelText('#selfie, private')).toBeTruthy();
    expect(screen.getByLabelText('#morning, private')).toBeTruthy();
    expect(screen.getByLabelText('#ootd, empty')).toBeTruthy();
    // Each moment keeps its own visibility badge; publishing doesn't change it (D-48, D-50).
    expect(screen.getByLabelText('#whereami, readers')).toBeTruthy();
    // The badge is drawn only; the slot's label says it (rule 11).
    expect(screen.getByTestId('publish-slot-whereami-readers', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('publish-slot-selfie-lock', { includeHiddenElements: true })).toBeTruthy();
  });

  it('Readers unless changed, with the reader count; a full jar with nothing private has no note', async () => {
    const slots = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'];
    mockBackend.moments = slots.map((slot) => moment(slot));
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('publish-subtitle')).toHaveTextContent('Tue, Nov 10 · 8 of 8 moments'),
    );
    expect(radio(/^Readers, 312 people who read your days$/).props.accessibilityState).toEqual({ checked: true });
    expect(screen.queryByTestId('publish-note')).toBeNull();
  });

  it('publishes the jar with the chosen visibility, then goes back', async () => {
    mockBackend.moments = [moment('whereami')];
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('publish-subtitle')).toHaveTextContent('Tue, Nov 10 · 1 of 8 moments'),
    );

    await fireEvent.press(radio(/^Only me/));
    expect(radio(/^Only me/).props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Publish jar' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockBackend.updates).toEqual([
      { table: 'jars', patch: { visibility: 'only_me', published_at: expect.any(String) }, filters: { id: 'jar-10' } },
    ]);
    expect(track).toHaveBeenCalledWith('jar_published', { visibility: 'only_me' });
  });

  it('a failed publish stays on the screen with a message and can be tried again', async () => {
    mockBackend.moments = [moment('whereami')];
    mockBackend.updateError = { code: '', message: 'TypeError: Network request failed' };
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('publish-subtitle')).toHaveTextContent('Tue, Nov 10 · 1 of 8 moments'),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Publish jar' }));
    await waitFor(() =>
      expect(screen.getByTestId('publish-error')).toHaveTextContent(
        'Couldn’t publish. Check your connection and try again.',
      ),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();

    mockBackend.updateError = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Publish jar' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockBackend.updates).toHaveLength(2);
  });

  it('Not yet leaves without publishing', async () => {
    mockBackend.moments = [moment('whereami')];
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('publish-subtitle')).toHaveTextContent('Tue, Nov 10 · 1 of 8 moments'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Not yet' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockBackend.updates).toEqual([]);
  });

  it('before the day’s first moment there is no jar to publish: back to Today', async () => {
    mockBackend.jars = [];
    await renderScreen();
    await waitFor(() => expect(screen.getByText('redirect:/today')).toBeTruthy());
  });
});
