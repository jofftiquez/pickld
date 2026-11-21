import { formatShortDate } from '@/lib/format';
import { addDays, localDateIn } from '@/lib/jars';

/**
 * A jar's date ("YYYY-MM-DD") as "Sun, Sep 27" when it is a past day, before today in `tz` (the jar's own
 * zone, as the travel rule reads it); null for today or later (D-156). The day page's banner, Crop and the
 * editor use it to say which day is being filled.
 */
export function pastDayLabel(localDate: string, now: Date, tz: string, locale?: string): string | null {
  if (localDate >= localDateIn(now, tz)) return null;
  // The calendar date itself, whatever the phone zone.
  return formatShortDate(new Date(`${localDate}T12:00:00Z`), 'UTC', locale);
}

/**
 * The date the day stepper treats as Today (Joff): Today's jar date (its own zone, the travel rule), but never
 * after the phone's date, because a day page only opens dates before the phone's (`parseFillDateParam`).
 */
export function stepToday(todayJarDate: string, phoneDate: string): string {
  return todayJarDate < phoneDate ? todayJarDate : phoneDate;
}

/** The day after a day page's `date`: that date, or 'today' once it reaches `today` (see `stepToday`). */
export function nextDay(date: string, today: string): string | 'today' {
  const next = addDays(date, 1);
  return next >= today ? 'today' : next;
}
