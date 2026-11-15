import { Segmented } from './Segmented';
import { t } from '~/i18n/t';
import { RANGES, type Range } from '~/lib/analytics';

/** The top of an Analytics page (Charts, Audience, Packs or Top stickers): its name, the privacy note, and the 7 / 30 / 90-day window. */
export type AnalyticsPage = 'charts' | 'audience' | 'packs' | 'stickers';

export function AnalyticsHeader({ page, days }: { page: AnalyticsPage; days: Range }) {
  const base = `/analytics/${page}`;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="m-0 text-[13px] font-bold text-muted-foreground">{t('analytics.title')}</p>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">{t(`analytics.pages.${page}`)}</h1>
        <p className="mt-1 mb-0 text-[13px] text-muted-foreground">{t('analytics.subtitle')}</p>
      </div>
      <Segmented
        label={t('analytics.range.label')}
        items={RANGES.map((r) => ({
          href: r === 30 ? base : `${base}?days=${r}`,
          label: t('analytics.range.days', { count: r }),
          active: r === days,
        }))}
      />
    </header>
  );
}
