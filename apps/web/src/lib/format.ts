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

/** The cover first (D-56; `public_jar` resolves it over the Everyone moments), then slot order. */
export function coverFirst(moments: PublicMoment[], coverId: string | null | undefined): PublicMoment[] {
  const sorted = bySlot(moments);
  const cover = sorted.find((m) => m.id === coverId);
  return cover ? [cover, ...sorted.filter((m) => m !== cover)] : sorted;
}

/**
 * The caption under the photos, as on the app's Jar page: the cover's when there is a cover, else the newest
 * caption (a page from before 0069 has no cover).
 */
export function jarCaption(moments: PublicMoment[], coverId: string | null | undefined): string | null {
  const cover = moments.find((m) => m.id === coverId);
  if (cover) return cover.caption?.trim() ? cover.caption.trim() : null;
  return newestCaption(moments);
}

/** The newest caption, as on the app's share card. */
export function newestCaption(moments: PublicMoment[]): string | null {
  const captioned = moments.filter((m) => (m.caption ?? '').trim() !== '');
  captioned.sort((a, b) => b.added_at.localeCompare(a.added_at) || slots.indexOf(b.slot) - slots.indexOf(a.slot));
  return captioned[0]?.caption?.trim() ?? null;
}
