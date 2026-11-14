import type { ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

/**
 * A titled table on a white card (Analytics). The first column is the row's name; the others are numbers,
 * right-aligned. `note` adds a muted line under the title.
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
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  const cell = { padding: '9px 12px', fontSize: 14, borderTop: `1px solid ${colors.divider}` } as const;
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 6, minWidth: 0, alignContent: 'start' }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {note ? <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{note}</p> : null}
      <div style={{ background: colors.surface, borderRadius: radius.card, overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <p style={{ padding: 20, margin: 0, color: colors.muted, fontSize: 14 }}>{empty}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    style={{
                      padding: '11px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.muted,
                      textAlign: i === 0 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  {r.cells.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>
                        {c}
                      </th>
                    ) : (
                      <td key={i} style={{ ...cell, textAlign: 'right', color: colors.inkSoft }}>
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
