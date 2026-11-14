// Month grid for My days (FR-DAY-01). Pure functions over calendar dates ("YYYY-MM-DD") and months
// ("YYYY-MM"); the caller passes today's date in the phone zone (rule 7), so nothing here reads the clock.
import { z } from 'zod';

import { slots } from '@/theme/tokens';

export const MOMENTS_PER_JAR = slots.length;

/**
 * One row of `month_jars(month)` (0009). The generated types mark the cover columns non-null, but an
 * empty jar has no cover, so they are parsed as nullable here.
 */
export const monthJarRow = z.object({
  jar_id: z.string(),
  local_date: z.string(),
  tz: z.string(),
  moment_count: z.number().int().min(0),
  is_full: z.boolean(),
  cover_moment_id: z.string().nullable(),
  cover_thumb_path: z.string().nullable(),
});
export type MonthJarRow = z.infer<typeof monthJarRow>;

/** A month_jars row plus the signed thumbnail URL for its cover (null without a cover or offline). */
export type MonthJar = MonthJarRow & { coverUrl: string | null };

export type DayCell = {
  kind: 'day';
  /** "YYYY-MM-DD" */
  date: string;
  day: number;
  isToday: boolean;
  /** After today: shown but disabled. */
  isFuture: boolean;
  /** The jar for this date, or null when the user has none. */
  jar: MonthJar | null;
};
export type BlankCell = { kind: 'blank'; key: string };
export type GridCell = DayCell | BlankCell;

export type MonthGrid = {
  month: string;
  /** Weekday numbers (0 = Sunday … 6 = Saturday) in column order, for the header. */
  weekdays: number[];
  /** Rows of exactly 7 cells; leading and trailing blanks pad the first and last week. */
  weeks: GridCell[][];
};

const MONTH = /^(\d{4})-(\d{2})$/;

function parseMonth(month: string): { year: number; month: number } {
  const match = MONTH.exec(month);
  const m = match ? Number(match[2]) : 0;
  if (!match || m < 1 || m > 12) throw new RangeError(`Expected a month like "2026-11", got "${month}"`);
  return { year: Number(match[1]), month: m };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-09" → "2026-11". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month `delta` months from `month` ("2026-01", -1 → "2025-12"). */
export function addMonths(month: string, delta: number): string {
  const { year, month: m } = parseMonth(month);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Days in the month, leap years included. */
export function daysInMonth(month: string): number {
  const { year, month: m } = parseMonth(month);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Weekday (0 = Sunday) of the 1st of the month. */
function firstWeekdayOf(month: string): number {
  const { year, month: m } = parseMonth(month);
  return new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
}

/**
 * expo-localization's `firstWeekday` (1 = Sunday … 7 = Saturday, or null) as 0 = Sunday … 6 = Saturday.
 * Unknown values fall back to Sunday, as in the design.
 */
export function weekStartFrom(firstWeekday: number | null | undefined): number {
  return firstWeekday && Number.isInteger(firstWeekday) && firstWeekday >= 1 && firstWeekday <= 7
    ? firstWeekday - 1
    : 0;
}

export function buildMonthGrid(input: {
  month: string;
  /** Today in the phone zone, "YYYY-MM-DD". */
  today: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekStart?: number;
  jars?: readonly MonthJar[];
}): MonthGrid {
  const { month, today, weekStart = 0, jars = [] } = input;
  const byDate = new Map(jars.filter((j) => monthOf(j.local_date) === month).map((j) => [j.local_date, j]));
  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const leading = (firstWeekdayOf(month) - weekStart + 7) % 7;

  const cells: GridCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ kind: 'blank', key: `lead-${i}` });
  const count = daysInMonth(month);
  for (let day = 1; day <= count; day++) {
    const date = `${month}-${pad(day)}`;
    cells.push({
      kind: 'day',
      date,
      day,
      isToday: date === today,
      isFuture: date > today,
      jar: byDate.get(date) ?? null,
    });
  }
  for (let i = 0; cells.length % 7 !== 0; i++) cells.push({ kind: 'blank', key: `trail-${i}` });

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, weekdays, weeks };
}

export type MonthNav = { canGoPrevious: boolean; canGoNext: boolean };

/** How many months before the current one My days always reaches, so earlier days can be filled. */
export const BACKFILL_MONTHS = 12;

/**
 * The earliest month My days reaches: the month of the user's first jar or `BACKFILL_MONTHS` before the
 * current month, whichever is earlier, so a new user can still reach and fill days before their first jar.
 * `firstJarMonth` is null when the user has no jar yet (or it isn't known).
 */
export function earliestMonth(currentMonth: string, firstJarMonth: string | null): string {
  const backfill = addMonths(currentMonth, -BACKFILL_MONTHS);
  return firstJarMonth !== null && firstJarMonth < backfill ? firstJarMonth : backfill;
}

/** Every month from `from` to `to`, both included, oldest first; empty when `from` is after `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Previous goes back to `earliestMonth`; Next stops at the current month. */
export function monthNav(month: string, currentMonth: string, firstJarMonth: string | null): MonthNav {
  const earliest = earliestMonth(currentMonth, firstJarMonth);
  return {
    canGoPrevious: month > earliest,
    canGoNext: month < currentMonth,
  };
}

/** Moments across the month's jars, for the "November 2026 · 50 moments" line. */
export function monthMomentCount(jars: readonly MonthJarRow[]): number {
  return jars.reduce((sum, j) => sum + j.moment_count, 0);
}

/** Fill bar width as a fraction of a full jar, 0…1. */
export function fillFraction(momentCount: number): number {
  return Math.min(1, Math.max(0, momentCount / MOMENTS_PER_JAR));
}
