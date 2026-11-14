import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/lib/authStore';

import InviteLinkRoute from '../../../../app/i/[token]';
import { AuthScreen } from '../../onboarding/AuthScreen';
import type { AuthViewProps } from '../../onboarding/AuthView';
import { usePendingInvite } from '../join';
import { WaitingScreen } from '../WaitingScreen';
import type { WaitingViewProps } from '../WaitingView';

// Joining with an invite (INV-06): the card on Sign up, Waiting, and where a pickld.me/i/… link lands.

const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
    removeItem: async (k: string) => void mockDisk.delete(k),
  },
}));
const mockClipboard = jest.fn(async () => '');
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/jar/useToday', () => ({ phoneTimeZone: () => 'Asia/Manila' }));

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  canDismiss: () => false,
  dismissAll: jest.fn(),
};
const mockParams: { token?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockProfile = { status: 'active' as string | null, birthday: '1990-03-14' };
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockProfile.status ? { status: mockProfile.status } : null, error: null }),
          single: async () => ({ data: { birthday: mockProfile.birthday }, error: null }),
        }),
      }),
    }),
  }),
}));

// Views are replaced by their props; Sign up's card renders for real.
const mockViews: { auth: AuthViewProps | null; waiting: WaitingViewProps | null } = { auth: null, waiting: null };
jest.mock('../../onboarding/AuthView', () => ({
  AuthView: (p: AuthViewProps) => {
    mockViews.auth = p;
    return p.codeCard ?? null;
  },
}));
jest.mock('../WaitingView', () => ({
  WaitingView: (p: WaitingViewProps) => {
    mockViews.waiting = p;
    return null;
  },
}));

const personal = {
  data: { data: { kind: 'personal', inviter: { username: 'mia', display_name: 'Mia Cruz', avatar: null } } },
  error: null,
};
const notFound = { data: null, error: { context: { status: 404 } } };

const withQuery = (node: ReactNode) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
      })
    }
  >
    {node}
  </QueryClientProvider>
);
// Lets the queries, the storage reads and the RPC calls settle (React Query notifies on a timer).
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));

beforeEach(() => {
  jest.clearAllMocks();
  mockDisk.clear();
  mockViews.auth = mockViews.waiting = null;
  mockProfile.status = 'active';
  delete mockParams.token;
  usePendingInvite.setState({ token: undefined });
  useAuthStore.getState().setSession({ user: { id: 'u-1', user_metadata: {} } } as unknown as Session);
});

