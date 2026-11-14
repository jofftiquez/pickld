import Link from 'next/link';
import { z } from 'zod';

import { colors } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { Table } from '~/components/Table';
import { Toolbar } from '~/components/Toolbar';
import { t } from '~/i18n/t';
import { actionLabel, details, loadAudit, when } from '~/lib/audit';
import { lastPage, readPaging } from '~/lib/paging';
import { supabase } from '~/lib/supabase';

// The audit log (FR-MOD-05): who decided what, newest first, a page at a time. Read-only by design: there are
// no controls, and Postgres refuses any change to it (revoked rights and an append-only trigger).
export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = z.uuid().safeParse(params.user).data ?? null;
  const paging = readPaging(params);
  const client = await supabase();
  let list = await loadAudit(client, paging, user);
  const page = Math.min(paging.page, lastPage(list.total, paging.size));
  if (page !== paging.page)
    list = await loadAudit(client, { size: paging.size, offset: (page - 1) * paging.size }, user);
  const query = { user: user ?? undefined, size: paging.size !== 25 ? String(paging.size) : undefined };
  const link = { color: colors.brandLink, fontWeight: 700 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <Card label={t('audit.label')}>
        {user ? (
          <Toolbar>
            <span style={{ fontSize: 14 }}>{t('audit.filtered', { user: user.slice(0, 8) })}</span>
            <Link href={`/users/${user}`} style={link}>
              {t('audit.openUser')}
            </Link>
            <Link href="/audit" style={link}>
              {t('audit.clearFilter')}
            </Link>
          </Toolbar>
        ) : null}
        <Table
          columns={[
            { key: 'when', label: t('audit.columns.when'), width: 150 },
            { key: 'who', label: t('audit.columns.who'), width: 150 },
            { key: 'action', label: t('audit.columns.action'), width: 190 },
            { key: 'target', label: t('audit.columns.target'), width: 170 },
            { key: 'details', label: t('audit.columns.details') },
          ]}
          empty={t('audit.empty')}
          rows={list.entries.map((e) => ({
            key: String(e.id),
            cells: [
              <span key="when" style={{ color: colors.muted, fontWeight: 500 }}>
                {when(e.created_at)}
              </span>,
              e.actor && e.actor_id ? (
                <Link key="who" href={`/audit?user=${e.actor_id}`} style={{ color: colors.ink }}>
                  @{e.actor}
                </Link>
              ) : (
                t('audit.system')
              ),
              <span key="action" style={{ fontWeight: 700 }}>
                {actionLabel(e.action)}
              </span>,
              <span key="target" style={{ color: colors.muted }}>
                {e.target === 'profile' && e.target_id ? (
                  <Link href={`/users/${e.target_id}`} style={{ color: colors.brandLink }}>
                    {`${e.target} ${e.target_id.slice(0, 8)}`}
                  </Link>
                ) : e.target ? (
                  `${e.target} ${e.target_id?.slice(0, 8) ?? ''}`
                ) : (
                  '—'
                )}
              </span>,
              <span key="details" style={{ color: colors.muted, overflowWrap: 'anywhere' }}>
                {details(e)}
              </span>,
            ],
          }))}
        />
        <Pagination total={list.total} page={page} size={paging.size} path="/audit" params={query} />
      </Card>
    </div>
  );
}
