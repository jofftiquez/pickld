import Link from 'next/link';
import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';
import type { Dir } from '~/lib/paging';

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

/**
 * The console's data table: a real <table> with a header that stays in view while the page scrolls, sortable
 * columns, and an empty state. Sorting is either links (`sortHref`, server pages) or a callback (`onSort`).
 * Put it in a Card, which clips the corners without becoming a scroll box (so the sticky header works).
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
    <table className="dt">
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={c.width !== undefined ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => {
            const active = sort?.key === c.key;
            const next: Dir = active ? (sort.dir === 'asc' ? 'desc' : 'asc') : (c.firstDir ?? 'asc');
            const label = t(next === 'asc' ? 'table.sortAsc' : 'table.sortDesc', { column: c.label });
            const arrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : '';
            const content = (
              <>
                {c.label}
                <span aria-hidden style={{ minWidth: 8, color: colors.ink }}>
                  {arrow}
                </span>
              </>
            );
            return (
              <th
                key={c.key}
                scope="col"
                data-align={c.align === 'right' ? 'right' : undefined}
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {c.sortable && sortHref ? (
                  <Link href={sortHref(c.key, next)} scroll={false} className="dt-sort" aria-label={label}>
                    {content}
                  </Link>
                ) : c.sortable && onSort ? (
                  <button type="button" className="dt-sort" aria-label={label} onClick={() => onSort(c.key, next)}>
                    {content}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={{ padding: '36px 14px', textAlign: 'center', color: colors.muted }}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.key} data-link={r.href ? '' : undefined} data-selected={r.selected ? '' : undefined}>
              {r.cells.map((cell, i) => {
                const align = columns[i]?.align === 'right' ? 'right' : undefined;
                const body =
                  i === 0 && r.href ? (
                    <Link
                      href={r.href}
                      className="row-link"
                      scroll={false}
                      aria-label={r.linkLabel}
                      aria-current={r.selected ? 'true' : undefined}
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  );
                return i === 0 ? (
                  <th key={i} scope="row" data-align={align}>
                    {body}
                  </th>
                ) : (
                  <td key={i} data-align={align}>
                    {body}
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
