import type { CSSProperties, ReactNode } from 'react';

import { cn } from '~/lib/utils';

/**
 * A white panel (shadcn/ui card surface) for a table, its toolbar and its pagination. `label` makes it a named
 * region. It clips its corners without becoming a scroll box, so a table's sticky header follows the page.
 */
export function Card({
  label,
  children,
  style,
  className,
}: {
  label?: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      data-slot="card"
      style={style}
      className={cn('min-w-0 overflow-clip rounded-card border bg-card text-card-foreground shadow-xs', className)}
    >
      {children}
    </section>
  );
}