describe('Sign up', () => {
  beforeEach(() => useAuthStore.getState().setSession(null));

  it("a kept friend's code shows who invited you, without the photo fan", async () => {
    mockDisk.set('pendingInvite', 'XADXFG');
    mockInvoke.mockResolvedValue(personal);
    await render(<AuthScreen mode="signUp" />);
    await flush();
    expect(mockInvoke).toHaveBeenCalledWith('invite', { body: { token: 'XADXFG' } });
    expect(screen.getByText('Mia Cruz invited you')).toBeTruthy();
    expect(mockViews.auth?.showFan).toBe(false);
  });

  it('a code that no longer works is dropped from the phone and said so', async () => {
    mockDisk.set('pendingInvite', 'XADXFG');
    mockInvoke.mockResolvedValue(notFound);
    await render(<AuthScreen mode="signUp" />);
    await flush();
    expect(mockDisk.has('pendingInvite')).toBe(false);
    expect(screen.getByText('That code doesn’t work')).toBeTruthy();
    expect(mockViews.auth?.showFan).toBe(true);
  });

  it('Paste takes a pickld.me link from the clipboard, and refuses anything else', async () => {
    mockInvoke.mockResolvedValue(personal);
    await render(<AuthScreen mode="signUp" />);
    await flush();
    mockClipboard.mockResolvedValueOnce('see you there!');
    await act(async () => fireEvent.press(screen.getByLabelText('Paste an invite code')));
    expect(screen.getByText('There’s no invite code to paste')).toBeTruthy();

    mockClipboard.mockResolvedValueOnce('https://pickld.me/i/k7mab2cd3x');
    await act(async () => fireEvent.press(screen.getByLabelText('Paste an invite code')));
    await flush();
    expect(mockDisk.get('pendingInvite')).toBe('K7MAB2CD3X');
    expect(mockInvoke).toHaveBeenCalledWith('invite', { body: { token: 'K7MAB2CD3X' } });
    expect(screen.getByText('Mia Cruz invited you')).toBeTruthy();
  });

  it('Sign in never shows the card or reads a code', async () => {
    mockDisk.set('pendingInvite', 'XADXFG');
    await render(<AuthScreen mode="signIn" />);
    await flush();
    expect(mockViews.auth?.codeCard).toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('Waiting', () => {
  beforeEach(() => {
    mockProfile.status = 'waiting';
    mockRpc.mockImplementation(async (name: string) =>
      name === 'waiting_position' ? { data: 1241, error: null } : { data: { result: 'unavailable' }, error: null },
    );
  });

  it('shows the people ahead (position 1241 → 1,240 ahead)', async () => {
    await render(withQuery(<WaitingScreen />));
    await flush();
    expect(mockViews.waiting?.ahead).toBe(1240);
  });

  it("a kept code is used on opening: an adult friend's code lets them in, reading each other", async () => {
    mockDisk.set('pendingInvite', 'XADXFG');
    mockRpc.mockImplementation(async (name: string) =>
      name === 'waiting_position'
        ? { data: 3, error: null }
        : { data: { result: 'joined', kind: 'personal', inviter: 'mia' }, error: null },
    );
    await render(withQuery(<WaitingScreen />));
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('invite_redeem', { p_token: 'XADXFG' });
    expect(mockToast).toHaveBeenCalledWith('readEachOther', { username: 'mia' });
    expect(mockDisk.has('pendingInvite')).toBe(false);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('a teen let in by a friend only follows them', async () => {
    mockProfile.birthday = '2010-01-01';
    mockDisk.set('pendingInvite', 'XADXFG');
    mockRpc.mockImplementation(async (name: string) =>
      name === 'waiting_position'
        ? { data: 3, error: null }
        : { data: { result: 'joined', kind: 'personal', inviter: 'mia' }, error: null },
    );
    await render(withQuery(<WaitingScreen />));
    await flush();
    expect(mockToast).toHaveBeenCalledWith('following', { username: 'mia' });
    mockProfile.birthday = '1990-03-14';
  });

  it("Get in with a code that doesn't work stays on Waiting with the error", async () => {
    await render(withQuery(<WaitingScreen />));
    await flush();
    await act(async () => mockViews.waiting!.onChangeCode('K7MABC'));
    await act(async () => mockViews.waiting!.onGetIn());
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('invite_redeem', { p_token: 'K7MABC' });
    expect(mockViews.waiting?.error).toBe('unavailable');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('let in some other way meanwhile (no place in line any more): goes in', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await render(withQuery(<WaitingScreen />));
    await flush();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('Settings stays reachable, for export and delete', async () => {
    await render(withQuery(<WaitingScreen />));
    await flush();
    mockViews.waiting!.onSettings();
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });
});

describe('a pickld.me/i/… link', () => {
  it('signed out: the code is kept for Sign up', async () => {
    useAuthStore.getState().setSession(null);
    mockParams.token = 'xadxfg';
    await render(withQuery(<InviteLinkRoute />));
    await flush();
    expect(mockDisk.get('pendingInvite')).toBe('XADXFG');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-up');
  });

  it('waiting: the code is kept, and Waiting uses it', async () => {
    mockProfile.status = 'waiting';
    mockParams.token = 'XADXFG';
    await render(withQuery(<InviteLinkRoute />));
    await flush();
    expect(mockDisk.get('pendingInvite')).toBe('XADXFG');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it("already on Pickld: the code isn't used, and the inviter's profile opens", async () => {
    mockParams.token = 'XADXFG';
    mockInvoke.mockResolvedValue(personal);
    await render(withQuery(<InviteLinkRoute />));
    await flush();
    expect(mockToast).toHaveBeenCalledWith('alreadyMember');
    expect(mockDisk.has('pendingInvite')).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/u/mia');
  });
});
