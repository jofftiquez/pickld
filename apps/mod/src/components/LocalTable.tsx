'use client';

import { useState } from 'react';

import { type Column, Table, type TableRow } from './Table';
import { Pagination } from './Pagination';
import type { Dir } from '~/lib/paging';

export interface LocalRow extends TableRow {
  /** What each cell sorts by. */
  values: (string | number)[];
}

/** A Table that sorts and pages in the browser, for short lists that arrive whole (Analytics). Lists of 10 rows
 * or fewer need no page footer. */
export function LocalTable({ columns, rows, empty }: { columns: Column[]; rows: LocalRow[]; empty: string }) {
  const [sort, setSort] = useState<{ key: string; dir: Dir } | undefined>(undefined);
  const [paging, setPaging] = useState({ page: 1, size: 25 });
  const index = sort ? columns.findIndex((c) => c.key === sort.key) : -1;
  const sorted =
    index < 0 || !sort
      ? rows
      : [...rows].sort((a, b) => {
          const x = a.values[index] ?? '';
          const y = b.values[index] ?? '';
          const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
          return sort.dir === 'asc' ? order : -order;
        });
  const start = (paging.page - 1) * paging.size;
  return (
    <>
      <Table
        columns={columns}
        rows={sorted.slice(start, start + paging.size)}
        empty={empty}
        sort={sort}
        onSort={(key, dir) => {
          setSort({ key, dir });
          setPaging((p) => ({ ...p, page: 1 }));
        }}
      />
      {rows.length > 10 ? (
        <Pagination
          total={rows.length}
          page={paging.page}
          size={paging.size}
          onChange={(page, size) => setPaging({ page, size })}
        />
      ) : null}
    </>
  );
}
