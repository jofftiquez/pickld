import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import DayScreen from '../../../../app/day/[date]';
import type { ServerMoment } from '@/features/jar/todayGrid';
import { markJarPublished } from '@/features/publish/publishCelebration';

import type { DayJar } from '../useDayJar';

// The day page (D-55, FR-DAY-02): only past dates have one; it is Today's grid and jar card for that date.
// Empty tiles open the camera in Fill mode, filled ones the moment preview for that day, and Publish that
// day's review. Data hooks are mocked; TodayView, the camera, the preview and Publish have their own tests.
// The tiles' pop and the publish burst (D-58) use Reanimated, which the router test harness can't load; they
// have their own tests.
jest.mock('@/features/jar/TilePop', () => ({ TilePop: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/jar/PublishBurst', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PublishBurst: () => createElement(View, { testID: 'publish-burst' }) };
});
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
jest.mock('@/features/jar/JarTapReaction', () => ({ JarTapReaction: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
jest.mock('@/features/jar/retryUpload', () => ({ retryUpload: jest.fn() }));
jest.mock('@/lib/connectivity', () => ({ useIsOffline: () => false }));
jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (userId: string) => ['queue', userId] },
  useToday: () => ({ me: { readerCount: 12, lidColor: 'brand' } }),
}));

const mockDays: Record<string, DayJar> = {};
const mockDayJar = jest.fn((date: string | null) => ({
  userId: 'u-1',
  day: date ? mockDays[date] : undefined,
  queue: [],
}));
jest.mock('../useDayJar', () => ({ useDayJar: (date: string | null) => mockDayJar(date) }));

const moment = (slot: ServerMoment['slot'], extra: Partial<ServerMoment> = {}): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-08T01:00:00Z',
  added_at: '2026-11-08T01:00:00Z',
  thumbUrl: null,
  ...extra,
});

// Nov 8: an unpublished jar with two moments, one added later. Nov 7: published. Nov 3: no jar.
mockDays['2026-11-08'] = {
  jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Manila', publishedAt: null, visibility: 'readers' },
  moments: [moment('whereami'), moment('evening', { is_backfilled: true, added_at: '2026-11-10T01:00:00Z' })],
};
mockDays['2026-11-07'] = {
  jar: {
    id: 'jar-7',
    localDate: '2026-11-07',
    tz: 'Asia/Manila',
    publishedAt: '2026-11-07T14:10:00Z',
    visibility: 'everyone',
    likeCount: 3,
  },
  moments: [moment('whereami')],
};
mockDays['2026-11-03'] = { jar: null, moments: [] };

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

/** A stub screen that prints its path params and goes back. */
function stub(name: string) {
  return function Stub() {
    const router = useRouter();
    const params = useLocalSearchParams<{ date?: string; slot?: string }>();
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${name}`} onPress={() => router.back()}>
        <Text>{`${name} ${params.date ?? 'none'} ${params.slot ?? 'none'}`}</Text>
      </Pressable>
    );
  };
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => <Text>Today stub</Text>,
  'my-days': () => <Text>My days stub</Text>,
  'day/[date]': DayScreen,
  camera: stub('camera'),
  publish: stub('publish'),
  'moment/preview': stub('preview'),
};

beforeEach(() => {
  // 12:00 on 2026-11-11 in Manila.
  jest.useFakeTimers({ now: new Date('2026-11-11T04:00:00Z'), advanceTimers: true });
  mockDayJar.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('Day page route', () => {
  it.each([
    ['today', '2026-11-11'],
    ['a future date', '2026-11-12'],
    ['a malformed date', 'nov-8'],
    ['an impossible date', '2026-02-30'],
  ])('%s goes to the Today tab', async (_case, date) => {
    await renderRouter(routes, { initialUrl: `/day/${date}`, wrapper });
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(screen.getByText('Today stub')).toBeTruthy();
  });

  it('a past day shows its date, Back and that day’s jar, with no Now tile', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(mockDayJar).toHaveBeenCalledWith('2026-11-08');
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Sunday');
    expect(screen.getByTestId('day-subtitle')).toHaveTextContent('Nov 8, 2026');
    expect(screen.queryByTestId('today-my-days')).toBeNull();
    expect(screen.getByText('2 of 8 moments')).toBeTruthy();
    expect(screen.getByText('in this jar · 12 readers')).toBeTruthy();
    expect(screen.queryByText(/Now/)).toBeNull();
    expect(screen.getByTestId('day-added-later-note')).toBeTruthy();
  });

  it('an empty tile opens the camera in Fill mode for that date and slot, and comes back to the day', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera 2026-11-08 ootd')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close camera' }));
    await act(async () => {});
    expect(screen).toHavePathname('/day/2026-11-08');
  });

  it('a filled tile opens the moment preview for that day', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-evening'));
    expect(screen).toHavePathname('/moment/preview');
    expect(screen.getByText('preview 2026-11-08 evening')).toBeTruthy();
  });

  it('offers Publish for an unpublished jar and opens that day’s review', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    const publish = screen.getByTestId('today-publish');
    expect(publish.props.accessibilityHint).toBe('Review this day’s jar and choose who can see it');
    await fireEvent.press(publish);
    expect(screen).toHavePathname('/publish');
    expect(screen.getByText('publish 2026-11-08 none')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close publish' }));
    await act(async () => {});
    expect(screen).toHavePathname('/day/2026-11-08');
  });

  it('a published jar shows Published instead of Publish', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-07', wrapper });
    expect(screen.queryByTestId('today-publish')).toBeNull();
    expect(screen.getByTestId('today-published')).toBeTruthy();
  });

  it('a day without a jar has nothing to publish yet', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-03', wrapper });
    expect(screen.getByTestId('today-publish').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('tile-whereami'));
    expect(screen.getByText('camera 2026-11-03 whereami')).toBeTruthy();
  });

  it('Back with no history lands on My days', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen).toHavePathname('/my-days');
  });

  it('publishing that day’s jar comes back to a celebration on the day page, once (D-58)', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(screen.queryByTestId('publish-burst')).toBeNull();
    await fireEvent.press(screen.getByTestId('today-publish'));
    expect(screen).toHavePathname('/publish');
    await act(async () => markJarPublished('jar-8'));
    await fireEvent.press(screen.getByRole('button', { name: 'Close publish' }));
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(screen.getByTestId('publish-burst')).toBeTruthy();
  });
});
