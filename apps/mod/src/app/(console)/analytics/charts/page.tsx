import { AnalyticsHeader } from '~/components/AnalyticsHeader';
import { BarList } from '~/components/BarList';
import { DayBars } from '~/components/DayBars';
import { Section } from '~/components/Section';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { loadAnalytics, loadStickerAnalytics, parseRange, trendText } from '~/lib/analytics';
import { supabase } from '~/lib/supabase';

const charts = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 } as const;

// Analytics charts (FR-MOD-09): the window's totals and the per-day and per-slot graphs, for moments and for
// stickers. The tables are on /analytics/audience, /packs and /stickers. All counts come from the database (0101); nothing
// here shows a photo or caption, and Only me moments aren't counted.
export default async function AnalyticsCharts({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const [site, stickers] = await Promise.all([loadAnalytics(client, days), loadStickerAnalytics(client, days)]);
  const tt = site.totals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <AnalyticsHeader page="charts" days={days} />

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
    </div>
  );
}
