// Fill this jar (FR-DAY-02, FR-JAR-06; AGENTS "Which jar a new moment joins" point 3). The camera opened
// with `?date=YYYY-MM-DD` adds to that past date's jar instead of the open one. Pure: the caller passes
// today's date in the phone zone and the slots already taken in that day's jar. The server still decides
// "Added later" (rule 6): ensure_jar accepts past dates and refuses future ones, and moments_bi sets
// is_backfilled from the jar's own ends_at.
import { z } from 'zod';

import { slots, type Slot } from '@/theme/tokens';

/** Where a Fill this jar photo is queued: the past date and the zone ensure_jar is called with. */
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
 * The `?date=` route param as a past date to fill, or null for a normal capture. Deep links are untrusted:
 * anything that isn't a real calendar date before `today` (the phone zone's date) is ignored, so today
 * and future dates fall back to the open jar (travel rule unchanged).
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

/** Slots still missing in that day's jar, in jar order: the only ones Fill this jar can add to. */
export function missingSlots(taken: ReadonlySet<Slot>): Slot[] {
  return slots.filter((slot) => !taken.has(slot));
}

/** The slot the camera opens on for Fill this jar: the requested slot if it is missing, else the first
 * missing one. A full jar has none (null): the shutter is disabled. */
export function fillCameraSlot(input: { param: Slot | null; taken: ReadonlySet<Slot> }): Slot | null {
  const { param, taken } = input;
  if (param && !taken.has(param)) return param;
  return missingSlots(taken)[0] ?? null;
}
