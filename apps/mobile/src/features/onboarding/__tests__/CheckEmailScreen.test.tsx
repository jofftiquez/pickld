import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/authStore';

import { CheckEmailScreen } from '../CheckEmailScreen';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
    useLocalSearchParams: () => ({ email: 'dale@pickld.test', mode: 'signIn' }),
    useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
  };
});
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockSend = jest.fn();
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  sendEmailCode: (...args: unknown[]) => mockSend(...args),
}));
const mockVerifyOtp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { verifyOtp: (args: unknown) => mockVerifyOtp(args) } }),
}));

const refused = { data: {}, error: { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' } };

describe('Check your email', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-12T08:00:00Z') });
    mockSend.mockReset().mockResolvedValue('dale@pickld.test');
    mockVerifyOtp.mockReset().mockResolvedValue(refused);
    useAuthStore.setState({ status: 'signedOut', session: null, error: null });
  });
  afterEach(() => jest.useRealTimers());

  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  it('counts down 60 seconds, then offers Resend, which sends again and restarts the timer', async () => {
    await render(<CheckEmailScreen />);
    expect(screen.getByText(/dale@pickld\.test/)).toBeTruthy();
    expect(screen.getByText('Didn’t get it? Resend in 1:00')).toBeTruthy();
    expect(screen.queryByTestId('check-email-resend')).toBeNull();

    await tick(18_000);
    expect(screen.getByText('Didn’t get it? Resend in 0:42')).toBeTruthy();

    await tick(41_000);
    expect(screen.getByText('Didn’t get it? Resend in 0:01')).toBeTruthy();
    expect(screen.queryByTestId('check-email-resend')).toBeNull();

    await tick(1_000);
    expect(screen.queryByTestId('check-email-timer')).toBeNull();
    await fireEvent.press(screen.getByTestId('check-email-resend'));
    expect(mockSend).toHaveBeenCalledWith('dale@pickld.test', 'signIn');
    expect(await screen.findByText('Sent again. Check your inbox.')).toBeTruthy();
    expect(screen.getByText('Didn’t get it? Resend in 1:00')).toBeTruthy();
  });

  it('lets them resend straight away when the resend itself fails', async () => {
    await render(<CheckEmailScreen />);
    await tick(60_000);
    mockSend.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByTestId('check-email-resend'));
    expect(await screen.findByText('Something went wrong. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByTestId('check-email-resend')).toBeTruthy();
  });

  it('says where the code went and labels the code field for screen readers', async () => {
    await render(<CheckEmailScreen />);
    expect(screen.getByText(/We sent a 6-digit code to/)).toBeTruthy();
    expect(screen.getByText(/Enter it below\./)).toBeTruthy();
    const field = screen.getByLabelText('6-digit code');
    expect(field.props.textContentType).toBe('oneTimeCode');
    expect(field.props.autoComplete).toBe('one-time-code');
    expect(field.props.keyboardType).toBe('number-pad');
  });

  it('checks a valid code at the 6th digit; the session then takes them into the app', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });
    await render(<CheckEmailScreen />);
    const field = screen.getByTestId('check-email-code');
    await fireEvent.changeText(field, '12345');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    // Pasted or autofilled text keeps only the digits.
    await fireEvent.changeText(field, '12 34 56');
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'dale@pickld.test', token: '123456', type: 'email' });
    expect(await screen.findByText('Checking your code…')).toBeTruthy();
    expect(screen.getByTestId('check-email-code').props.editable).toBe(false);

    // supabase-js's onAuthStateChange (authBootstrap) stores the session; the screen leaves.
    await act(async () => useAuthStore.getState().setSession({ user: { id: 'u1' } } as never));
    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('a wrong code says so, clears the boxes and lets them type again', async () => {
    await render(<CheckEmailScreen />);
    await tick(30_000);
    await fireEvent.changeText(screen.getByTestId('check-email-code'), '000000');
    expect(await screen.findByText('That code isn’t right.')).toBeTruthy();
    expect(screen.getByTestId('check-email-code').props.value).toBe('');
    expect(screen.getByTestId('check-email-code').props.editable).toBe(true);
    await fireEvent.changeText(screen.getByTestId('check-email-code'), '1');
    expect(screen.queryByText('That code isn’t right.')).toBeNull();
  });

  it('a code past its 10 minutes is expired; a resent code gets a fresh 10 minutes', async () => {
    await render(<CheckEmailScreen />);
    await tick(10 * 60_000);
    await fireEvent.changeText(screen.getByTestId('check-email-code'), '123456');
    expect(await screen.findByText('That code has expired. Send a new one.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('check-email-resend'));
    expect(mockSend).toHaveBeenCalledWith('dale@pickld.test', 'signIn');
    expect(screen.queryByText('That code has expired. Send a new one.')).toBeNull();
    expect(await screen.findByText('Sent again. Check your inbox.')).toBeTruthy();

    await tick(60_000);
    await fireEvent.changeText(screen.getByTestId('check-email-code'), '654321');
    expect(await screen.findByText('That code isn’t right.')).toBeTruthy();
  });
});
