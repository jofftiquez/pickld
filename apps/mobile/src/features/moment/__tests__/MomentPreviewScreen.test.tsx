import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import type { DayJar } from '@/features/days/useDayJar';
import type { ServerMoment } from '@/features/jar/todayGrid';
import type { TodayJar } from '@/features/jar/useToday';

import MomentPreviewScreen from '../../../../app/moment/preview';
import type { MomentPreviewViewProps } from '../MomentPreviewView';

// The preview route's data choice: Today's open jar by default, a past day's jar with `&date=` (the day page,
// D-55). The view, the model and Moment options have their own tests; here they are stubs.
const mockView: { props: MomentPreviewViewProps | null } = { props: null };
jest.mock('../MomentPreviewView', () => ({
  MomentPreviewView: (props: MomentPreviewViewProps) => {
    mockView.props = props;
    return null;
  },
}));
jest.mock('../MomentOptions', () => ({ MomentOptions: () => null }));
jest.mock('@/components/Dialog', () => ({ Dialog: () => null }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/features/jar/useJarPage', () => ({
  jarPageQueryKeys: { jar: (userId: string, jarId: string) => ['jarPage', userId, jarId] },
  useJarPage: () => ({ data: undefined }),
}));

const moment = (id: string, slot: ServerMoment['slot']): ServerMoment => ({
  id,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-08T01:00:00Z',
  added_at: '2026-11-08T01:00:00Z',
  thumbUrl: null,
});

const mockToday: TodayJar = {
  hasAnyJar: true,
  jar: { id: 'jar-11', localDate: '2026-11-11', tz: 'Asia/Manila', endsAt: '2026-11-11T16:00:00Z' },
  moments: [moment('m-today', 'whereami')],
};
const mockDay: DayJar = {
  jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Tokyo' },
  moments: [moment('m-past-1', 'whereami'), moment('m-past-2', 'evening')],
};
jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (userId: string) => ['queue', userId] },
  useToday: () => ({ userId: 'u-1', localDate: '2026-11-11', jar: mockToday, me: undefined, queue: [] }),
}));
const mockDayJar = jest.fn((date: string | null) => ({ userId: 'u-1', day: date ? mockDay : undefined, queue: [] }));
jest.mock('@/features/days/useDayJar', () => ({ useDayJar: (date: string | null) => mockDayJar(date) }));

let mockParams: { slot?: string; date?: string } = {};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <MomentPreviewScreen />
    </QueryClientProvider>,
  );
  const props = mockView.props;
  if (!props) throw new Error('MomentPreviewView was not rendered');
  return props;
}

beforeEach(() => {
  // 12:00 on 2026-11-11 in Manila.
  jest.useFakeTimers({ now: new Date('2026-11-11T04:00:00Z'), advanceTimers: true });
  mockView.props = null;
  mockDayJar.mockClear();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('/moment/preview', () => {
  it('without a date previews Today’s open jar', async () => {
    mockParams = { slot: 'whereami' };
    const props = await renderScreen();
    expect(mockDayJar).toHaveBeenCalledWith(null);
    expect(props.items?.map((item) => item.key)).toEqual(['m-today']);
    expect(props.tz).toBe('Asia/Manila');
    props.onClose();
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('with a past date previews that day’s jar, in its zone, and closes to the day page', async () => {
    mockParams = { slot: 'evening', date: '2026-11-08' };
    const props = await renderScreen();
    expect(mockDayJar).toHaveBeenCalledWith('2026-11-08');
    expect(props.items?.map((item) => item.key)).toEqual(['m-past-1', 'm-past-2']);
    expect(props.items?.[1]?.target).toEqual({ kind: 'server', momentId: 'm-past-2', jarId: 'jar-8' });
    expect(props.startSlot).toBe('evening');
    expect(props.tz).toBe('Asia/Tokyo');
    props.onClose();
    expect(mockRouter.replace).toHaveBeenCalledWith('/day/2026-11-08');
  });

  it('ignores today’s or a malformed date and previews Today', async () => {
    for (const date of ['2026-11-11', 'tomorrow']) {
      mockParams = { slot: 'whereami', date };
      const props = await renderScreen();
      expect(props.items?.map((item) => item.key)).toEqual(['m-today']);
    }
  });
});
