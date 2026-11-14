// The date scrubber on the Moments and Jars timelines (FR-SOC-01): which days hold rows (`moments_feed_days`,
// `feed_days`, 0140), where each sits on the rail, which day a drag points at, and the anchor that starts a
// timeline at a day it hasn't loaded yet. The rail is proportional to rows, not to time, as in Google Photos:
// a busy week takes more of the rail than a quiet month, and empty stretches take none.
import { z } from 'zod';

import { addDays, localDateIn, localTimeToInstant } from '@/lib/jars';

export const feedDayRow = z.object({ day: z.string(), n: z.number() });
/** A day (YYYY-MM-DD in the phone's zone) and how many rows of the timeline it holds; newest first. */
export type FeedDay = z.infer<typeof feedDayRow>;

/** Each day with the rows above it (`start`); `total` is every row. */
export type Rail = { days: (FeedDay & { start: number })[]; total: number };

export function buildRail(days: readonly FeedDay[]): Rail {
  let start = 0;
  const out = days.map((d) => {
    const row = { ...d, start };
    start += d.n;
    return row;
  });
  return { days: out, total: start };
}

/** The day a point on the rail (0 top, 1 bottom) falls in; null for an empty rail. */
export function dayAtFraction(rail: Rail, fraction: number): string | null {
  if (rail.days.length === 0) return null;
  const row = Math.min(Math.max(fraction, 0), 1) * rail.total;
  let found = rail.days[0];
  for (const d of rail.days) {
    if (d.start > row) break;
    found = d;
  }
  return found?.day ?? null;
}

/** Where a day starts on the rail (0 top, 1 bottom): the day itself, or the nearest older day that has rows. */
export function fractionOfDay(rail: Rail, day: string): number {
  if (rail.total === 0) return 0;
  const at = rail.days.find((d) => d.day <= day) ?? rail.days[rail.days.length - 1];
  return (at?.start ?? 0) / rail.total;
}

/** The next older (step 1) or newer (step -1) day with rows, for a screen reader's adjust; null past the end. */
export function stepDay(rail: Rail, day: string, step: 1 | -1): string | null {
  const at = step === 1 ? rail.days.find((d) => d.day < day) : rail.days.findLast((d) => d.day > day);
  return at?.day ?? null;
}

/** A label on the rail: a month (YYYY-MM), shown as its year when it is the first one of a different year. */
export type RailMark = { month: string; showYear: boolean; fraction: number };

/**
 * One mark per month at its newest day, top to bottom, leaving out any closer than `minGap` px to the one
 * kept above it on a rail `height` px tall. A month in another year than the mark above it shows the year.
 */
export function railMarks(rail: Rail, height: number, minGap: number): RailMark[] {
  const marks: RailMark[] = [];
  let lastY = -Infinity;
  let lastYear: string | null = null;
  let lastMonth: string | null = null;
  for (const d of rail.days) {
    const month = d.day.slice(0, 7);
    if (month === lastMonth) continue;
    lastMonth = month;
    const fraction = rail.total === 0 ? 0 : d.start / rail.total;
    if (fraction * height - lastY < minGap) continue;
    const year = month.slice(0, 4);
    marks.push({ month, showYear: lastYear !== null && year !== lastYear, fraction });
    lastY = fraction * height;
    lastYear = year;
  }
  return marks;
}

/** The `from` anchor for a day: the next day's midnight in the zone, so the timeline starts on that day. */
export function anchorFor(day: string, tz: string): string {
  return localTimeToInstant(addDays(day, 1), 0, tz).toISOString();
}

/** The day a row's sort time (added_at, feed_at) falls on in the zone. */
export function dayOf(at: string, tz: string): string {
  return localDateIn(new Date(at), tz);
}

/** A page cursor; `newer` pages hold the rows just above it (`*_page_newer`), nearest first, shown reversed. */
export type PageCursor = { at: string; id: string; newer?: true };

/**
 * The cursor for the rows above a timeline's first page, for scrolling up from a date the scrubber jumped to.
 * Undefined when the list isn't anchored (it already starts at the newest row) or a newer page came back short
 * (nothing newer is left). `top` is the first page's top row; an empty anchored page reads from the anchor.
 */
export function newerCursor(
  firstParam: PageCursor | null,
  top: { at: string; id: string } | undefined,
  pageLength: number,
  pageSize: number,
): PageCursor | undefined {
  if (firstParam === null) return undefined;
  if (firstParam.newer && pageLength < pageSize) return undefined;
  const from = top ?? firstParam;
  return { at: from.at, id: from.id, newer: true };
}

/** What a timeline screen hands its view to show the scrubber. */
export type TimelineScrubber = {
  /** The rail's days, newest first; undefined while loading. */
  days: FeedDay[] | undefined;
  /** The phone's zone, which the days are counted in. */
  timeZone: string;
  /** The day the timeline jumped to, or null when it starts at the newest row. */
  anchorDay: string | null;
  onJump: (day: string) => void;
};
