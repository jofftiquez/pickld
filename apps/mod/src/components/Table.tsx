import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { t } from '~/i18n/t';
import type { Dir } from '~/lib/paging';
import { cn } from '~/lib/utils';

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  width?: number | string;
  /** Sortable columns get a header button; `firstDir` is the direction a first click sorts in. */
  sortable?: boolean;
  firstDir?: Dir;
}

export interface TableRow {
  key: string;
  /** One cell per column. The first is the row's header cell. */
  cells: ReactNode[];
  selected?: boolean;
  /** Makes the whole row open this link; `linkLabel` names it for screen readers. */
  href?: string;
  linkLabel?: string;
}

const sortButton =
  '-mx-2 inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-inherit no-underline hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * The console's data table (shadcn/ui Table): a real <table> whose header stays in view under the page header
 * while the page scrolls, sortable columns, row links, and an empty state. Sorting is either links (`sortHref`,
 * server pages) or a callback (`onSort`). Put it in a Card, which clips the corners without becoming a scroll box
 * (so the sticky header works).
 */
export function Table({
  columns,
  rows,
  empty,
  sort,
  sortHref,
  onSort,
}: {
  columns: Column[];
  rows: TableRow[];
  empty: string;
  sort?: { key: string; dir: Dir };
  sortHref?: (key: string, dir: Dir) => string;
  onSort?: (key: string, dir: Dir) => void;
}) {
  return (
    <table data-slot="table" className="w-full caption-bottom text-sm">
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={c.width !== undefined ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <TableHeader className="[&_tr]:border-b-0">
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => {
            const active = sort?.key === c.key;
            const next: Dir = active ? (sort.dir === 'asc' ? 'desc' : 'asc') : (c.firstDir ?? 'asc');
            const label = t(next === 'asc' ? 'table.sortAsc' : 'table.sortDesc', { column: c.label });
            const Arrow = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
            const content = (
              <>
                {c.label}
                <Arrow aria-hidden className={cn('size-3.5', active ? 'text-foreground' : 'opacity-40')} />
              </>
            );
            return (
              <TableHead
                key={c.key}
                scope="col"
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cn(
                  'sticky top-(--header-height) z-10 h-11 bg-card px-4 text-xs font-bold text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]',
                  c.align === 'right' && 'text-right',
                )}
              >
                {c.sortable && sortHref ? (
                  <Link href={sortHref(c.key, next)} scroll={false} className={sortButton} aria-label={label}>
                    {content}
                  </Link>
                ) : c.sortable && onSort ? (
                  <button type="button" className={sortButton} aria-label={label} onClick={() => onSort(c.key, next)}>
                    {content}
                  </button>
                ) : (
                  c.label
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow
              key={r.key}
              data-state={r.selected ? 'selected' : undefined}
              className={cn(
                'relative data-[state=selected]:bg-selected',
                r.href ? 'hover:bg-muted' : 'hover:bg-transparent',
                // The row link's focus ring goes around the whole row.
                'has-[.row-link:focus-visible]:outline-2 has-[.row-link:focus-visible]:-outline-offset-2 has-[.row-link:focus-visible]:outline-ring',
              )}
            >
              {r.cells.map((cell, i) => {
                const align = columns[i]?.align === 'right' ? 'text-right' : undefined;
                const body =
                  i === 0 && r.href ? (
                    <Link
                      href={r.href}
                      className="row-link text-inherit no-underline after:absolute after:inset-0 focus-visible:outline-none"
                      scroll={false}
                      aria-label={r.linkLabel}
                      aria-current={r.selected ? 'true' : undefined}
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  );
                // Other links in the row sit above the row link, so they stay clickable.
                const cellClass = cn(
                  'px-4 py-2.5 whitespace-normal [&_a:not(.row-link)]:relative [&_a:not(.row-link)]:z-1',
                  align,
                );
                return i === 0 ? (
                  <th key={i} scope="row" className={cn('text-left align-middle font-bold', cellClass)}>
                    {body}
                  </th>
                ) : (
                  <TableCell key={i} className={cellClass}>
                    {body}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </table>
  );
}
