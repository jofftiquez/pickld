// Signing up and in (M4-02; FR-ACC-01, FR-ACC-02). No passwords exist anywhere. Email sends a 6-digit code
// that Check your email verifies (D-60). Apple and Google go through Supabase OAuth in the system browser with
// the PKCE flow and come back to pickld://auth/callback?code=…, which the OAuth browser session (or
// app/auth/callback.tsx) exchanges for a session on this phone.
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { WEB_BASE_URL } from './links';
import { getSupabase } from './supabase';

export const AUTH_REDIRECT = 'pickld://auth/callback';
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

/** The `code` (or the provider's error) from a pickld://auth/callback URL. */
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

/** Apple or Google in an in-app browser session that returns to the app. */
export async function signInWithProvider(provider: 'apple' | 'google'): Promise<void> {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new AuthFlowError('failed');
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== 'success') throw new AuthFlowError('cancelled');
  const parsed = parseCallback(result.url);
  if (!parsed || 'error' in parsed) throw new AuthFlowError('failed');
  await completeSignIn(parsed.code);
}

/** Seconds until Resend is allowed again, never negative. */
export function resendSecondsLeft(sentAt: number, now: number, wait = RESEND_SECONDS): number {
  return Math.max(0, Math.ceil(wait - (now - sentAt) / 1000));
}

/** Terms and Privacy Policy on pickld.me (FR-PRV-04). */
export function openLegal(page: 'terms' | 'privacy'): void {
  void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/${page}`);
}
