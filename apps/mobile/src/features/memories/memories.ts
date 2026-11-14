// Memories (FR-DAY-03): rows from the 0030 RPCs and the small date sums the screen needs.
import { z } from 'zod';

import type { MomentRenderRow } from '@/features/moment/momentRenders';

export const SLOTS = [
  'whereami',
  'mebusywith',
  'whoamiwith',
  'ootd',
  'selfie',
  'morning',
  'afternoon',
  'evening',
] as const;
const slot = z.enum(SLOTS);
export type Slot = z.infer<typeof slot>;

export const onThisDayRow = z.object({
  jar_id: z.string(),
  local_date: z.string(),
  moment_count: z.number(),
  is_full: z.boolean(),
  cover_moment_id: z.string().nullable(),
  cover_slot: slot.nullable(),
  cover_thumb_path: z.string().nullable(),
});

export const monthRecapRow = z.object({
  moment_count: z.number(),
  full_days: z.number(),
  top_slot: slot.nullable(),
  strip: z.array(z.object({ moment_id: z.string(), jar_id: z.string(), slot, local_date: z.string() })),
});

export const yearSummaryRow = z.object({ jars_filled: z.number(), full_days: z.number(), moment_count: z.number() });

export type OnThisDay = {
  jarId: string;
  localDate: string;
  momentCount: number;
  yearsAgo: number;
  coverMomentId: string | null;
  photoUrl: string | null;
  /** The cover's edits row (D-96); null or missing (older caches) draws the plain photo. */
  photoRender?: MomentRenderRow | null;
};

export type RecapPhoto = {
  momentId: string;
  jarId: string;
  slot: Slot;
  thumbUrl: string | null;
  /** The moment's edits row (D-96); null or missing (older caches) draws the plain thumbnail. */
  render?: MomentRenderRow | null;
};

export type MonthRecap = {
  /** YYYY-MM */
  month: string;
  momentCount: number;
  fullDays: number;
  topSlot: Slot | null;
  photos: RecapPhoto[];
};

export type YearSummary = { year: number; jarsFilled: number; fullDays: number; momentCount: number };

export type Memories = { onThisDay: OnThisDay | null; recap: MonthRecap; year: YearSummary };

/** The month before the one `localDate` (YYYY-MM-DD) is in, as YYYY-MM: the recap is always last month's. */
export function previousMonth(localDate: string): string {
  const [y, m] = localDate.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Whole years between two calendar dates that share a month and day. */
export function yearsBetween(earlier: string, later: string): number {
  return Number(later.slice(0, 4)) - Number(earlier.slice(0, 4));
}
