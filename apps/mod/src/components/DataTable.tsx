import type { ReactNode } from 'react';

import { Card } from './Card';
import { LocalTable } from './LocalTable';

/**
 * A titled table on a white card (Analytics). The first column is the row's name; the others are numbers,
 * right-aligned. `values` are what each cell sorts by; every column sorts, and long lists page. `note` adds a
 * muted line under the title; `headingHidden` keeps
 * the title for screen readers only, for a page whose own heading already names the table.
 */
export function DataTable({
  title,
  note,
  headingHidden,
  columns,
  rows,
  empty,
}: {
  title: string;
  note?: string;
  headingHidden?: boolean;
  columns: string[];
  rows: { key: string; cells: ReactNode[]; values: (string | number)[] }[];
  empty: string;
}) {
  return (
    <section aria-label={title} className="grid min-w-0 content-start gap-1.5">
      {headingHidden ? null : <h2 className="m-0 text-[17px] font-extrabold">{title}</h2>}
      {note ? <p className="m-0 text-[13px] text-muted-foreground">{note}</p> : null}
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
