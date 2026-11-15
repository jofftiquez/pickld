import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { CenterCard } from '~/components/CenterCard';
import { ConsoleHeader, type NavItem, Sidebar } from '~/components/Sidebar';
import { Button } from '~/components/ui/button';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { t } from '~/i18n/t';
import { loadStats } from '~/lib/queue';
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
          <Button type="submit" variant="secondary">
            {t('denied.signOut')}
          </Button>
        </form>
      </CenterCard>
    );
  }
  const stats = await loadStats(await supabase());
  const items: NavItem[] = [
    { href: '/', label: t('nav.overview'), icon: 'overview' },
    { href: '/queue', label: t('nav.queue'), icon: 'queue', count: stats.all_open },
    { href: '/queue?filter=report', label: t('nav.reports'), icon: 'reports', count: stats.report },
    { href: '/queue?filter=appeal', label: t('nav.appeals'), icon: 'appeals', count: stats.open_appeals },
    { href: '/users', label: t('nav.users'), icon: 'users' },
    { href: '/invites', label: t('nav.invites'), icon: 'invites' },
    { href: '/invite-network', label: t('nav.inviteNetwork'), icon: 'network' },
    { href: '/stickers', label: t('nav.stickers'), icon: 'stickers' },
    { href: '/waitlist', label: t('nav.waitlist'), icon: 'waitlist' },
    {
      href: '/analytics',
      label: t('nav.analytics'),
      icon: 'analytics',
      children: [
        { href: '/analytics/charts', label: t('nav.analyticsCharts') },
        { href: '/analytics/audience', label: t('nav.analyticsAudience') },
        { href: '/analytics/packs', label: t('nav.analyticsPacks') },
        { href: '/analytics/stickers', label: t('nav.analyticsStickers') },
      ],
    },
    { href: '/audit', label: t('nav.audit'), icon: 'audit' },
    { href: '/help', label: t('nav.help'), icon: 'help' },
  ];
  // The rail remembers whether it was hidden (shadcn/ui's sidebar_state cookie).
  const open = (await cookies()).get('sidebar_state')?.value !== 'false';
  return (
    <SidebarProvider defaultOpen={open} className="[--header-height:3.5rem]">
      <Sidebar items={items} name={email.split('@')[0] ?? email} />
      <SidebarInset className="min-w-0">
        <ConsoleHeader items={items} />
        <main className="min-w-0 flex-1 px-6 py-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
