import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import MyDaysScreen from '../../../../app/my-days';
import { useAuthStore } from '@/lib/authStore';
import type { QueueChange } from '@/lib/queue/store';

import type { MonthJarRow } from '../monthGrid';

// D-148: a day filled in the past shows on the My days calendar at once, with the real data hooks. Only the
// server (Supabase) and the offline queue (SQLite) are faked.
jest.mock('@/components/JarGraphic', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    JarGraphic: ({ testID }: { testID?: string }) => createElement(View, { testID }),
    MAX_LAYERS: 8,
    VIEW_W: 48,
    VIEW_H: 60,
  };
});
jest.mock('react-native-reanimated/mock', () => ({
  __esModule: true,
  default: {},
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  ...jest.requireActual('@gorhom/bottom-sheet/mock'),
  __esModule: true,
  default: () => null,
}));
jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (userId: string) => ['queue', userId] },
  useToday: () => ({ jar: undefined }),
}));

let mockServerJars: MonthJarRow[] = [];
const mockMonthJars = jest.fn(async () => ({ data: mockServerJars, error: null }));
jest.mock('@/lib/supabase', () => {
  const firstJar = {
    select: () => firstJar,
    eq: () => firstJar,
    order: () => firstJar,
    limit: () => firstJar,
    maybeSingle: async () => ({ data: { local_date: '2026-10-02' }, error: null }),
  };
  const client = {
    rpc: (name: string) =>
      name === 'month_jars'
        ? mockMonthJars()
        : { select: () => ({ maybeSingle: async () => ({ data: { birthday: '1990-05-20' }, error: null }) }) },
    from: () => firstJar,
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
  return { getSupabase: () => client };
});

type QueuedRow = { id: number; slot: string; state: string; localDate: string; photoUri: string; thumbUri: string };
let mockQueue: QueuedRow[] = [];
const mockListQueue = jest.fn(async () => mockQueue);
const mockQueueListeners = new Set<(change: QueueChange) => void>();
jest.mock('@/lib/queue/store', () => ({
  listQueue: () => mockListQueue(),
  subscribeQueue: (listener: (change: QueueChange) => void) => {
    mockQueueListeners.add(listener);
    return () => mockQueueListeners.delete(listener);
  },
}));
const emit = (change: QueueChange) => act(async () => mockQueueListeners.forEach((listener) => listener(change)));

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  'my-days': MyDaysScreen,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // 12:00 on 2026-11-11 in Manila.
  jest.useFakeTimers({ now: new Date('2026-11-11T04:00:00Z'), advanceTimers: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ session: { user: { id: 'u-1' } } as Session });
});
afterEach(() => {
  jest.useRealTimers();
  useAuthStore.setState({ session: null });
});

it('a moment added to a past day fills it on the open calendar, queued and after its upload', async () => {
  await renderRouter(routes, { initialUrl: '/my-days', wrapper });
  const tenth = () => screen.getByTestId('day-2026-11-10');
  await waitFor(() => expect(mockMonthJars).toHaveBeenCalled());
  expect(within(tenth()).queryByTestId('day-jar')).toBeNull();

  // Fill this jar for November 10: the photo is in the queue, the server hasn't seen it yet.
  mockQueue = [
    {
      id: 1,
      slot: 'evening',
      state: 'queued',
      localDate: '2026-11-10',
      photoUri: 'file:///p.jpg',
      thumbUri: 'file:///t.jpg',
    },
  ];
  await emit('added');
  await waitFor(() => expect(within(tenth()).getByTestId('day-jar')).toBeTruthy());

  // The upload finishes: ensure_jar made the jar, the row leaves the queue.
  mockServerJars = [
    {
      jar_id: 'jar-10',
      local_date: '2026-11-10',
      tz: 'Asia/Manila',
      moment_count: 1,
      is_full: false,
    },
  ];
  mockQueue = [];
  await emit('removed');
  // The queue no longer holds the photo; the day stays filled from the server.
  await waitFor(() => expect(client.getQueryData(['queue', 'u-1'])).toEqual([]));
  await act(() => jest.runOnlyPendingTimersAsync()); // let the screen render that empty queue
  await waitFor(() => expect(within(tenth()).getByTestId('day-jar')).toBeTruthy());
  expect(tenth()).toHaveProp('accessibilityLabel', expect.stringMatching(/1 of 8/));
});
