import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

/** A page's title and one-line description, with stat tiles or actions on the right (design: ModConsole). */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}
    >
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{title}</h1>
        {subtitle ? <div style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{subtitle}</div> : null}
      </div>
      {children}
    </header>
  );
}
