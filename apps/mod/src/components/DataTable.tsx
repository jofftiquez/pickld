import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { Card } from './Card';
import { LocalTable } from './LocalTable';

/**
 * A titled table on a white card (Analytics). The first column is the row's name; the others are numbers,
 * right-aligned. `values` are what each cell sorts by; every column sorts, and long lists page. `note` adds a
 * muted line under the title.
 */
export function DataTable({
  title,
  note,
  columns,
  rows,
  empty,
}: {
  title: string;
  note?: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[]; values: (string | number)[] }[];
  empty: string;
}) {
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 6, minWidth: 0, alignContent: 'start' }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {note ? <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{note}</p> : null}
      <Card>
        <LocalTable
          columns={columns.map((label, i) => ({
            key: String(i),
            label,
            align: i === 0 ? 'left' : 'right',
            sortable: true,
            firstDir: i === 0 ? 'asc' : 'desc',
          }))}
          rows={rows}
          empty={empty}
        />
      </Card>
    </section>
  );
}
