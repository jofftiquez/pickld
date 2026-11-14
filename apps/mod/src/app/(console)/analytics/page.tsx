import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { BarList } from '~/components/BarList';
import { DataTable } from '~/components/DataTable';
import { DayBars } from '~/components/DayBars';
import { Section } from '~/components/Section';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import {
  type GroupRow,
  loadAnalytics,
  loadStickerAnalytics,
  parseRange,
  RANGES,
  type Range,
  trend,
} from '~/lib/analytics';
import { supabase } from '~/lib/supabase';

function trendText(now: number, before: number): string {
  const tr = trend(now, before);
  return t(`analytics.trend.${tr.kind}`, { pct: tr.pct });
}

function groupCells(g: GroupRow): string[] {
  if (g.hidden) return [t('analytics.groups.hidden'), '', ''];
  return [String(g.people ?? 0), String(g.posters ?? 0), String(g.moments ?? 0)];
}

const charts = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 } as const;

// Usage over a window of days (FR-MOD-09): moments, people posting and sign-ups, by slot, age band and home
// time zone; then sticker packs and stickers. All counts come from the database (0101); nothing here shows
// a photo or caption, Only me moments aren't counted, and groups under five people show no numbers.
export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const [site, stickers] = await Promise.all([loadAnalytics(client, days), loadStickerAnalytics(client, days)]);
  const tt = site.totals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('analytics.title')}</h1>
          <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('analytics.subtitle')}</p>
        </div>
        <nav aria-label={t('analytics.range.label')} style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r: Range) => (
            <Link
              key={r}
              href={r === 30 ? '/analytics' : `/analytics?days=${r}`}
              aria-current={r === days ? 'page' : undefined}
              style={{
                padding: '10px 14px',
                minHeight: 44,
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: radius.pill,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                background: r === days ? colors.ink : colors.surface,
                color: r === days ? colors.surface : colors.ink,
              }}
            >
              {t('analytics.range.days', { count: r })}
            </Link>
          ))}
        </nav>
      </header>

      <Section title={t('analytics.usage.title', { count: days })}>
        <Tile label={t('analytics.usage.moments')} value={String(tt.moments)} />
        <Tile label={t('analytics.usage.posters')} value={String(tt.posters)} />
        <Tile label={t('analytics.usage.signups')} value={String(tt.signups)} />
        <Tile
          label={t('analytics.usage.withStickers')}
          value={String(tt.with_stickers)}
          hint={
            tt.moments > 0
              ? t('analytics.usage.share', { pct: Math.round((tt.with_stickers / tt.moments) * 100) })
              : undefined
          }
        />
        <Tile label={t('analytics.usage.people')} value={String(tt.people)} />
        <Tile label={t('analytics.usage.allTime')} value={String(tt.moments_all_time)} />
      </Section>

      <div style={charts}>
        <DayBars
          title={t('analytics.charts.moments')}
          days={site.per_day.map((d) => ({ day: d.day, count: d.moments }))}
        />
        <DayBars
          title={t('analytics.charts.posters')}
          days={site.per_day.map((d) => ({ day: d.day, count: d.posters }))}
        />
        <DayBars
          title={t('analytics.charts.signups')}
          days={site.per_day.map((d) => ({ day: d.day, count: d.signups }))}
        />
        <BarList
          title={t('analytics.charts.slots')}
          rows={site.per_slot.map((s) => ({ label: `#${s.slot}`, value: s.moments }))}
        />
      </div>

      <div style={charts}>
        <DataTable
          title={t('analytics.groups.ages')}
          note={t('analytics.groups.note')}
          columns={[
            t('analytics.groups.age'),
            t('analytics.groups.people'),
            t('analytics.groups.posters'),
            t('analytics.groups.moments'),
          ]}
          rows={site.age_bands.map((g) => ({
            key: g.band,
            cells: [g.band === 'Not given' ? t('analytics.groups.notGiven') : g.band, ...groupCells(g)],
          }))}
          empty={t('analytics.groups.empty')}
        />
        <DataTable
          title={t('analytics.groups.zones')}
          note={t('analytics.groups.zonesNote')}
          columns={[
            t('analytics.groups.zone'),
            t('analytics.groups.people'),
            t('analytics.groups.posters'),
            t('analytics.groups.moments'),
          ]}
          rows={site.zones.map((g) => ({
            key: g.zone,
            cells: [g.zone === 'Other zones' ? t('analytics.groups.otherZones') : g.zone, ...groupCells(g)],
          }))}
          empty={t('analytics.groups.empty')}
        />
      </div>

      <Section title={t('analytics.stickers.title', { count: days })}>
        <Tile
          label={t('analytics.stickers.uses')}
          value={String(stickers.totals.uses)}
          hint={trendText(stickers.totals.uses, stickers.totals.uses_before)}
        />
        <Tile label={t('analytics.stickers.people')} value={String(stickers.totals.people)} />
        <Tile label={t('analytics.stickers.acquired')} value={String(stickers.totals.acquired)} />
      </Section>

      <div style={charts}>
        <DayBars
          title={t('analytics.charts.uses')}
          days={stickers.per_day.map((d) => ({ day: d.day, count: d.uses }))}
        />
        <DayBars
          title={t('analytics.charts.acquired')}
          days={stickers.per_day.map((d) => ({ day: d.day, count: d.acquired }))}
        />
      </div>

      <DataTable
        title={t('analytics.packs.title')}
        note={t('analytics.packs.note')}
        columns={[
          t('analytics.packs.pack'),
          t('analytics.packs.tier'),
          t('analytics.packs.owners'),
          t('analytics.packs.acquired'),
          t('analytics.packs.people'),
          t('analytics.packs.uses'),
          t('analytics.packs.trend'),
        ]}
        rows={stickers.packs.map((p) => ({
          key: p.id,
          cells: [
            <span key="n">
              {p.name}
              <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: colors.muted }}>
                {t('analytics.packs.meta', { slug: p.slug, count: p.stickers })}
                {p.status === 'draft' ? ` · ${t('analytics.packs.draft')}` : ''}
              </span>
            </span>,
            t(`analytics.tier.${p.tier}`),
            p.tier === 'free' && p.owners === 0 ? '—' : String(p.owners),
            p.tier === 'free' && p.owners === 0 ? '—' : String(p.acquired),
            String(p.people),
            String(p.uses),
            trendText(p.uses, p.uses_before),
          ],
        }))}
        empty={t('analytics.packs.empty')}
      />

      <DataTable
        title={t('analytics.top.title')}
        note={t('analytics.top.note')}
        columns={[
          t('analytics.top.sticker'),
          t('analytics.top.pack'),
          t('analytics.top.uses'),
          t('analytics.top.people'),
          t('analytics.top.trend'),
          t('analytics.top.total'),
        ]}
        rows={stickers.stickers.map((s) => ({
          key: s.id,
          cells: [
            s.retired ? t('analytics.top.retired', { label: s.label }) : s.label,
            s.pack,
            String(s.uses),
            String(s.people),
            trendText(s.uses, s.uses_before),
            String(s.uses_total),
          ],
        }))}
        empty={t('analytics.top.empty')}
      />
    </div>
  );
}
