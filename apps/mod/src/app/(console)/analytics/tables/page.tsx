import { colors } from '@/theme/tokens';

import { AnalyticsHeader } from '~/components/AnalyticsHeader';
import { DataTable } from '~/components/DataTable';
import { t } from '~/i18n/t';
import {
  type GroupRow,
  loadAnalytics,
  loadPackThumbs,
  loadStickerAnalytics,
  parseRange,
  trendText,
} from '~/lib/analytics';
import { supabase } from '~/lib/supabase';

function groupValues(g: GroupRow): number[] {
  return [g.people ?? -1, g.posters ?? -1, g.moments ?? -1];
}

function groupCells(g: GroupRow): string[] {
  if (g.hidden) return [t('analytics.groups.hidden'), '', ''];
  return [String(g.people ?? 0), String(g.posters ?? 0), String(g.moments ?? 0)];
}

const pair = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 } as const;

// Analytics tables (FR-MOD-09): people by age band and home time zone, then sticker packs (with likes) and the
// most used stickers, for the window. The graphs are on /analytics/charts. Groups under five people show no
// numbers, nothing here shows a photo or caption, and Only me moments aren't counted.
export default async function AnalyticsTables({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const [site, stickers, thumbs] = await Promise.all([
    loadAnalytics(client, days),
    loadStickerAnalytics(client, days),
    loadPackThumbs(client, days),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <AnalyticsHeader page="tables" days={days} />

      <div style={pair}>
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
            values: [g.band, ...groupValues(g)],
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
            values: [g.zone, ...groupValues(g)],
          }))}
          empty={t('analytics.groups.empty')}
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
          t('analytics.packs.thumbs'),
        ]}
        rows={stickers.packs.map((p) => ({
          key: p.id,
          values: [
            p.name,
            p.tier,
            p.owners,
            p.acquired,
            p.people,
            p.uses,
            p.uses - p.uses_before,
            thumbs.get(p.id)?.thumbs ?? 0,
          ],
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
            <span key="th">
              {thumbs.get(p.id)?.thumbs ?? 0}
              <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: colors.muted }}>
                {t('analytics.packs.thumbsWindow', { count: thumbs.get(p.id)?.thumbs_window ?? 0 })}
              </span>
            </span>,
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
          values: [s.label, s.pack, s.uses, s.people, s.uses - s.uses_before, s.uses_total],
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
