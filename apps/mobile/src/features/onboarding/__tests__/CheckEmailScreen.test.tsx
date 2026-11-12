import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
  sendEmailLink: (...args: unknown[]) => mockSend(...args),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

describe('Check your email', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-12T08:00:00Z') });
    mockSend.mockReset().mockResolvedValue('dale@pickld.test');
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
});
