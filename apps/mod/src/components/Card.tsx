import type { CSSProperties, ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

/**
 * A white panel for a table, its toolbar and its pagination. `label` makes it a named region. It clips its
 * corners without becoming a scroll box, so a table's sticky header follows the page.
 */
export function Card({ label, children, style }: { label?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      aria-label={label}
      style={{ background: colors.surface, borderRadius: radius.card, overflow: 'clip', minWidth: 0, ...style }}
    >
      {children}
    </section>
  );
}
