import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

import { reminderQueryKeys } from '@/features/reminders/useReminderSync';
import { useAuthStore } from '@/lib/authStore';

import { SettingsScreen } from '../SettingsScreen';
import { isMinor } from '../useSettings';
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
jest.mock('expo-constants', () => ({ expoConfig: { version: '4.0.0' } }));
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));
jest.mock('@/features/jar/useToday', () => ({
  ...jest.requireActual('@/features/jar/useToday'),
  phoneTimeZone: () => 'Asia/Manila',
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
    rpc: () => ({
      select: () => ({
        single: async () => ({
          data: {
            username: 'dale',
            display_name: 'Dale',
            default_visibility: 'readers',
            discoverable: true,
            is_private: false,
            member_number: 2,
            hide_member_number: false,
            birthday: '1995-05-05',
          },
          error: null,
        }),
      }),
    }),
    from: (table: string) => {
      const write = (op: string) => async (row: unknown) => {
        mockDb.writes.push([table, op, row]);
        return { error: mockDb.failWrites ? { message: 'offline' } : null };
      };
      const rows =
        table === 'reminder_settings'
          ? mockDb.reminders
          : {
              new_reader: true,
              like: true,
              comment: true,
              reply: true,
              full_jar: true,
              friend_joined: true,
              tag: true,
              together: true,
              quiet_hours: true,
              quiet_start: '22:00:00',
              quiet_end: '07:00:00',
              break_until: null,
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

  it('Show me in Discover starts on and is saved to the profile (0150)', async () => {
    await renderScreen();
    await waitFor(() => expect(props().account?.discoverable).toBe(true));
    expect(props().account?.minor).toBe(false);
    await act(async () => props().onDiscoverable(false));
    await waitFor(() => expect(mockDb.writes).toContainEqual(['profiles', 'update', { discoverable: false }]));
  });

  it('Private account starts off and is saved to the profile (0176)', async () => {
    await renderScreen();
    await waitFor(() => expect(props().account?.isPrivate).toBe(false));
    await act(async () => props().onPrivate(true));
    await waitFor(() => expect(mockDb.writes).toContainEqual(['profiles', 'update', { is_private: true }]));
  });

  it('Show my member number starts on and saves hide_member_number (0182)', async () => {
    await renderScreen();
    await waitFor(() => expect(props().account?.memberNumber).toBe(2));
    expect(props().account?.showMemberNumber).toBe(true);
    await act(async () => props().onShowMemberNumber(false));
    await waitFor(() => expect(mockDb.writes).toContainEqual(['profiles', 'update', { hide_member_number: true }]));
  });

  it('Take a break saves the midnight after its last day, re-plans reminders, and can end early (0180)', async () => {
    jest.useFakeTimers({
      now: new Date('2026-11-23T02:00:00Z'),
      doNotFake: ['setTimeout', 'setImmediate', 'nextTick'],
    });
    try {
      const { invalidate } = await renderScreen();
      // Mon 10:00 in Manila: 3 days is Mon to Wed, so it ends at Thu 00:00 Manila (Wed 16:00 UTC).
      await act(async () => props().onBreak(3));
      await waitFor(() =>
        expect(mockDb.writes).toContainEqual([
          'notification_prefs',
          'update',
          { break_until: '2026-11-25T16:00:00.000Z' },
        ]),
      );
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: reminderQueryKeys.settings('u-1') }));
      await act(async () => props().onBreak(null));
      await waitFor(() =>
        expect(mockDb.writes).toContainEqual(['notification_prefs', 'update', { break_until: null }]),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('Hide like counts is off by default and kept on this phone for this account only', async () => {
    mockDisk.clear();
    await renderScreen();
    await waitFor(() => expect(props().hideLikeCounts).toBe(false));
    await act(async () => props().onHideLikeCounts(true));
    expect(props().hideLikeCounts).toBe(true);
    await waitFor(() => expect(mockDisk.get('hideLikeCounts:u-1')).toBe('on'));
    expect(mockDb.writes).toEqual([]);
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

describe('isMinor', () => {
  it('is true until the 18th birthday and false from that day', () => {
    expect(isMinor('2008-11-17', '2026-11-16')).toBe(true);
    expect(isMinor('2008-11-16', '2026-11-16')).toBe(false);
    expect(isMinor('1995-05-05', '2026-11-16')).toBe(false);
  });
});
