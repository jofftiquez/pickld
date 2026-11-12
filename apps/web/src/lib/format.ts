import { slots } from '@/theme/tokens';

import type { PublicMoment } from './publicPage';

// local_date is the jar's own calendar date (YYYY-MM-DD in its tz); format it as that date, in UTC, so
// the visitor's zone never shifts it.
const asDate = (localDate: string) => new Date(`${localDate}T00:00:00Z`);

export const weekday = (localDate: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(asDate(localDate));

export const longDate = (localDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    asDate(localDate),
  );

export const bySlot = (moments: PublicMoment[]) =>
  [...moments].sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));

/** The newest caption, as on the app's Jar page and share card. */
export function newestCaption(moments: PublicMoment[]): string | null {
  const captioned = moments.filter((m) => (m.caption ?? '').trim() !== '');
  captioned.sort((a, b) => b.added_at.localeCompare(a.added_at) || slots.indexOf(b.slot) - slots.indexOf(a.slot));
  return captioned[0]?.caption?.trim() ?? null;
}
