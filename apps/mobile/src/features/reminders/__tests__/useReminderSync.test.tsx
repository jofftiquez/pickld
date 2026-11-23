import { QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createQueryClient, persistOptions } from '@/lib/queryClient';

import { REMINDER_ID_PREFIX, type PlannedReminder } from '../reminderPlan';
import { useReminderSync } from '../useReminderSync';

// Take a break (0180) after a restart: the query cache comes back from disk (NFR-OFF-03), so the break's end is
// whatever survived JSON. Only the edges are fakes: Supabase, the disk, the notifications API and the phone zone.

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';
// 10:00 in Manila on Thu 2026-11-12; the break ends at Manila midnight on Sat 2026-11-14.
const NOW = new Date('2026-11-12T02:00:00Z');
const BREAK_UNTIL = '2026-11-13T16:00:00+00:00';

const mockBackend = { offline: false };
const mockDisk = new Map<string, string>();
const mockSync = jest.fn<Promise<void>, [PlannedReminder[], ...unknown[]]>(async () => {});

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
    removeItem: async (k: string) => void mockDisk.delete(k),
  },
}));
jest.mock('@/lib/supabase', () => {
  const answer = (table: string) =>
    mockBackend.offline
      ? { data: null, error: { message: 'TypeError: Network request failed' } }
      : { data: table === 'notification_prefs' ? { break_until: BREAK_UNTIL } : [], error: null };
  const query = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => answer(table),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer(table)).then(resolve),
    };
    return builder;
  };
  return { getSupabase: () => ({ from: query }) };
});
jest.mock('../pushToken', () => ({
  notificationsAllowed: async () => true,
  registerPushToken: async () => 'skipped',
}));
jest.mock('../syncReminders', () => ({
  expoReminderApi: {},
  syncReminders: (...args: [PlannedReminder[], ...unknown[]]) => mockSync(...args),
}));
jest.mock('@/features/jar/useToday', () => ({ phoneTimeZone: () => 'Asia/Manila' }));

const clients: ReturnType<typeof createQueryClient>[] = [];
function newClient() {
  const client = createQueryClient();
  clients.push(client);
  return client;
}
function renderSync(client: ReturnType<typeof createQueryClient>) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useReminderSync(USER, []), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
  jest.useRealTimers();
});

it('keeps planning around a break that was restored from disk after a restart, offline', async () => {
  // First run: the break is read from the server, and the cache is saved to disk.
  const before = newClient();
  const first = await renderSync(before);
  await waitFor(() => expect(mockSync).toHaveBeenCalled());
  await persistQueryClientSave({ queryClient: before, ...persistOptions });
  await first.unmount();
  mockSync.mockClear();

  // Restart with no network: the plan comes from the restored cache, and nothing before the break is planned.
  mockBackend.offline = true;
  const restored = newClient();
  await persistQueryClientRestore({ queryClient: restored, ...persistOptions });
  await renderSync(restored);

  await waitFor(() => expect(mockSync).toHaveBeenCalled());
  const plan = mockSync.mock.calls[0]?.[0] ?? [];
  expect(plan.length).toBeGreaterThan(0);
  expect(plan[0]?.id.slice(REMINDER_ID_PREFIX.length)).toBe('2026-11-14:morning');
});
