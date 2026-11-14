import { z } from 'zod';

// Lists page through ?page= (from 1) and ?size= (rows per page), and sort with ?sort= and ?dir=.
export const SIZES = [25, 50, 100] as const;
export type Dir = 'asc' | 'desc';

export interface Paging {
  page: number;
  size: number;
  offset: number;
}

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readPaging(params: Params, defaultSize: number = SIZES[0]): Paging {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(one(params.page) ?? 1);
  const size = z.coerce
    .number()
    .refine((n) => (SIZES as readonly number[]).includes(n))
    .catch(defaultSize)
    .parse(one(params.size) ?? defaultSize);
  return { page, size, offset: (page - 1) * size };
}

export function readSort<K extends string>(
  params: Params,
  keys: readonly K[],
  fallback: { key: K; dir: Dir },
): { key: K; dir: Dir } {
  const key = (keys as readonly string[]).includes(one(params.sort) ?? '') ? (one(params.sort) as K) : fallback.key;
  const dir = one(params.dir) === 'asc' ? 'asc' : one(params.dir) === 'desc' ? 'desc' : fallback.dir;
  return { key, dir };
}

/** A URL on `path` with `params`, dropping empty values; `changes` override or (with null) remove params. */
export function withParams(
  path: string,
  params: Record<string, string | undefined>,
  changes: Record<string, string | number | null> = {},
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') next.delete(k);
    else next.set(k, String(v));
  }
  const s = next.toString();
  return s ? `${path}?${s}` : path;
}

/** The last page that has rows (at least 1), for clamping ?page= past the end. */
export function lastPage(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}
