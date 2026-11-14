import { colors, radius } from '@/theme/tokens';

/**
 * One number with its label, in the queue header's style (design: ModConsole): the number on top, the label
 * under it. Goes inside a <dl>. `alert` tints it when the number needs attention; `hint` adds a short line.
 */
export function Tile({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div
      style={{
        background: alert ? colors.dangerTint : colors.surface,
        borderRadius: radius.thumbLg,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column-reverse',
        justifyContent: 'flex-end',
        gap: 2,
        minWidth: 0,
      }}
    >
      <dt style={{ color: alert ? colors.likeText : colors.muted, fontSize: 12, fontWeight: 600 }}>
        {label}
        {hint ? <span style={{ display: 'block', fontWeight: 400 }}>{hint}</span> : null}
      </dt>
      <dd style={{ margin: 0, fontSize: 24, fontWeight: 800, color: alert ? colors.likeText : colors.ink }}>{value}</dd>
    </div>
  );
}
