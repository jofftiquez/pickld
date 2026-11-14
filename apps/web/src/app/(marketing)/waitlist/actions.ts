'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { waitlistEnv } from '~/lib/env';

// Joining the waitlist makes a verified account (INV-12):
//   1. requestCode: check the Turnstile token, then Supabase Auth emails a 6-digit code (creating the auth user).
//   2. verifyCode: check the code, call waitlist_join(source) as that user, then sign that session out.
// Everything runs on the server with the anon key; the browser never holds a session. The address waits
// between the two steps in a short-lived httpOnly cookie, so it never appears in a URL.

export type WaitlistStatus = 'joined' | 'already' | 'member' | 'limited' | 'invalid' | 'captcha' | 'expired' | 'error';

const COOKIE = 'pickld_waitlist';
const sources = ['hero', 'final', 'waitlist', 'story'] as const;
const email = z.string().trim().max(254).pipe(z.email());
const pending = z.object({ email, source: z.enum(sources) });
const start = z.object({ email, source: z.enum(sources).catch('hero'), token: z.string().min(1).max(2048) });

type Config = NonNullable<ReturnType<typeof waitlistEnv>>;

const done = (status: WaitlistStatus): never => redirect(`/waitlist?status=${status}`);

function auth(config: Config, path: string, body: unknown, bearer = config.SUPABASE_ANON_KEY) {
  return fetch(`${config.SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.SUPABASE_ANON_KEY,
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

async function turnstileOk(config: Config, token: string): Promise<boolean> {
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  const body = new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(config.TURNSTILE_VERIFY_URL, { method: 'POST', body, cache: 'no-store' });
    return res.ok && z.object({ success: z.literal(true) }).safeParse(await res.json()).success;
  } catch {
    return false;
  }
}

async function sendCode(form: FormData): Promise<WaitlistStatus | 'sent'> {
  const parsed = start.safeParse({
    email: form.get('email'),
    source: form.get('source'),
    token: form.get('cf-turnstile-response'),
  });
  if (!parsed.success) {
    return email.safeParse(form.get('email')).success ? 'captcha' : 'invalid';
  }
  const config = waitlistEnv();
  if (!config) return 'error';
  if (!(await turnstileOk(config, parsed.data.token))) return 'captcha';
  try {
    const res = await auth(config, '/auth/v1/otp', { email: parsed.data.email, create_user: true });
    if (res.status === 429) return 'limited';
    if (res.status === 400 || res.status === 422) return 'invalid';
    if (!res.ok) return 'error';
  } catch {
    return 'error';
  }
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(COOKIE, JSON.stringify({ email: parsed.data.email, source: parsed.data.source }), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/waitlist',
    maxAge: 15 * 60,
  });
  return 'sent';
}

/** Step 1, the waitlist forms' action. Answers are pages, so a refused captcha or address still lands somewhere. */
export async function requestCode(form: FormData): Promise<void> {
  const result = await sendCode(form);
  if (result === 'sent') redirect('/waitlist/code');
  done(result);
}

/** The address waiting for its code, for the code page; null when the 15 minutes are up. */
export async function pendingEmail(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return pending.parse(JSON.parse(raw)).email;
  } catch {
    return null;
  }
}

async function join(form: FormData): Promise<WaitlistStatus | 'badcode'> {
  const raw = (await cookies()).get(COOKIE)?.value;
  let waiting: z.infer<typeof pending>;
  try {
    waiting = pending.parse(JSON.parse(raw ?? ''));
  } catch {
    return 'expired';
  }
  const code = z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .safeParse(form.get('code'));
  if (!code.success) return 'badcode';
  const config = waitlistEnv();
  if (!config) return 'error';
  try {
    const res = await auth(config, '/auth/v1/verify', { type: 'email', email: waiting.email, token: code.data });
    if (res.status === 429) return 'limited';
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) return 'badcode';
    if (!res.ok) return 'error';
    const session = z.object({ access_token: z.string().min(1) }).safeParse(await res.json());
    if (!session.success) return 'error';
    const token = session.data.access_token;
    try {
      const rpc = await auth(config, '/rest/v1/rpc/waitlist_join', { p_source: waiting.source }, token);
      if (!rpc.ok) return 'error';
      const status = z.enum(['joined', 'already', 'member']).safeParse(await rpc.json());
      return status.success ? status.data : 'error';
    } finally {
      // Only this session: someone already on Pickld stays signed in on their phone.
      await auth(config, '/auth/v1/logout?scope=local', {}, token).catch(() => undefined);
    }
  } catch {
    return 'error';
  }
}

/** Step 2: a wrong code stays on the code page; every other answer ends the attempt. */
export async function verifyCode(form: FormData): Promise<void> {
  const result = await join(form);
  if (result === 'badcode') redirect('/waitlist/code?error=badcode');
  (await cookies()).delete({ name: COOKIE, path: '/waitlist' });
  done(result);
}
