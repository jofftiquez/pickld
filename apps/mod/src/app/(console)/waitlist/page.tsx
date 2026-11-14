import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { DayBars } from '~/components/DayBars';
import { RemoveEmailForm } from '~/components/RemoveEmailForm';
import { Section } from '~/components/Section';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { when } from '~/lib/audit';
import { input, secondaryButton } from '~/lib/styles';
import { supabase } from '~/lib/supabase';
import { loadSummary, loadWaitlist, PAGE, STATES, type WaitlistState } from '~/lib/waitlist';

const grid = { display: 'grid', gridTemplateColumns: '1fr 110px 150px 130px', gap: 12, alignItems: 'center' };
const link = { color: colors.brandLink, fontWeight: 700, fontSize: 14 } as const;

function href(q: string, state: WaitlistState, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (state !== 'all') params.set('state', state);
  if (page > 0) params.set('page', String(page));
  const s = params.toString();
  return s ? `/waitlist?${s}` : '/waitlist';
}

// The launch waitlist (FR-MOD-08): how many joined, from where, and who. Moderators can search it, download
// it as CSV and remove an email when someone asks. Admitting people (INV-08) is not done here.
export default async function Waitlist({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 254);
  const state = (STATES as readonly string[]).includes(params.state ?? '') ? (params.state as WaitlistState) : 'all';
  const page = params.page && /^\d{1,4}$/.test(params.page) ? Number(params.page) : 0;
  const client = await supabase();
  const [summary, list] = await Promise.all([loadSummary(client), loadWaitlist(client, q, state, page)]);
  const pages = Math.max(1, Math.ceil(list.total / PAGE));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('waitlist.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('waitlist.subtitle')}</p>
      </header>

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

      <section aria-label={t('waitlist.list.title')} style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('waitlist.list.title')}</h2>
        <form role="search" action="/waitlist" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        <div style={{ background: colors.surface, borderRadius: radius.card, overflow: 'hidden' }}>
          <div
            aria-hidden
            style={{
              ...grid,
              padding: '12px 14px',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              borderBottom: `1px solid ${colors.divider}`,
            }}
          >
            <span>{t('waitlist.columns.email')}</span>
            <span>{t('waitlist.columns.source')}</span>
            <span>{t('waitlist.columns.joined')}</span>
            <span>{t('waitlist.columns.state')}</span>
          </div>
          {list.rows.length === 0 ? (
            <p style={{ padding: 24, margin: 0, color: colors.muted }}>{t('waitlist.list.empty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {list.rows.map((r) => (
                <li
                  key={r.email}
                  style={{ ...grid, padding: '10px 14px', fontSize: 14, borderBottom: `1px solid ${colors.divider}` }}
                >
                  <span style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{r.email}</span>
                  <span style={{ color: colors.muted }}>{r.source}</span>
                  <span style={{ color: colors.muted }}>{when(r.created_at)}</span>
                  <span>{t(`waitlist.states.${r.state}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>{t('waitlist.list.count', { count: list.total, page: page + 1, pages })}</span>
          {page > 0 ? (
            <Link href={href(q, state, page - 1)} style={link}>
              {t('waitlist.list.newer')}
            </Link>
          ) : null}
          {page + 1 < pages ? (
            <Link href={href(q, state, page + 1)} style={link}>
              {t('waitlist.list.older')}
            </Link>
          ) : null}
        </p>
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
