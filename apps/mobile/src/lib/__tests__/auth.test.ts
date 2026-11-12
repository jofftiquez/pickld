import { AuthFlowError, parseCallback, resendSecondsLeft, sendEmailLink } from '../auth';

const mockSignInWithOtp = jest.fn();
jest.mock('../supabase', () => ({
  getSupabase: () => ({ auth: { signInWithOtp: (args: unknown) => mockSignInWithOtp(args) } }),
}));
jest.mock('expo-web-browser', () => ({}));

describe('resendSecondsLeft', () => {
  it.each([
    [0, 60],
    [500, 60], // a part-second still counts as a whole one: never shows 0:59 straight away
    [18_000, 42],
    [59_001, 1],
    [60_000, 0],
    [75_000, 0],
  ])('%p ms after sending → %p s', (elapsed, expected) => {
    expect(resendSecondsLeft(1_000_000, 1_000_000 + elapsed)).toBe(expected);
  });
});

describe('parseCallback', () => {
  it('reads the code from the query or the fragment', () => {
    expect(parseCallback('pickld://auth/callback?code=abc')).toEqual({ code: 'abc' });
    expect(parseCallback('pickld://auth/callback#code=xyz')).toEqual({ code: 'xyz' });
  });
  it('reports the provider error, and nothing for an unrelated URL', () => {
    expect(parseCallback('pickld://auth/callback?error=access_denied&error_description=Link%20expired')).toEqual({
      error: 'Link expired',
    });
    expect(parseCallback('pickld://auth/callback')).toBeNull();
    expect(parseCallback('not a url')).toBeNull();
  });
});

describe('sendEmailLink', () => {
  beforeEach(() => mockSignInWithOtp.mockReset());

  it('normalises the address; only Sign up may create an account', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    await expect(sendEmailLink('  Dale@Pickld.TEST ', 'signIn')).resolves.toBe('dale@pickld.test');
    await sendEmailLink('new@pickld.test', 'signUp');
    expect(mockSignInWithOtp.mock.calls.map(([a]) => a)).toEqual([
      { email: 'dale@pickld.test', options: { shouldCreateUser: false, emailRedirectTo: 'pickld://auth/callback' } },
      { email: 'new@pickld.test', options: { shouldCreateUser: true, emailRedirectTo: 'pickld://auth/callback' } },
    ]);
  });

  it('refuses a bad address without calling the server', async () => {
    await expect(sendEmailLink('dale@', 'signUp')).rejects.toEqual(new AuthFlowError('invalidEmail'));
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it.each([
    ['signIn', { status: 422, message: 'Signups not allowed for otp' }, 'noAccount'],
    ['signUp', { status: 422, message: 'Signups not allowed for otp' }, 'failed'],
    ['signIn', { status: 429, message: 'For security purposes…' }, 'rateLimited'],
    ['signUp', { status: 500, message: 'boom' }, 'failed'],
  ] as const)('%s with %j → %s', async (mode, error, kind) => {
    mockSignInWithOtp.mockResolvedValue({ error });
    await expect(sendEmailLink('dale@pickld.test', mode)).rejects.toMatchObject({ kind });
  });
});
