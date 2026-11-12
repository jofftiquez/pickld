import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/authStore';
import { photo } from '@/theme/tokens';

import MomentScreen from '../../../../app/moment/[id]';
import { RemovedView } from '../RemovedView';

// The real /moment/[id] route with useOwnMoment; only Supabase, the router and insets are fakes.

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';
const OTHER = '0b7e4c55-1d2a-4f3e-8c9b-7a6d5e4f3a21';
const CHECKING_ID = 'a1a1a1a1-0000-4000-8000-000000000001';
const REMOVED_ID = 'a1a1a1a1-0000-4000-8000-000000000002';
const LIVE_ID = 'a1a1a1a1-0000-4000-8000-000000000003';
const OTHERS_ID = 'a1a1a1a1-0000-4000-8000-000000000004';
const hidden = { includeHiddenElements: true } as const;

type Row = {
  id: string;
  user_id: string;
  jar_id: string;
  slot: string;
  status: string;
  jars: { local_date: string };
};
const JAR_ID = 'b1b1b1b1-0000-4000-8000-000000000001';
const mockBackend = {
  rows: [] as Row[],
  fail: false,
  queries: [] as Record<string, string>[],
  photoCalls: 0,
  /** What the jar page reads for a live moment (Moment detail, M3-08). */
  jarMoments: [] as Record<string, unknown>[],
};

jest.mock('@/lib/supabase', () => {
  const client = {
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return builder;
        },
        // The jar page's moment list and the viewer's likes (awaited without maybeSingle).
        in: () => builder,
        then: (resolve: (r: { data: unknown; error: null }) => void) =>
          resolve({ data: table === 'reactions' ? [] : mockBackend.jarMoments, error: null }),
        maybeSingle: async () => {
          if (table === 'jars') {
            return {
              data: {
                id: JAR_ID,
                user_id: USER,
                local_date: '2026-11-07',
                tz: 'Asia/Manila',
                moment_count: 2,
                visible_count: 2,
                like_count: 0,
                comment_count: 3,
              },
              error: null,
            };
          }
          if (table === 'profiles') return { data: { username: 'dale', display_name: 'Dale Santos' }, error: null };
          mockBackend.queries.push({ ...filters });
          if (mockBackend.fail) return { data: null, error: { message: 'TypeError: Network request failed' } };
          // Like RLS plus the query's filters: only rows matching every eq() come back.
          const row = mockBackend.rows.find((r) =>
            Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, string>)[k] === v),
          );
          return { data: row ?? null, error: null };
        },
      };
      return builder;
    },
    functions: {
      invoke: async (_name: string, { body }: { body: { momentIds: string[] } }) => {
        mockBackend.photoCalls += 1;
        return {
          data: {
            data: {
              moments: body.momentIds.map((id) => ({
                id,
                full: `https://photos.test/${id}.webp`,
                thumb: `https://photos.test/${id}-thumb.webp`,
              })),
            },
          },
          error: null,
        };
      },
    },
  };
  return { getSupabase: () => client };
});

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
// The Report sheet and Block (M3-21, M3-22) have their own tests; here they would pull in native modules.
jest.mock('@/features/safety/ReportSheet', () => ({ ReportSheet: () => null }));
jest.mock('@/features/safety/useBlockFlow', () => ({ useBlockFlow: () => ({ open: jest.fn(), dialog: null }) }));

function row(id: string, status: string, over: Partial<Row> = {}): Row {
  return { id, user_id: USER, jar_id: JAR_ID, slot: 'evening', status, jars: { local_date: '2026-11-07' }, ...over };
}

async function renderRoute(id: string | undefined) {
  mockParams = { id };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <MomentScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockBackend.rows = [
    row(CHECKING_ID, 'checking', { slot: 'ootd' }),
    row(REMOVED_ID, 'removed'),
    row(LIVE_ID, 'live', { slot: 'selfie' }),
    row(OTHERS_ID, 'checking', { user_id: OTHER }),
  ];
  mockBackend.fail = false;
  mockBackend.queries = [];
  mockBackend.photoCalls = 0;
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
});

afterEach(() => jest.clearAllMocks());

