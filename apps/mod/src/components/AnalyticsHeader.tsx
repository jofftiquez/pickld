import Link from 'next/link';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { RANGES, type Range } from '~/lib/analytics';

/** The top of an Analytics page (Charts, Audience, Packs or Top stickers): its name, the privacy note, and the 7 / 30 / 90-day window. */
export type AnalyticsPage = 'charts' | 'audience' | 'packs' | 'stickers';

export function AnalyticsHeader({ page, days }: { page: AnalyticsPage; days: Range }) {
  const base = `/analytics/${page}`;
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div>
        <p style={{ margin: 0, color: colors.muted, fontSize: 13, fontWeight: 700 }}>{t('analytics.title')}</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>
          {t(`analytics.pages.${page}`)}
        </h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('analytics.subtitle')}</p>
      </div>
      <nav aria-label={t('analytics.range.label')} style={{ display: 'flex', gap: 6 }}>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === 30 ? base : `${base}?days=${r}`}
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
  );
}
