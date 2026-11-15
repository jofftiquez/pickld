'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { buttonVariants } from '~/components/ui/button';
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
import { Pagination as PaginationNav, PaginationContent, PaginationItem } from '~/components/ui/pagination';
import { t } from '~/i18n/t';
import { lastPage, SIZES, withParams } from '~/lib/paging';
import { cn } from '~/lib/utils';

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

  const pageButton = (p: number, label: string, text: ReactNode, current = false, disabled = false) => {
    const className = cn(
      buttonVariants({ variant: current ? 'default' : 'outline', size: 'icon-sm' }),
      'relative min-w-9 rounded-full before:absolute before:-inset-1 before:content-[""]',
      current && 'bg-foreground text-background hover:bg-foreground/90',
      disabled && 'pointer-events-none opacity-40',
    );
    return onChange ? (
      <button
        type="button"
        className={className}
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
        className={className}
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        tabIndex={disabled ? -1 : undefined}
      >
        {text}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
      <p role="status" className="m-0">
        {total === 0 ? t('pagination.none') : t('pagination.showing', { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          {t('pagination.size')}
          <NativeSelect size="sm" value={size} onChange={(e) => go(1, Number(e.target.value))}>
            {SIZES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <PaginationNav className="mx-0 w-auto">
          <PaginationContent className="gap-1.5">
            <PaginationItem>
              {pageButton(
                Math.max(1, page - 1),
                t('pagination.previous'),
                <ChevronLeft aria-hidden />,
                false,
                page <= 1,
              )}
            </PaginationItem>
            {pageList(page, pages).map((p, i) =>
              p === 'gap' ? (
                <PaginationItem key={`gap${i}`}>
                  <span aria-label={t('pagination.gap')} className="flex size-9 items-center justify-center">
                    <MoreHorizontal aria-hidden className="size-4" />
                  </span>
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  {pageButton(
                    p,
                    p === page ? t('pagination.current', { n: p }) : t('pagination.page', { n: p }),
                    String(p),
                    p === page,
                  )}
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              {pageButton(
                Math.min(pages, page + 1),
                t('pagination.next'),
                <ChevronRight aria-hidden />,
                false,
                page >= pages,
              )}
            </PaginationItem>
          </PaginationContent>
        </PaginationNav>
      </div>
    </div>
  );
}
