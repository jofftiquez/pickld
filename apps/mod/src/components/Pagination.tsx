'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { lastPage, SIZES, withParams } from '~/lib/paging';
import { input } from '~/lib/styles';

/** 1 … 4 5 6 … 12: the first, the last, and the pages next to the current one. */
function pageList(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev === 2) out.push(n - 1);
    else if (n - prev > 2) out.push('gap');
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * The footer under a table: how many rows, rows per page, and page links. On server pages it links (`path` and
 * the current `params`, which it keeps); in a client table it calls `onChange` instead.
 */
export function Pagination({
  total,
  page,
  size,
  path,
  params = {},
  onChange,
}: {
  total: number;
  page: number;
  size: number;
  path?: string;
  params?: Record<string, string | undefined>;
  onChange?: (page: number, size: number) => void;
}) {
  const router = useRouter();
  const pages = lastPage(total, size);
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const href = (p: number, s = size) =>
    withParams(path ?? '', params, { page: p === 1 ? null : p, size: s === SIZES[0] ? null : s });
  const go = (p: number, s = size) => (onChange ? onChange(p, s) : router.push(href(p, s), { scroll: false }));

  const pageButton = (p: number, label: string, text: string, current = false, disabled = false) =>
    onChange ? (
      <button
        type="button"
        className="pg-link"
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        disabled={disabled}
        onClick={() => go(p)}
      >
        {text}
      </button>
    ) : (
      <Link
        href={href(p)}
        scroll={false}
        className="pg-link"
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        tabIndex={disabled ? -1 : undefined}
      >
        {text}
      </Link>
    );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '10px 14px',
        borderTop: `1px solid ${colors.divider}`,
        fontSize: 13,
        color: colors.muted,
      }}
    >
      <p role="status" style={{ margin: 0 }}>
        {total === 0 ? t('pagination.none') : t('pagination.showing', { from, to, total })}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('pagination.size')}
          <select
            value={size}
            onChange={(e) => go(1, Number(e.target.value))}
            style={{ ...input, fontSize: 13, padding: '6px 10px', minHeight: 36 }}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label={t('pagination.label')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pageButton(Math.max(1, page - 1), t('pagination.previous'), '‹', false, page <= 1)}
          {pageList(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap${i}`} aria-label={t('pagination.gap')} style={{ padding: '0 4px' }}>
                …
              </span>
            ) : (
              <span key={p}>
                {pageButton(
                  p,
                  p === page ? t('pagination.current', { n: p }) : t('pagination.page', { n: p }),
                  String(p),
                  p === page,
                )}
              </span>
            ),
          )}
          {pageButton(Math.min(pages, page + 1), t('pagination.next'), '›', false, page >= pages)}
        </nav>
      </div>
    </div>
  );
}
