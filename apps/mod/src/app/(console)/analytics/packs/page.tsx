import { colors } from '@/theme/tokens';

import { AnalyticsHeader } from '~/components/AnalyticsHeader';
import { DataTable } from '~/components/DataTable';
import { t } from '~/i18n/t';
import { loadPackThumbs, loadStickerAnalytics, parseRange, trendText } from '~/lib/analytics';
import { supabase } from '~/lib/supabase';

// Analytics: sticker packs (FR-MOD-09). Owners, acquisitions, people, uses and likes per pack for the window,
// drafts included (moderators only).
export default async function AnalyticsPacks({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parseRange((await searchParams).days);
  const client = await supabase();
  const [stickers, thumbs] = await Promise.all([loadStickerAnalytics(client, days), loadPackThumbs(client, days)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <AnalyticsHeader page="packs" days={days} />

      <DataTable
        title={t('analytics.packs.title')}
        headingHidden
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
    </div>
  );
}
