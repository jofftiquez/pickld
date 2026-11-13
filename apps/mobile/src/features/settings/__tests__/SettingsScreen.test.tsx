import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

import { reminderQueryKeys } from '@/features/reminders/useReminderSync';
import { useAuthStore } from '@/lib/authStore';

import { SettingsScreen } from '../SettingsScreen';
import type { SettingsViewProps } from '../SettingsView';

// The view is checked on the simulator; here its props drive what the screen saves.
const mockView: { props: SettingsViewProps | null } = { props: null };
jest.mock('../SettingsView', () => ({
  SettingsView: (props: SettingsViewProps) => {
    mockView.props = props;
    return null;
  },
}));
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    canDismiss: () => true,
    dismissAll: mockDismissAll,
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => false,
    back: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.0.0' } }));
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));
jest.mock('@/features/safety/block', () => ({ useBlockedAccounts: () => ({ rows: [] }) }));
jest.mock('@/features/profile/useProfile', () => ({
  profileImages: async () => ({ avatar: null, cover: null }),
}));
const mockCancelAll = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/features/reminders/syncReminders', () => ({
  cancelAllReminders: (...a: unknown[]) => mockCancelAll(...a),
  expoReminderApi: {},
}));
const mockRemoveToken = jest.fn(async () => undefined);
jest.mock('@/features/reminders/pushToken', () => ({ removePushToken: () => mockRemoveToken() }));

// A tiny stand-in for the tables Settings reads and writes.
const mockDb = {
  reminders: [{ slot: 'evening', local_time: '19:30:00', enabled: true }],
  writes: [] as [string, string, unknown][],
  failWrites: false,
};
const mockSignOut = jest.fn(async (..._a: unknown[]) => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { signOut: (...a: unknown[]) => mockSignOut(...a) },
    from: (table: string) => {
      const write = (op: string) => async (row: unknown) => {
        mockDb.writes.push([table, op, row]);
        return { error: mockDb.failWrites ? { message: 'offline' } : null };
      };
      const rows =
        table === 'reminder_settings'
          ? mockDb.reminders
          : table === 'profiles'
            ? { username: 'dale', display_name: 'Dale', default_visibility: 'readers' }
            : {
                new_reader: true,
                like: true,
                comment: true,
                reply: true,
                full_jar: true,
                friend_joined: true,
                quiet_hours: true,
                quiet_start: '22:00:00',
                quiet_end: '07:00:00',
              };
      const select = () => {
        const q = {
          eq: () => q,
          single: async () => ({ data: rows, error: null }),
          then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
        };
        return q;
      };
      return {
        select,
        upsert: write('upsert'),
        update: (row: unknown) => ({ eq: () => write('update')(row) }),
      };
    },
  }),
}));

const props = () => mockView.props!;

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(props().reminders).toBeDefined());
  await waitFor(() => expect(props().prefs).toBeDefined());
  return { client, invalidate };
}

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.writes = [];
    mockDb.failWrites = false;
    useAuthStore.getState().setSession({ user: { id: 'u-1', email: 'dale@pickld.test' } } as Session);
  });

  it('Mirror selfies is on by default and saved on this phone only, not through the server (D-66)', async () => {
    mockDisk.clear();
    await renderScreen();
    expect(props().mirrorSelfies).toBe(true);
    await act(async () => props().onMirrorSelfies(false));
    expect(props().mirrorSelfies).toBe(false);
    await waitFor(() => expect(mockDisk.get('camera:mirrorSelfies')).toBe('off'));
    expect(mockDb.writes).toEqual([]);
  });

  it('My stickers opens the Stickers page on Mine (D-61)', async () => {
    await renderScreen();
    await act(async () => props().onMyStickers());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/stickers', params: { tab: 'mine' } });
  });

  it('a new reminder time is saved with its switch and reschedules the reminders', async () => {
    const { invalidate } = await renderScreen();
    expect(props().reminders?.find((r) => r.slot === 'evening')?.minutes).toBe(19 * 60 + 30);
    await act(async () => props().onReminder('evening', { minutes: 21 * 60 + 15 }));
    await waitFor(() =>
      expect(mockDb.writes).toContainEqual([
        'reminder_settings',
        'upsert',
        { user_id: 'u-1', slot: 'evening', local_time: '21:15', enabled: true },
      ]),
    );
    // Today's useReminderSync watches this key and reschedules the phone's local reminders.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reminderQueryKeys.settings('u-1') });
  });

  it('a switch keeps the time already chosen', async () => {
    await renderScreen();
    await act(async () => props().onReminder('morning', { enabled: false }));
    await waitFor(() =>
      expect(mockDb.writes).toContainEqual([
        'reminder_settings',
        'upsert',
        { user_id: 'u-1', slot: 'morning', local_time: '07:00', enabled: false },
      ]),
    );
  });

  it('a failed save puts the switch back and says so', async () => {
    mockDb.failWrites = true;
    await renderScreen();
    await act(async () => props().onPref('like', false));
    await waitFor(() => expect(props().saveFailed).toBe(true));
    expect(props().prefs?.like).toBe(true);
  });

  it('sign out cancels reminders and the push token, then starts the stack over at Welcome', async () => {
    await renderScreen();
    await act(async () => props().onSignOut());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/welcome'));
    // The screens behind Settings go too, so a back swipe from Welcome can't reopen the signed-in app.
    expect(mockDismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]!);
    expect(mockCancelAll).toHaveBeenCalled();
    expect(mockRemoveToken).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
