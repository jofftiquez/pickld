import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';

import type { PermissionApi, PermissionKind, PermissionState } from '../permissions';
import { PermissionsScreen } from '../PermissionsScreen';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    canDismiss: () => false,
    dismissAll: jest.fn(),
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => false,
    back: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockSaveStep = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('../setupFlow', () => ({
  ...jest.requireActual('../setupFlow'),
  saveSetupStep: (...a: unknown[]) => mockSaveStep(...a),
}));
const mockRegister = jest.fn(async (_id: string) => 'skipped' as const);
jest.mock('@/features/reminders/pushToken', () => ({ registerPushToken: (id: string) => mockRegister(id) }));
// Evening first and afternoon off, so the card must sort and filter.
jest.mock('@/features/reminders/useReminderSync', () => ({
  reminderQueryKeys: { settings: (id: string) => ['reminders', id] },
  fetchReminderSettings: async () => [
    { slot: 'evening', minutes: 20 * 60, enabled: true },
    { slot: 'afternoon', minutes: 13 * 60, enabled: false },
    { slot: 'morning', minutes: 8 * 60 + 30, enabled: true },
  ],
}));

function fakeApi(initial: PermissionState, afterRequest: PermissionState) {
  const requested: PermissionKind[] = [];
  const api: PermissionApi = {
    read: async () => initial,
    request: async (kind) => {
      requested.push(kind);
      return afterRequest;
    },
  };
  return { api, requested };
}

async function renderScreen(api: PermissionApi) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <PermissionsScreen api={api} />
    </QueryClientProvider>,
  );
  await act(async () => undefined);
}

describe('Permissions (FR-ONB-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);
  });

  it('Maybe later shows no system prompt and moves on', async () => {
    const { api, requested } = fakeApi('ask', 'granted');
    await renderScreen(api);
    await act(async () => fireEvent.press(screen.getByTestId('permissions-later')));
    expect(requested).toEqual([]);
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockSaveStep).toHaveBeenCalledWith('u-1', '/setup/friends');
    expect(mockPush).toHaveBeenCalledWith('/setup/friends');
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'permissions' }]]);
  });

  it('Notifications names the enabled reminder times in order', async () => {
    await renderScreen(fakeApi('ask', 'granted').api);
    expect(screen.getByText('So your 8:30 AM and 8:00 PM nudges arrive.')).toBeTruthy();
  });

  it('each Allow asks only for its own permission; allowed notifications save the push token', async () => {
    const { api, requested } = fakeApi('ask', 'granted');
    await renderScreen(api);
    await act(async () => fireEvent.press(screen.getByTestId('permission-notifications-allow')));
    expect(requested).toEqual(['notifications']);
    expect(screen.getByTestId('permission-notifications-allowed')).toBeTruthy();
    expect(screen.getByTestId('permission-camera-allow')).toBeTruthy();
    expect(mockRegister).toHaveBeenCalledWith('u-1');
    expect(jest.mocked(track).mock.calls).toEqual([['notification_opt_in', { granted: true }]]);
  });

  it('a refused notifications prompt is an opt-in of false; Camera’s prompt sends nothing', async () => {
    const { api } = fakeApi('ask', 'blocked');
    await renderScreen(api);
    await act(async () => fireEvent.press(screen.getByTestId('permission-camera-allow')));
    await act(async () => fireEvent.press(screen.getByTestId('permission-notifications-allow')));
    expect(jest.mocked(track).mock.calls).toEqual([['notification_opt_in', { granted: false }]]);
  });

  it('a permission already allowed shows Allowed and no button', async () => {
    await renderScreen(fakeApi('granted', 'granted').api);
    expect(screen.getByTestId('permission-camera-allowed')).toBeTruthy();
    expect(screen.queryByTestId('permission-camera-allow')).toBeNull();
  });
});
