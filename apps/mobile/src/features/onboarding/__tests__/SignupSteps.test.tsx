import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';

import WelcomeRoute from '../../../../app/welcome';
import { AuthScreen } from '../AuthScreen';
import type { AuthViewProps } from '../AuthView';
import { PromiseScreen } from '../PromiseScreen';
import type { PromiseViewProps } from '../PromiseView';
import type { WelcomeViewProps } from '../WelcomeView';

// signup_step_completed for the steps without a screen test of their own (NFR-ANL-01): Welcome, Sign up and
// the Promise. The views are replaced by their props.

const mockViews: { welcome: WelcomeViewProps | null; auth: AuthViewProps | null; promise: PromiseViewProps | null } = {
  welcome: null,
  auth: null,
  promise: null,
};
jest.mock('../WelcomeView', () => ({
  WelcomeView: (p: WelcomeViewProps) => {
    mockViews.welcome = p;
    return null;
  },
}));
jest.mock('../AuthView', () => ({
  AuthView: (p: AuthViewProps) => {
    mockViews.auth = p;
    return null;
  },
}));
jest.mock('../PromiseView', () => ({
  PromiseView: (p: PromiseViewProps) => {
    mockViews.promise = p;
    return null;
  },
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    canDismiss: () => false,
    dismissAll: jest.fn(),
    push: mockPush,
    replace: jest.fn(),
    canGoBack: () => false,
    back: jest.fn(),
  }),
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockSendEmailCode = jest.fn(async (email: string) => email);
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  sendEmailCode: (email: string) => mockSendEmailCode(email),
}));
jest.mock('../setupFlow', () => ({ saveSetupStep: async () => undefined }));
jest.mock('@/features/jar/useToday', () => ({
  todayQueryKeys: { me: (id: string) => ['me', id] },
  fetchMe: async () => ({ username: 'dale', displayName: 'Dale' }),
  phoneTimeZone: () => 'Asia/Manila',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signup_step_completed', () => {
  it('Welcome: Get started completes the step', async () => {
    await render(<WelcomeRoute />);
    expect(track).not.toHaveBeenCalled();
    await act(async () => mockViews.welcome!.onGetStarted());
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'welcome' }]]);
  });

  it('Sign up: only once the email code is sent, and never from Sign in', async () => {
    useAuthStore.setState({ status: 'signedOut', session: null, error: null });
    mockSendEmailCode.mockRejectedValueOnce(new Error('offline'));
    await render(<AuthScreen mode="signUp" />);
    await act(async () => mockViews.auth!.onChangeEmail('dale@example.com'));
    await act(async () => mockViews.auth!.onSubmitEmail());
    expect(track).not.toHaveBeenCalled();
    await act(async () => mockViews.auth!.onSubmitEmail());
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'sign_up' }]]);

    jest.mocked(track).mockClear();
    await render(<AuthScreen mode="signIn" />);
    await act(async () => mockViews.auth!.onChangeEmail('dale@example.com'));
    await act(async () => mockViews.auth!.onSubmitEmail());
    expect(track).not.toHaveBeenCalled();
  });

  it('Promise: finishing setup completes the last step', async () => {
    useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    await render(
      <QueryClientProvider client={client}>
        <PromiseScreen />
      </QueryClientProvider>,
    );
    await act(async () => undefined);
    await act(async () => mockViews.promise!.onSkip());
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'promise' }]]);
  });
});
