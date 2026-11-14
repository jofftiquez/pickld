import { colors, radius } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { DayBars } from '~/components/DayBars';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { RemoveEmailForm } from '~/components/RemoveEmailForm';
import { Section } from '~/components/Section';
import { Table } from '~/components/Table';
import { Tile } from '~/components/Tile';
import { Toolbar } from '~/components/Toolbar';
import { t } from '~/i18n/t';
import { when } from '~/lib/audit';
import { lastPage, readPaging } from '~/lib/paging';
import { input, secondaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';
import { loadSummary, loadWaitlist, STATES, type WaitlistState } from '~/lib/waitlist';

const link = { color: colors.brandLink, fontWeight: 700, fontSize: 14 } as const;

// The launch waitlist (FR-MOD-08): how many joined, from where, and who. Moderators can search it, download
// it as CSV and remove an email when someone asks. Admitting people (INV-08) is not done here.
export default async function Waitlist({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 254);
  const state = (STATES as readonly string[]).includes(params.state ?? '') ? (params.state as WaitlistState) : 'all';
  const paging = readPaging(params);
  const client = await supabase();
  const [summary, first] = await Promise.all([loadSummary(client), loadWaitlist(client, q, state, paging)]);
  let list = first;
  const page = Math.min(paging.page, lastPage(list.total, paging.size));
  if (page !== paging.page) {
    list = await loadWaitlist(client, q, state, { size: paging.size, offset: (page - 1) * paging.size });
  }
  const query = {
    q: q || undefined,
    state: state === 'all' ? undefined : state,
    size: paging.size !== 25 ? String(paging.size) : undefined,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <PageHeader title={t('waitlist.title')} subtitle={t('waitlist.subtitle')} />

      <Section
        title={t('waitlist.totals.title')}
        action={
          <a href="/waitlist/export" download style={link}>
            {t('waitlist.export')}
          </a>
        }
      >
        <Tile
          label={t('waitlist.totals.total')}
          value={String(summary.total)}
          hint={t('waitlist.totals.week', { count: summary.last_7_days })}
        />
        <Tile label={t('waitlist.totals.today')} value={String(summary.today)} />
        <Tile
          label={t('waitlist.totals.waiting')}
          value={String(summary.waiting)}
          hint={t('waitlist.totals.emailOnly', { count: summary.email_only })}
        />
        <Tile label={t('waitlist.totals.admitted')} value={String(summary.admitted)} />
        <Tile label={t('waitlist.totals.members')} value={String(summary.members)} />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 12 }}>
        <DayBars title={t('waitlist.perDay')} days={summary.per_day} />
        <section
          aria-label={t('waitlist.sources.title')}
          style={{ background: colors.surface, borderRadius: radius.card, padding: '14px 16px' }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 700, color: colors.muted, margin: '0 0 6px' }}>
            {t('waitlist.sources.title')}
          </h2>
          {summary.sources.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 14 }}>{t('waitlist.sources.empty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {summary.sources.map((s, i) => (
                <li
                  key={s.source}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    fontSize: 14,
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{s.source}</span>
                  <span style={{ color: colors.muted }}>{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('waitlist.list.title')}</h2>
        <Card label={t('waitlist.list.title')}>
          <Toolbar>
            <form
              role="search"
              action="/waitlist"
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: '1 1 auto' }}
            >
              <input
                type="search"
                name="q"
                defaultValue={q}
                maxLength={254}
                aria-label={t('waitlist.list.search')}
                placeholder={t('waitlist.list.placeholder')}
                style={{ ...input, flex: '1 1 260px', minWidth: 0, maxWidth: 420 }}
              />
              <select
                name="state"
                defaultValue={state}
                aria-label={t('waitlist.list.state')}
                style={{ ...input, minHeight: 44 }}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {t(`waitlist.states.${s}`)}
                  </option>
                ))}
              </select>
              <button type="submit" style={{ ...secondaryButton, minHeight: 44 }}>
                {t('waitlist.list.button')}
              </button>
            </form>
          </Toolbar>
          <Table
            columns={[
              { key: 'email', label: t('waitlist.columns.email') },
              { key: 'source', label: t('waitlist.columns.source'), width: 130 },
              { key: 'joined', label: t('waitlist.columns.joined'), width: 160 },
              { key: 'state', label: t('waitlist.columns.state'), width: 140 },
            ]}
            empty={t('waitlist.list.empty')}
            rows={list.rows.map((r) => ({
              key: r.email,
              cells: [
                <span key="email" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {r.email}
                </span>,
                <span key="source" style={{ color: colors.muted }}>
                  {r.source}
                </span>,
                <span key="joined" style={{ color: colors.muted }}>
                  {when(r.created_at)}
                </span>,
                t(`waitlist.states.${r.state}`),
              ],
            }))}
          />
          <Pagination total={list.total} page={page} size={paging.size} path="/waitlist" params={query} />
        </Card>
      </section>

      <section aria-label={t('waitlist.remove.title')} style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('waitlist.remove.title')}</h2>
        <p style={{ margin: 0, color: colors.muted, fontSize: 13, maxWidth: 640 }}>{t('waitlist.remove.body')}</p>
        <div style={{ background: colors.surface, borderRadius: radius.card, padding: 16 }}>
          <RemoveEmailForm />
        </div>
      </section>
    </div>
  );
}