describe('/moment/[id]: Checking photo (FR-SAF-03, FR-PUB-07)', () => {
  it('shows the photo blurred, the checking status and the owner-only note', async () => {
    await renderRoute(CHECKING_ID);
    await waitFor(() => expect(screen.getByTestId('moment-checking')).toBeTruthy());
    const image = screen.getByRole('image', { name: '#ootd photo, blurred while it’s checked' });
    expect(image.props.blurRadius).toBe(photo.checkingBlur);
    expect(image.props.source).toEqual([{ uri: `https://photos.test/${CHECKING_ID}.webp` }]);
    expect(screen.getByText('Checking your photo…')).toBeTruthy();
    expect(screen.getByText('This usually takes a few seconds.')).toBeTruthy();
    expect(screen.getByTestId('moment-owner-note')).toHaveTextContent(
      'Only you can see it for nowEvery new photo gets a quick safety check before your readers see it.',
    );
    // Always asks for the signed-in user's own moment.
    expect(mockBackend.queries).toEqual([{ id: CHECKING_ID, user_id: USER }]);
  });

  it('Close and Back to today leave the screen', async () => {
    await renderRoute(CHECKING_ID);
    await waitFor(() => expect(screen.getByTestId('moment-checking')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
  });

  it('opened from a link with nothing to go back to, Close goes to Today', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await renderRoute(CHECKING_ID);
    await waitFor(() => expect(screen.getByTestId('moment-checking')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('an uploading moment is shown as checking, never as the plain photo', async () => {
    mockBackend.rows = [row(CHECKING_ID, 'uploading')];
    await renderRoute(CHECKING_ID);
    await waitFor(() => expect(screen.getByTestId('moment-checking')).toBeTruthy());
    expect(screen.queryByTestId('moment-live-photo', hidden)).toBeNull();
  });
});

describe('/moment/[id]: Moment removed (FR-PUB-07)', () => {
  it('shows the notice with the slot, the jar date, the reason and a blurred thumbnail', async () => {
    await renderRoute(REMOVED_ID);
    await waitFor(() => expect(screen.getByTestId('moment-removed')).toBeTruthy());
    expect(screen.getByText('Notice')).toBeTruthy();
    expect(screen.getByText('Moment removed')).toBeTruthy();
    expect(screen.getByText('#evening · Sat, Nov 7')).toBeTruthy();
    expect(screen.getByText('We removed one of your moments')).toBeTruthy();
    // No guideline is readable by the owner yet (TODO(M3-23)): the general reason.
    expect(screen.getByTestId('moment-removed-reason')).toHaveTextContent(
      'It didn’t follow our community guidelines. Your other moments and your account aren’t affected.',
    );
    const thumb = screen.getByRole('image', { name: '#evening photo, removed' });
    expect(thumb.props.blurRadius).toBe(photo.checkingBlur);
    expect(thumb.props.source).toEqual([{ uri: `https://photos.test/${REMOVED_ID}-thumb.webp` }]);
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
  });

  it('names the guideline when it is known', async () => {
    await render(
      <RemovedView
        slot="evening"
        localDate="2026-11-07"
        thumbUrl={null}
        guideline="violence"
        insets={{ top: 0, bottom: 0 }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByTestId('moment-removed-reason')).toHaveTextContent(
      'It didn’t follow our community guidelines on violence or dangerous acts. Your other moments and your account aren’t affected.',
    );
    expect(screen.getByText('violence or dangerous acts')).toBeTruthy();
  });
});

describe('/moment/[id]: not the owner, or not a moment', () => {
  it('another user’s moment is not found and no photo is requested or shown', async () => {
    await renderRoute(OTHERS_ID);
    await waitFor(() => expect(screen.getByTestId('moment-not-found')).toBeTruthy());
    expect(screen.getByText('This moment isn’t available')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
    expect(mockBackend.photoCalls).toBe(0);
  });

  it('an unknown id is not found', async () => {
    await renderRoute('a1a1a1a1-0000-4000-8000-0000000000ff');
    await waitFor(() => expect(screen.getByTestId('moment-not-found')).toBeTruthy());
    expect(screen.queryByRole('image')).toBeNull();
  });

  it.each([['not-a-uuid'], [undefined], ["' or 1=1 --"]])(
    'a bad id (%p) is not found without a request',
    async (id) => {
      await renderRoute(id);
      expect(screen.getByTestId('moment-not-found')).toBeTruthy();
      expect(mockBackend.queries).toEqual([]);
      await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    },
  );

  it('a failed request shows an error, not the photo', async () => {
    mockBackend.fail = true;
    await renderRoute(CHECKING_ID);
    await waitFor(() => expect(screen.getByTestId('moment-error')).toBeTruthy());
    expect(screen.getByText('Couldn’t load this moment')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('/moment/[id]: live', () => {
  it('opens Moment detail on the owner’s live moment, through its jar', async () => {
    const live = (id: string, slot: string, caption: string | null) => ({
      id,
      slot,
      status: 'live',
      is_private: false,
      is_backfilled: false,
      caption,
      captured_at: '2026-11-07T11:20:00Z',
      added_at: '2026-11-07T11:20:00Z',
      edits: {},
      like_count: 4,
    });
    mockBackend.jarMoments = [live(LIVE_ID, 'selfie', 'Same suit, new day'), live(CHECKING_ID, 'whereami', null)];
    await renderRoute(LIVE_ID);
    await waitFor(() => expect(screen.getByTestId('moment-sheet')).toBeTruthy());
    expect(screen.getByTestId('moment-caption')).toHaveTextContent('Same suit, new day');
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 2 of 2');
    expect(screen.queryByText('Checking your photo…')).toBeNull();
  });
});
