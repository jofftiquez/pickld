import { colors, radius } from '@/theme/tokens';

/** Labelled horizontal bars, longest = the largest value (Analytics: moments per slot). */
export function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section
      aria-label={title}
      style={{ background: colors.surface, borderRadius: radius.card, padding: '14px 16px', minWidth: 0 }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 700, color: colors.muted, margin: '0 0 8px' }}>{title}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <li
            key={r.label}
            style={{ display: 'grid', gridTemplateColumns: '110px 1fr 40px', gap: 10, alignItems: 'center' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</span>
            <span aria-hidden style={{ height: 10, borderRadius: 5, background: colors.divider }}>
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${(r.value / max) * 100}%`,
                  borderRadius: 5,
                  background: colors.brand,
                }}
              />
            </span>
            <span style={{ fontSize: 13, color: colors.muted, textAlign: 'right' }}>{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
