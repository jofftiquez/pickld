import { render, screen } from '@testing-library/react-native';

import { DevSignIn } from '../DevSignIn';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
    useLocalSearchParams: () => mockParams,
  };
});
const mockVerifyOtp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { verifyOtp: (args: unknown) => mockVerifyOtp(args) } }),
}));

describe('DevSignIn (pickld://dev/sign-in?email=…&code=…)', () => {
  beforeEach(() => mockVerifyOtp.mockReset());

  it('verifies the emailed code and goes home', async () => {
    mockParams = { email: 'Dale@pickld.test', code: '123456' };
    mockVerifyOtp.mockResolvedValue({ error: null });
    await render(<DevSignIn />);
    expect(await screen.findByText('redirect:/')).toBeTruthy();
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'dale@pickld.test', token: '123456', type: 'email' });
  });

  it('shows the server error', async () => {
    mockParams = { email: 'dale@pickld.test', code: '123456' };
    mockVerifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    await render(<DevSignIn />);
    expect(await screen.findByText('Token has expired or is invalid')).toBeTruthy();
  });

  it('refuses the old token link without calling the server', async () => {
    mockParams = { token: 'abc' };
    await render(<DevSignIn />);
    expect(screen.getByTestId('dev-sign-in-status').props.children).toBe('email and a 6-digit code are required');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
