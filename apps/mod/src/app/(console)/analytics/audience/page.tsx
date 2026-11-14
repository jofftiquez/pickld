import { AnalyticsHeader } from '~/components/AnalyticsHeader';
import { DataTable } from '~/components/DataTable';
import { t } from '~/i18n/t';
import { type GroupRow, loadAnalytics, parseRange } from '~/lib/analytics';
import { supabase } from '~/lib/supabase';
function groupValues(g: GroupRow): number[] {
  return [g.people ?? -1, g.posters ?? -1, g.moments ?? -1];
}

function groupCells(g: GroupRow): string[] {
  if (g.hidden) return [t('analytics.groups.hidden'), '', ''];
  return [String(g.people ?? 0), String(g.posters ?? 0), String(g.moments ?? 0)];
}

const pair = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 } as const;

// Analytics: audience (FR-MOD-09). People, posters and moments by age band and by home time zone, for the
// window. Groups under five people show no numbers, and Only me moments aren't counted.
export default async function AnalyticsAudience({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const site = await loadAnalytics(client, days);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <AnalyticsHeader page="audience" days={days} />

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
    </div>
  );
}
