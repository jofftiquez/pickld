import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

/** The row of filters and search above a table, inside its Card. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      {children}
    </div>
  );
}
