import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import MyDaysScreen from '../../../../app/my-days';
import type { ServerMoment } from '@/features/jar/todayGrid';

import type { DayJar } from '../useDayJar';

// My days wiring for M2-26: selecting a day shows its card, and Fill this jar opens the camera on that date
// and its first missing slot. Data hooks are mocked; the card and the camera have their own tests.
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
jest.mock('@/features/jar/useToday', () => ({ phoneTimeZone: () => 'Asia/Manila' }));
jest.mock('../useMonthJars', () => ({
  useMonthJars: () => ({ userId: 'u-1', jars: [], firstJarMonth: '2026-11' }),
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

function CameraStub() {
  const router = useRouter();
  const { date, slot } = useLocalSearchParams<{ date?: string; slot?: string }>();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={() => router.back()}>
      <Text>{`camera ${date ?? 'none'} ${slot ?? 'none'}`}</Text>
    </Pressable>
  );
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => <Text>Today stub</Text>,
  'my-days': MyDaysScreen,
  camera: CameraStub,
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

  it('Fill this jar on a past day opens the camera on that date and its first missing slot, then comes back', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByTestId('day-2026-11-08'));
    expect(screen.getByRole('header', { name: /Nov 8/ })).toBeTruthy();
    expect(screen.getByTestId('selected-day-count')).toHaveTextContent('3 of 8 moments · 1 added later');

    await fireEvent.press(screen.getByRole('button', { name: 'Fill this jar' }));
    expect(screen).toHavePathname('/camera');
    expect(screen.getByText('camera 2026-11-08 whoamiwith')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close camera' }));
    await act(async () => {});
    expect(screen).toHavePathname('/my-days');
    expect(screen.getByTestId('selected-day-card')).toBeTruthy();
  });

  it('a past day without a jar can be filled from its first slot', async () => {
    await renderRouter(routes, { initialUrl: '/my-days', wrapper });
    await fireEvent.press(screen.getByTestId('day-2026-11-03'));
    await fireEvent.press(screen.getByRole('button', { name: 'Fill this jar' }));
    expect(screen.getByText('camera 2026-11-03 whereami')).toBeTruthy();
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
