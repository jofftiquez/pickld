import type { ReactNode } from 'react';

/** The row of filters and search above a table, inside its Card. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">{children}</div>;
}
