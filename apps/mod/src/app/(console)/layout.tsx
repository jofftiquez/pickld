import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { CenterCard } from '~/components/CenterCard';
import { Sidebar } from '~/components/Sidebar';
import { t } from '~/i18n/t';
import { loadStats } from '~/lib/queue';
import { secondaryButton } from '~/lib/styles';
import { isModerator, supabase } from '~/lib/supabase';

// Every console page sits behind this check (FR-MOD-01). Postgres enforces the same rule on every query
// (is_moderator() in RLS) and fn:mod-action on every decision; this page only decides what to show.
export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const {
    data: { user },
  } = await (await supabase()).auth.getUser();
  if (!user) redirect('/sign-in');
  const email = user.email ?? '';
  if (!isModerator(user)) {
    return (
      <CenterCard title={t('denied.title')}>
        <p style={{ color: colors.muted, margin: '0 0 20px' }}>{t('denied.body', { email })}</p>
        <form action="/sign-out" method="post">
          <button type="submit" style={secondaryButton}>
            {t('denied.signOut')}
          </button>
        </form>
      </CenterCard>
    );
  }
  const stats = await loadStats(await supabase());
  const items = [
    { href: '/', label: t('nav.overview') },
    { href: '/queue', label: t('nav.queue'), count: stats.all_open },
    { href: '/queue?filter=report', label: t('nav.reports'), count: stats.report },
    { href: '/queue?filter=appeal', label: t('nav.appeals'), count: stats.open_appeals },
    { href: '/users', label: t('nav.users') },
    { href: '/waitlist', label: t('nav.waitlist') },
    { href: '/analytics', label: t('nav.analytics') },
    { href: '/audit', label: t('nav.audit') },
    { href: '/help', label: t('nav.help') },
  ];
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar items={items} name={email.split('@')[0] ?? email} />
      <main style={{ flex: 1, padding: '28px 24px', minWidth: 0 }}>{children}</main>
    </div>
  );
}
