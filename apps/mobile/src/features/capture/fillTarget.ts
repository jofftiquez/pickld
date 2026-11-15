// Filling a past day (FR-DAY-02, FR-JAR-06; AGENTS "Which jar a new moment joins" point 3): a gallery photo
// from that day's page (`/day/YYYY-MM-DD`, D-153) or from Photos' Share goes into that past date's jar
// instead of the open one. Pure: the caller passes today's date in the phone zone. The server still decides
// "Added later" (rule 6): ensure_jar accepts past dates and refuses future ones, and moments_bi sets
// is_backfilled from the jar's own ends_at.
import { z } from 'zod';

/** Where a photo for a past day is queued: the past date and the zone ensure_jar is called with. */
export type FillTarget = { localDate: string; tz: string };

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  });

/**
 * A `date` route param as a past date, or null. Deep links are untrusted: anything that isn't a real
 * calendar date before `today` (the phone zone's date) is ignored, so today and future dates fall back to
 * Today and the open jar (travel rule unchanged).
 */
export function parseFillDateParam(raw: unknown, today: string): string | null {
  const value = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  const parsed = dateParam.safeParse(value);
  return parsed.success && parsed.data < today ? parsed.data : null;
}

/** The queue target for a past date: that date, in its jar's zone, or the phone's zone when the day has
 * no jar yet (ensure_jar then creates it there). */
export function fillTarget(localDate: string, dayJar: { tz: string } | null | undefined, phoneTz: string): FillTarget {
  return { localDate, tz: dayJar?.tz ?? phoneTz };
}
