import { AnalyticsHeader } from '~/components/AnalyticsHeader';
import { DataTable } from '~/components/DataTable';
import { t } from '~/i18n/t';
import { loadStickerAnalytics, parseRange, trendText } from '~/lib/analytics';
import { supabase } from '~/lib/supabase';

// Analytics: top stickers (FR-MOD-09). The 100 most used stickers in the window, with the trend against the
// window before. Only Readers and Everyone moments count.
export default async function AnalyticsTopStickers({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const stickers = await loadStickerAnalytics(client, days);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <AnalyticsHeader page="stickers" days={days} />

      <DataTable
        title={t('analytics.top.title')}
        headingHidden
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
