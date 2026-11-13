import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { colors, radius } from '@/theme/tokens';

import { CenterCard } from '~/components/CenterCard';
import { t } from '~/i18n/t';
import { originOf } from '~/lib/env';
import { input, primaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';

const notices = { sent: 'signIn.sent', link: 'signIn.badLink', invalid: 'signIn.invalid' } as const;
const Search = z.object({ notice: z.enum(['sent', 'link', 'invalid']).optional().catch(undefined) });

async function sendLink(form: FormData) {
  'use server';
  const email = z.email().safeParse(String(form.get('email') ?? '').trim());
  if (!email.success) redirect('/sign-in?notice=invalid');
  const origin = originOf(await headers());
  // Existing accounts only. The reply is the same whether or not the address has an account, so the form
  // doesn't reveal who uses Pickld; a non-moderator who signs in sees access denied.
  await (
    await supabase()
  ).auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  });
  redirect('/sign-in?notice=sent');
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { notice } = Search.parse(await searchParams);
  return (
    <CenterCard title={t('signIn.title')}>
      <p style={{ color: colors.muted, margin: '0 0 20px' }}>{t('signIn.body')}</p>
      {notice ? (
        <p
          role="status"
          style={{
            background: notice === 'sent' ? colors.brandTint : colors.dangerTint,
            color: notice === 'sent' ? colors.brandText : colors.danger,
            borderRadius: radius.banner,
            padding: '10px 12px',
            margin: '0 0 16px',
          }}
        >
          {t(notices[notice])}
        </p>
      ) : null}
      <form action={sendLink} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
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
