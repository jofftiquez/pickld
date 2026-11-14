import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import MyDaysScreen from '../../../../app/my-days';
import type { ServerMoment } from '@/features/jar/todayGrid';

import type { DayJar } from '../useDayJar';

// My days wiring for M2-26: selecting a day shows its card, and Fill this jar opens that day's page (D-55).
// Data hooks are mocked; the card and the day page have their own tests.
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
// The month picker's kit sheet reads Reduce Motion from Reanimated. expo-router's testing library mocks
// Reanimated with `react-native-reanimated/mock`, which can't load here; give it what the sheet needs.
jest.mock('react-native-reanimated/mock', () => ({
  __esModule: true,
  default: {},
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
// gorhom's native sheet and the gesture root are plain pass-throughs here.
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, { onClose: () => void; children: ReactNode }>(
    function Sheet(props, ref) {
      useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
      return <>{props.children}</>;
    },
  );
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetScrollView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});
jest.mock('@/features/jar/useToday', () => ({ phoneTimeZone: () => 'Asia/Manila' }));
jest.mock('../useMonthJars', () => ({
  useMonthJars: () => ({ userId: 'u-1', jars: [], firstJarMonth: '2026-11', birthday: '2023-05-20' }),
}));

const mockDays: Record<string, DayJar> = {};
jest.mock('../useDayJar', () => ({
  useDayJar: (date: string | null) => ({ userId: 'u-1', day: date ? mockDays[date] : undefined, queue: [] }),
}));

const moment = (slot: ServerMoment['slot'], extra: Partial<ServerMoment> = {}): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: null,
  added_at: '2026-11-08T01:00:00Z',
  thumbUrl: null,
  ...extra,
});

mockDays['2026-11-08'] = {
  jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Manila' },
  moments: [moment('whereami'), moment('mebusywith'), moment('evening', { is_backfilled: true })],
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function DayStub() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back from day" onPress={() => router.back()}>
      <Text>{`day ${date ?? 'none'}`}</Text>
    </Pressable>
  );
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => <Text>Today stub</Text>,
  'my-days': MyDaysScreen,
  'day/[date]': DayStub,
};

beforeEach(() => {
  // 12:00 on 2026-11-11 in Manila.
  jest.useFakeTimers({ now: new Date('2026-11-11T04:00:00Z'), advanceTimers: true });
});
afterEach(() => jest.useRealTimers());

describe('My days selected day', () => {
  it('shows no card until a day is selected', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    expect(screen.queryByTestId('selected-day-card')).toBeNull();
  });

  it('Fill this jar on a past day opens that day’s page, then comes back', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByTestId('day-2026-11-08'));
    expect(screen.getByRole('header', { name: /Nov 8/ })).toBeTruthy();
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('3 of 8 moments · 1 added later');

    await fireEvent.press(screen.getByRole('button', { name: 'Fill this jar' }));
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(screen.getByText('day 2026-11-08')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Back from day' }));
    await act(async () => {});
    expect(screen).toHavePathname('/my-days');
    expect(screen.getByTestId('selected-day-card')).toBeTruthy();
  });

  it('a past day without a jar can be filled from its page', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByTestId('day-2026-11-03'));
    await fireEvent.press(screen.getByRole('button', { name: 'Fill this jar' }));
    expect(screen.getByText('day 2026-11-03')).toBeTruthy();
  });

  it('today shows its card without Fill this jar', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByTestId('day-2026-11-11'));
    expect(screen.getByTestId('selected-day-card')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fill this jar' })).toBeNull();
  });
});

// My days is a stack screen opened from Today's calendar button, not a tab (D-52).
describe('My days back button', () => {
  it('goes back to where it was opened from', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await act(async () => {
      const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
      router.push('/my-days');
    });
    expect(screen).toHavePathname('/my-days');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen).toHavePathname('/today');
  });

  it('opened on its own (no history), lands on Today', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen).toHavePathname('/today');
    expect(screen.getByText('Today stub')).toBeTruthy();
  });
});

// FR-DAY-01: the month pill jumps straight to a month; it reaches back to the birth year (D-141).
describe('My days month picker', () => {
  it('jumps to the chosen month, as far back as Previous reaches', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'November 2026, 0 moments' }));
    // Birthday in 2023: January 2023 to November 2026.
    expect(screen.queryByRole('radio', { name: '2022' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: '2023' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'January 2023' }));
    expect(screen.getByText('January 2023')).toBeTruthy();
    expect(screen.getByTestId('day-2023-01-15')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous month' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});

// FR-DAY-02, D-141: Go to a date opens any past day's page, the one Fill this jar opens.
describe('My days date picker', () => {
  it('opens a day years back, and the calendar is on it when coming back', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to a date' }));
    await fireEvent.press(screen.getByRole('radio', { name: '2023' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'June 2023' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Thursday, June 1, 2023' }));
    expect(screen).toHavePathname('/day/2023-06-01');
    expect(screen.getByText('day 2023-06-01')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Back from day' }));
    await act(async () => {});
    expect(screen).toHavePathname('/my-days');
    expect(screen.getByText('June 2023')).toBeTruthy();
    expect(screen.getByTestId('selected-day-card')).toBeTruthy();
  });

  it('today goes to the Today tab', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Go to a date' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wednesday, November 11, 2026, today' }));
    expect(screen).toHavePathname('/today');
  });
});
