import {
  AuthFlowError,
  parseCallback,
  resendSecondsLeft,
  sendEmailCode,
  signInWithApple,
  verifyEmailCode,
} from '../auth';
import { sha256Hex } from '../contactHash';

const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockUpdateUser = jest.fn();
const mockInvoke = jest.fn();
jest.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: {
      signInWithOtp: (args: unknown) => mockSignInWithOtp(args),
      verifyOtp: (args: unknown) => mockVerifyOtp(args),
      signInWithIdToken: (args: unknown) => mockSignInWithIdToken(args),
      updateUser: (args: unknown) => mockUpdateUser(args),
    },
    functions: { invoke: (name: string, args: unknown) => mockInvoke(name, args) },
  }),
}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('expo-application', () => ({ applicationId: 'me.pickld.app' }));
const mockAppleSignIn = jest.fn();
jest.mock('expo-apple-authentication', () => ({
  signInAsync: (args: unknown) => mockAppleSignIn(args),
  formatFullName: (n: { givenName: string | null; familyName: string | null }) =>
    [n.givenName, n.familyName].filter(Boolean).join(' '),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

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

describe('sendEmailCode', () => {
  beforeEach(() => mockSignInWithOtp.mockReset());

  it('normalises the address; only Sign up may create an account; no redirect link', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    await expect(sendEmailCode('  Dale@Pickld.TEST ', 'signIn')).resolves.toBe('dale@pickld.test');
    await sendEmailCode('new@pickld.test', 'signUp');
    expect(mockSignInWithOtp.mock.calls.map(([a]) => a)).toEqual([
      { email: 'dale@pickld.test', options: { shouldCreateUser: false } },
      { email: 'new@pickld.test', options: { shouldCreateUser: true } },
    ]);
  });

  it('refuses a bad address without calling the server', async () => {
    await expect(sendEmailCode('dale@', 'signUp')).rejects.toEqual(new AuthFlowError('invalidEmail'));
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it.each([
    ['signIn', { status: 422, message: 'Signups not allowed for otp' }, 'noAccount'],
    ['signUp', { status: 422, message: 'Signups not allowed for otp' }, 'failed'],
    ['signIn', { status: 429, message: 'For security purposes…' }, 'rateLimited'],
    ['signUp', { status: 500, message: 'boom' }, 'failed'],
  ] as const)('%s with %j → %s', async (mode, error, kind) => {
    mockSignInWithOtp.mockResolvedValue({ error });
    await expect(sendEmailCode('dale@pickld.test', mode)).rejects.toMatchObject({ kind });
  });
});

describe('verifyEmailCode', () => {
  const sentAt = 1_000_000;
  beforeEach(() => mockVerifyOtp.mockReset());

  it('checks the code as an email OTP for that address', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });
    await expect(verifyEmailCode('dale@pickld.test', '123456', sentAt, sentAt + 5_000)).resolves.toBeUndefined();
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'dale@pickld.test', token: '123456', type: 'email' });
  });

  it.each(['12345', '1234567', '12a456', ''])('refuses %p without calling the server', async (code) => {
    await expect(verifyEmailCode('dale@pickld.test', code, sentAt, sentAt)).rejects.toMatchObject({
      kind: 'wrongCode',
    });
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  const rejected = { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' };
  it.each([
    ['a refused code inside 10 minutes', rejected, 9 * 60_000, 'wrongCode'],
    ['a refused code after 10 minutes', rejected, 10 * 60_000, 'codeExpired'],
    ['too many tries', { status: 429, code: 'over_request_rate_limit', message: 'slow down' }, 1_000, 'rateLimited'],
    ['a server error', { status: 500, code: 'unexpected_failure', message: 'boom' }, 1_000, 'failed'],
  ] as const)('%s → %s', async (_name, error, elapsed, kind) => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error });
    await expect(verifyEmailCode('dale@pickld.test', '123456', sentAt, sentAt + elapsed)).rejects.toEqual(
      new AuthFlowError(kind),
    );
  });
});

describe('signInWithApple', () => {
  beforeEach(() => {
    mockAppleSignIn.mockReset();
    mockSignInWithIdToken.mockReset().mockResolvedValue({ error: null });
    mockUpdateUser.mockReset().mockResolvedValue({ error: null });
    mockInvoke.mockReset().mockResolvedValue({ data: { stored: true }, error: null });
  });

  it('gives Apple the hashed nonce and Supabase the raw one, then keeps the first-time name', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'id-token',
      authorizationCode: 'auth-code',
      fullName: { givenName: 'Dale', familyName: 'Cruz' },
    });
    await signInWithApple();
    const { nonce: hashed } = mockAppleSignIn.mock.calls[0][0] as { nonce: string };
    const sent = mockSignInWithIdToken.mock.calls[0][0] as { provider: string; token: string; nonce: string };
    expect(sent.provider).toBe('apple');
    expect(sent.token).toBe('id-token');
    expect(sent.nonce).not.toBe(hashed);
    expect(sha256Hex(sent.nonce)).toBe(hashed);
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Dale Cruz' } });
    expect(mockInvoke).toHaveBeenCalledWith('apple-token', { body: { code: 'auth-code', clientId: 'me.pickld.app' } });
  });

  it('leaves the name alone when Apple doesn’t share it (every sign-in after the first)', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'id-token', fullName: { givenName: null, familyName: null } });
    await signInWithApple();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('tells a cancelled sheet from a failure, and never reaches Supabase for either', async () => {
    mockAppleSignIn.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    await expect(signInWithApple()).rejects.toEqual(new AuthFlowError('cancelled'));
    mockAppleSignIn.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ERR_REQUEST_UNKNOWN' }));
    await expect(signInWithApple()).rejects.toEqual(new AuthFlowError('failed'));
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('fails when Supabase refuses the token', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'id-token', fullName: null });
    mockSignInWithIdToken.mockResolvedValue({ error: { status: 400, message: 'Provider is not enabled' } });
    await expect(signInWithApple()).rejects.toEqual(new AuthFlowError('failed'));
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
