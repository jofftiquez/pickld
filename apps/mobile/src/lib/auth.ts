// Signing up and in (M4-02; FR-ACC-01, FR-ACC-02). No passwords exist anywhere. Email sends a 6-digit code
// that Check your email verifies (D-60). Apple is native Sign in with Apple on iOS: Apple's sheet returns an
// identity token that Supabase Auth checks and turns into a session. There is no Google sign-in. An older
// email link still comes back to pickld://auth/callback?code=…, which app/auth/callback.tsx exchanges.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { sha256Hex } from './contactHash';
import { WEB_BASE_URL } from './links';
import { getSupabase } from './supabase';

export const RESEND_SECONDS = 60;
/** How long an emailed code works (supabase/config.toml `otp_expiry`, configure.sh `mailer_otp_exp`). */
export const CODE_SECONDS = 600;
export const CODE_LENGTH = 6;

export const emailSchema = z.string().trim().toLowerCase().email();

export type AuthErrorKind =
  'invalidEmail' | 'noAccount' | 'wrongCode' | 'codeExpired' | 'rateLimited' | 'cancelled' | 'failed';
export class AuthFlowError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
  }
}

/**
 * Emails a 6-digit code. Sign up may create the account; sign in only for an existing one (`noAccount`
 * otherwise, so a typo doesn't quietly start a new account). No redirect: the email carries no link.
 */
export async function sendEmailCode(rawEmail: string, mode: 'signUp' | 'signIn'): Promise<string> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AuthFlowError('invalidEmail');
  const { error } = await getSupabase().auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: mode === 'signUp' },
  });
  if (error) {
    if (error.status === 429) throw new AuthFlowError('rateLimited');
    if (mode === 'signIn' && /signups? not allowed|user not found/i.test(error.message)) {
      throw new AuthFlowError('noAccount');
    }
    throw new AuthFlowError('failed');
  }
  return parsed.data;
}

export const codeSchema = z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`));

/**
 * Signs this phone in with the emailed code. Supabase answers a wrong code and an expired one the same way
 * (403 `otp_expired`), so `sentAt`, when the code was sent, tells them apart: past CODE_SECONDS it expired.
 * On success the session reaches useAuthStore through onAuthStateChange and the route guard moves on.
 */
export async function verifyEmailCode(email: string, code: string, sentAt: number, now = Date.now()): Promise<void> {
  if (!codeSchema.safeParse(code).success) throw new AuthFlowError('wrongCode');
  const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' });
  if (!error) return;
  if (error.status === 429) throw new AuthFlowError('rateLimited');
  if (error.status === 403 || error.code === 'otp_expired') {
    throw new AuthFlowError(now - sentAt >= CODE_SECONDS * 1000 ? 'codeExpired' : 'wrongCode');
  }
  throw new AuthFlowError('failed');
}

/** The `code` (or the error) from a pickld://auth/callback URL. */
export function parseCallback(url: string): { code: string } | { error: string } | null {
  try {
    const u = new URL(url);
    const params = new URLSearchParams(u.search || u.hash.replace(/^#/, ''));
    const code = params.get('code');
    if (code) return { code };
    const error = params.get('error_description') ?? params.get('error');
    return error ? { error } : null;
  } catch {
    return null;
  }
}

/** Exchanges a callback code for a session. A code already used (the browser and the app both saw it) is
 * fine when a session exists. */
export async function completeSignIn(code: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AuthFlowError('failed');
}

/** True where Sign in with Apple works: iOS 13 and later. Android has no Apple button. */
export function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Sign in with Apple, which also signs up: Apple's sheet, then its identity token signs this phone in to
 * Supabase Auth. Apple hashes the nonce into the token so a copied token can't be replayed. An existing account
 * with the same confirmed email (not a Hide My Email address) becomes the same account. Apple shares the
 * person's name only the first time, so it's saved for About you to fill in. Apple's one-time authorization code
 * goes to fn:apple-token, which keeps a token for revoking the link when the account is deleted.
 */
export async function signInWithApple(): Promise<void> {
  const nonce = randomHex(16);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: sha256Hex(nonce),
    });
  } catch (e) {
    throw new AuthFlowError((e as { code?: unknown }).code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'failed');
  }
  if (!credential.identityToken) throw new AuthFlowError('failed');
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });
  if (error) throw new AuthFlowError(error.status === 429 ? 'rateLimited' : 'failed');
  if (credential.authorizationCode && Application.applicationId) {
    void supabase.functions
      .invoke('apple-token', { body: { code: credential.authorizationCode, clientId: Application.applicationId } })
      .catch(() => undefined);
  }
  const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : '';
  if (name) await supabase.auth.updateUser({ data: { full_name: name } }).catch(() => undefined);
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i += 1) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Seconds until Resend is allowed again, never negative. */
export function resendSecondsLeft(sentAt: number, now: number, wait = RESEND_SECONDS): number {
  return Math.max(0, Math.ceil(wait - (now - sentAt) / 1000));
}

/** Terms and Privacy Policy on pickld.me (FR-PRV-04). */
export function openLegal(page: 'terms' | 'privacy'): void {
  void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/${page}`);
}
