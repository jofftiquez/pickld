import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';

import type { FriendMatch } from '../findFriends';
import { FindFriendsScreen, type FindFriendsDeps } from '../FindFriendsScreen';

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
jest.mock('expo-contacts', () => ({}));
const mockSaveStep = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('../setupFlow', () => ({
  ...jest.requireActual('../setupFlow'),
  saveSetupStep: (...a: unknown[]) => mockSaveStep(...a),
}));
jest.mock('@/features/jar/useToday', () => ({
  todayQueryKeys: { me: (id: string) => ['me', id] },
  fetchMe: async () => ({ username: 'dale', displayName: 'Dale' }),
}));
const mockSetReading = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/features/profile/useFollow', () => ({ setReading: (...a: unknown[]) => mockSetReading(...a) }));

const mika: FriendMatch = { id: 'u-2', username: 'mika', displayName: 'Mika Reyes', avatarUrl: null, reading: false };

async function renderScreen(deps: FindFriendsDeps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <FindFriendsScreen deps={deps} />
    </QueryClientProvider>,
  );
  await act(async () => undefined);
}

describe('Find friends (FR-ONB-06)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);
  });

  it('shows the invite link, and Skip reads no contacts and finishes setup', async () => {
    const deps = { hashAddressBook: jest.fn(), matchContacts: jest.fn() };
    await renderScreen(deps);
    await waitFor(() => expect(screen.getByTestId('friends-link').props.children).toBe('pickld.me/dale'));
    await act(async () => fireEvent.press(screen.getByTestId('friends-skip')));
    expect(deps.hashAddressBook).not.toHaveBeenCalled();
    expect(deps.matchContacts).not.toHaveBeenCalled();
    expect(mockSaveStep).toHaveBeenCalledWith('u-1', '/setup/promise');
    expect(mockPush).toHaveBeenCalledWith('/setup/promise');
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'friends' }]]);
  });

  it('Find sends only the hashes to matching and lists the matches; Read follows', async () => {
    const hash = 'a'.repeat(64);
    const deps = { hashAddressBook: jest.fn(async () => [hash]), matchContacts: jest.fn(async () => [mika]) };
    await renderScreen(deps);
    await act(async () => fireEvent.press(screen.getByTestId('friends-find')));
    expect(deps.matchContacts).toHaveBeenCalledWith([hash]);
    expect(screen.getByText('Mika Reyes')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('friends-read-mika')));
    expect(mockSetReading).toHaveBeenCalledWith('u-1', 'u-2', true);
    expect(screen.getByText('Reading')).toBeTruthy();
  });

  it('a refused contacts prompt offers Settings and matches nothing', async () => {
    const deps = { hashAddressBook: jest.fn(async () => 'denied' as const), matchContacts: jest.fn() };
    await renderScreen(deps);
    await act(async () => fireEvent.press(screen.getByTestId('friends-find')));
    expect(deps.matchContacts).not.toHaveBeenCalled();
    expect(screen.getByTestId('friends-settings')).toBeTruthy();
  });

  it('a failed follow puts Read back', async () => {
    mockSetReading.mockRejectedValueOnce(new Error('offline'));
    const deps = { hashAddressBook: jest.fn(async () => ['b'.repeat(64)]), matchContacts: jest.fn(async () => [mika]) };
    await renderScreen(deps);
    await act(async () => fireEvent.press(screen.getByTestId('friends-find')));
    await act(async () => fireEvent.press(screen.getByTestId('friends-read-mika')));
    expect(screen.getByText('Read')).toBeTruthy();
  });
});
