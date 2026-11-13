import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { colors, radius } from '@/theme/tokens';

import { CenterCard } from '~/components/CenterCard';
import { t } from '~/i18n/t';
import { originOf } from '~/lib/env';
import { input, primaryButton, secondaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';

// Two steps (D-60): the email, then the 6-digit code from the email. The address waits between them in a
// short-lived httpOnly cookie, not the URL, and lives as long as the code (10 minutes).
const EMAIL_COOKIE = 'pickld_mod_sign_in_email';
const CODE_SECONDS = 600;

const Search = z.object({ notice: z.enum(['code', 'invalid']).optional().catch(undefined) });
const Email = z.email();
const Code = z.string().regex(/^\d{6}$/);

async function sendCode(form: FormData) {
  'use server';
  const email = Email.safeParse(
    String(form.get('email') ?? '')
      .trim()
      .toLowerCase(),
  );
  if (!email.success) redirect('/sign-in?notice=invalid');
  // Existing accounts only, and no link: the email carries the code. The reply is the same whether or not
  // the address has an account (the error is ignored), so the form doesn't reveal who uses Pickld; a
  // non-moderator who signs in sees access denied.
  await (await supabase()).auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: false } });
  const secure = originOf(await headers()).startsWith('https:');
  (await cookies()).set(EMAIL_COOKIE, email.data, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/sign-in',
    maxAge: CODE_SECONDS,
  });
  redirect('/sign-in');
}

async function verifyCode(form: FormData) {
  'use server';
  const jar = await cookies();
  const email = Email.safeParse(jar.get(EMAIL_COOKIE)?.value);
  if (!email.success) redirect('/sign-in');
  const code = Code.safeParse(String(form.get('code') ?? '').replace(/\D/g, ''));
  if (!code.success) redirect('/sign-in?notice=code');
  // verifyOtp stores the session in the console's cookies (lib/supabase.ts); the console layout checks the role.
  const { error } = await (await supabase()).auth.verifyOtp({ email: email.data, token: code.data, type: 'email' });
  if (error) redirect('/sign-in?notice=code');
  jar.delete({ name: EMAIL_COOKIE, path: '/sign-in' });
  redirect('/');
}

async function differentEmail() {
  'use server';
  (await cookies()).delete({ name: EMAIL_COOKIE, path: '/sign-in' });
  redirect('/sign-in');
}

function Notice({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <p
      role="status"
      style={{
        background: tone === 'ok' ? colors.brandTint : colors.dangerTint,
        color: tone === 'ok' ? colors.brandText : colors.danger,
        borderRadius: radius.banner,
        padding: '10px 12px',
        margin: '0 0 16px',
      }}
    >
      {text}
    </p>
  );
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 } as const;

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { notice } = Search.parse(await searchParams);
  const pending = Email.safeParse((await cookies()).get(EMAIL_COOKIE)?.value);

  if (pending.success) {
    return (
      <CenterCard title={t('signIn.title')}>
        <Notice tone="ok" text={t('signIn.sent', { email: pending.data })} />
        {notice === 'code' ? <Notice tone="error" text={t('signIn.wrongCode')} /> : null}
        <form action={verifyCode} style={{ display: 'grid', gap: 12 }}>
          <label style={labelStyle}>
            {t('signIn.code')}
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              style={{ ...input, fontSize: 22, letterSpacing: 6, fontVariantNumeric: 'tabular-nums' }}
            />
          </label>
          <button type="submit" style={primaryButton}>
            {t('signIn.verify')}
          </button>
        </form>
        <form action={differentEmail} style={{ display: 'grid', marginTop: 12 }}>
          <button type="submit" style={secondaryButton}>
            {t('signIn.different')}
          </button>
        </form>
      </CenterCard>
    );
  }

  return (
    <CenterCard title={t('signIn.title')}>
      <p style={{ color: colors.muted, margin: '0 0 20px' }}>{t('signIn.body')}</p>
      {notice === 'invalid' ? <Notice tone="error" text={t('signIn.invalid')} /> : null}
      <form action={sendCode} style={{ display: 'grid', gap: 12 }}>
        <label style={labelStyle}>
          {t('signIn.email')}
          <input name="email" type="email" required autoComplete="email" style={input} />
        </label>
        <button type="submit" style={primaryButton}>
          {t('signIn.send')}
        </button>
      </form>
    </CenterCard>
  );
}
