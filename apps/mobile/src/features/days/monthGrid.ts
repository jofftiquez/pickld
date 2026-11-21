// Month grid for My days (FR-DAY-01). Pure functions over calendar dates ("YYYY-MM-DD") and months
// ("YYYY-MM"); the caller passes today's date in the phone zone (rule 7), so nothing here reads the clock.
import { z } from 'zod';

import { slots } from '@/theme/tokens';

export const MOMENTS_PER_JAR = slots.length;

/**
 * One row of `month_jars(month)` (0009), the columns the calendar's jars draw from. `published_at` is
 * optional because months cached before it was read don't have it; a missing one draws as not published.
 */
export const monthJarRow = z.object({
  jar_id: z.string(),
  local_date: z.string(),
  tz: z.string(),
  published_at: z.string().nullish(),
  moment_count: z.number().int().min(0),
  is_full: z.boolean(),
});
export type MonthJarRow = z.infer<typeof monthJarRow>;
export type MonthJar = MonthJarRow;

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

/** The floor's year when the user's birthday isn't known yet (still loading, or offline with nothing cached). */
export const FALLBACK_FLOOR_YEAR = 2000;

/**
 * The oldest month a day can be filled in (D-141): January of the user's birth year, as nothing in a diary
 * comes before its owner, or January 2000 while the birthday isn't known. `birthday` is "YYYY-MM-DD".
 */
export function floorMonth(birthday: string | null | undefined): string {
  const year = birthday && /^\d{4}-/.test(birthday) ? birthday.slice(0, 4) : String(FALLBACK_FLOOR_YEAR);
  return `${year}-01`;
}

/**
 * The earliest month My days reaches: the floor (`floorMonth`), or the month of the user's first jar if that
 * is older, so no jar is ever out of reach. `firstJarMonth` is null when the user has no jar yet (or it isn't
 * known). Previous, the month picker and the date picker all stop here.
 */
export function earliestMonth(floor: string, firstJarMonth: string | null): string {
  return firstJarMonth !== null && firstJarMonth < floor ? firstJarMonth : floor;
}

/** Every month from `from` to `to`, both included, oldest first; empty when `from` is after `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Previous goes back to `earliest` (`earliestMonth`); Next stops at the current month. */
export function monthNav(month: string, currentMonth: string, earliest: string): MonthNav {
  return {
    canGoPrevious: month > earliest,
    canGoNext: month < currentMonth,
  };
}

/** What the calendar reads of a queued moment (src/lib/queue/store.ts `QueueItem`). */
export type QueuedForMonth = {
  slot: string;
  localDate: string;
  state: string;
  replace?: boolean;
};

/**
 * The month's jars with the photos still in the offline queue added (rule 3), so a day filled a moment ago
 * shows on the calendar before its upload reaches the server. Each queued slot that isn't on the server yet
 * counts once (a replacement or a slot conflict adds nothing; an uploaded row is about to leave the queue),
 * and a day without a server jar gets one from the queue.
 */
export function withQueued(jars: readonly MonthJar[], queue: readonly QueuedForMonth[]): MonthJar[] {
  const slotsByDate = new Map<string, Set<string>>();
  for (const item of queue) {
    if (item.replace === true || item.state === 'uploaded' || item.state === 'conflict') continue;
    const daySlots = slotsByDate.get(item.localDate) ?? new Set<string>();
    daySlots.add(item.slot);
    slotsByDate.set(item.localDate, daySlots);
  }
  if (slotsByDate.size === 0) return [...jars];
  const merged = jars.map((jar) => {
    const queued = slotsByDate.get(jar.local_date)?.size ?? 0;
    if (queued === 0) return jar;
    const momentCount = Math.min(MOMENTS_PER_JAR, jar.moment_count + queued);
    return {
      ...jar,
      moment_count: momentCount,
      is_full: momentCount >= MOMENTS_PER_JAR,
    };
  });
  const known = new Set(jars.map((jar) => jar.local_date));
  for (const [date, daySlots] of slotsByDate) {
    if (known.has(date)) continue;
    const momentCount = Math.min(MOMENTS_PER_JAR, daySlots.size);
    merged.push({
      jar_id: `queued-${date}`,
      local_date: date,
      tz: '',
      published_at: null,
      moment_count: momentCount,
      is_full: momentCount >= MOMENTS_PER_JAR,
    });
  }
  return merged;
}

/** Moments across the month's jars, for the "November 2026 · 50 moments" line. */
export function monthMomentCount(jars: readonly MonthJarRow[]): number {
  return jars.reduce((sum, j) => sum + j.moment_count, 0);
}
