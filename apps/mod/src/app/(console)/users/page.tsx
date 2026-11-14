import { colors } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { Table } from '~/components/Table';
import { Toolbar } from '~/components/Toolbar';
import { t } from '~/i18n/t';
import { type Dir, lastPage, readPaging, readSort, withParams } from '~/lib/paging';
import { monthLabel } from '~/lib/queue';
import { input, secondaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';
import { searchUsers, type UserRow, type UserSort } from '~/lib/users';

function statusLabel(u: UserRow): string {
  if (u.status !== 'suspended') return t(`users.status.${u.status}`);
  return u.suspended_until ? t('users.status.suspended') : t('users.status.childSafety');
}

const COLUMNS = ['user', 'joined', 'strikes', 'reports'] as const;

/** A column and direction to the search's sort. Joined goes both ways; the others sort one way. */
function toSort(key: (typeof COLUMNS)[number], dir: Dir): UserSort {
  if (key === 'joined') return dir === 'asc' ? 'oldest' : 'newest';
  return key === 'user' ? 'username' : key;
}

// Users (FR-MOD-07): find an account by username, name, exact email or id, a page at a time. An empty search
// lists everyone, newest first.
export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 254);
  const sort = readSort(params, COLUMNS, { key: 'joined', dir: 'desc' });
  if (sort.key === 'user') sort.dir = 'asc';
  if (sort.key === 'strikes' || sort.key === 'reports') sort.dir = 'desc';
  const paging = readPaging(params);
  const client = await supabase();
  let list = await searchUsers(client, q, toSort(sort.key, sort.dir), paging);
  const page = Math.min(paging.page, lastPage(list.total, paging.size));
  if (page !== paging.page) {
    list = await searchUsers(client, q, toSort(sort.key, sort.dir), {
      size: paging.size,
      offset: (page - 1) * paging.size,
    });
  }
  const query = {
    q: q || undefined,
    sort: sort.key === 'joined' ? undefined : sort.key,
    dir: sort.key === 'joined' && sort.dir === 'asc' ? 'asc' : undefined,
    size: paging.size !== 25 ? String(paging.size) : undefined,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <Card label={t('users.label')}>
        <Toolbar>
          <form role="search" action="/users" style={{ display: 'flex', gap: 10, flex: '1 1 auto', maxWidth: 560 }}>
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={254}
              aria-label={t('users.search.label')}
              placeholder={t('users.search.placeholder')}
              style={{ ...input, flex: 1, minWidth: 0, padding: '10px 14px' }}
            />
            <button type="submit" style={{ ...secondaryButton, minHeight: 44 }}>
              {t('users.search.button')}
            </button>
          </form>
        </Toolbar>
        <Table
          columns={[
            { key: 'user', label: t('users.columns.user'), sortable: true, firstDir: 'asc' },
            { key: 'status', label: t('users.columns.status'), width: 150 },
            { key: 'joined', label: t('users.columns.joined'), width: 120, sortable: true, firstDir: 'desc' },
            { key: 'moments', label: t('users.columns.moments'), width: 100, align: 'right' },
            {
              key: 'strikes',
              label: t('users.columns.strikes'),
              width: 100,
              align: 'right',
              sortable: true,
              firstDir: 'desc',
            },
            {
              key: 'reports',
              label: t('users.columns.reports'),
              width: 120,
              align: 'right',
              sortable: true,
              firstDir: 'desc',
            },
          ]}
          sort={sort}
          sortHref={(key, dir) =>
            withParams('/users', query, {
              sort: key === 'joined' ? null : key,
              dir: key === 'joined' && dir === 'asc' ? 'asc' : null,
            })
          }
          empty={t('users.empty')}
          rows={list.rows.map((u) => ({
            key: u.id,
            href: `/users/${u.id}`,
            linkLabel: t('users.rowLabel', { user: u.username, status: statusLabel(u) }),
            cells: [
              <span key="user">
                <span style={{ fontWeight: 700 }}>@{u.username}</span>
                <span style={{ color: colors.muted, fontWeight: 500 }}> · {u.display_name}</span>
              </span>,
              <span
                key="status"
                style={{ color: u.status === 'suspended' ? colors.danger : colors.muted, fontWeight: 600 }}
              >
                {statusLabel(u)}
              </span>,
              <span key="joined" style={{ color: colors.muted }}>
                {monthLabel(u.created_at)}
              </span>,
              u.moment_count,
              <span key="strikes" style={{ fontWeight: u.strikes > 0 ? 700 : 500 }}>
                {u.strikes}
              </span>,
              <span key="reports" style={{ fontWeight: u.open_reports > 0 ? 700 : 500 }}>
                {u.open_reports}
              </span>,
            ],
          }))}
        />
        <Pagination total={list.total} page={page} size={paging.size} path="/users" params={query} />
      </Card>
    </div>
  );
}
