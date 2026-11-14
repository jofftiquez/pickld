import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

/** Draft or Published, as a pill (design: ModConsole's source badges). */
export function StatusPill({ status }: { status: 'draft' | 'published' }) {
  const draft = status === 'draft';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        borderRadius: radius.pill,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        color: draft ? colors.ink : colors.brandText,
        background: draft ? colors.subtle : colors.brandTint,
        border: draft ? `1px dashed ${colors.dashed}` : 'none',
      }}
    >
      {t(`stickers.status.${status}`)}
    </span>
  );
}
