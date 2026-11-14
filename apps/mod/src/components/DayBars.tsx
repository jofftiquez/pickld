import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

export interface DayCount {
  day: string;
  count: number;
}

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * One bar per day, oldest on the left (Waitlist joins, Analytics). Each bar carries its date and count for
 * screen readers; the first and last dates sit under the chart.
 */
export function DayBars({ title, days }: { title: string; days: DayCount[] }) {
  const peak = Math.max(0, ...days.map((d) => d.count));
  const max = Math.max(1, peak);
  const first = days.at(0);
  const last = days.at(-1);
  return (
    <figure style={{ margin: 0, background: colors.surface, borderRadius: radius.card, padding: '14px 16px 10px' }}>
      <figcaption style={{ fontSize: 13, fontWeight: 700, color: colors.muted, marginBottom: 10 }}>{title}</figcaption>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 120,
        }}
      >
        {days.map((d) => (
          <li
            key={d.day}
            aria-label={t('chart.bar', { date: dayLabel(d.day), count: d.count })}
            title={t('chart.bar', { date: dayLabel(d.day), count: d.count })}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}
          >
            <span
              style={{
                display: 'block',
                width: '100%',
                height: d.count === 0 ? 2 : `${Math.max(4, (d.count / max) * 100)}%`,
                borderRadius: 3,
                background: d.count === 0 ? colors.divider : colors.brand,
              }}
            />
          </li>
        ))}
      </ol>
      {first && last ? (
        <p
          aria-hidden
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            margin: '8px 0 0',
            fontSize: 12,
            color: colors.muted,
          }}
        >
          <span>{dayLabel(first.day)}</span>
          <span>{t('chart.peak', { count: peak })}</span>
          <span>{dayLabel(last.day)}</span>
        </p>
      ) : null}
    </figure>
  );
}
