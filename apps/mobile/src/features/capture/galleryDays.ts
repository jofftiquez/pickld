// The in-app gallery's days (FR-CAP-02): library photos grouped by the local day they were taken, so someone
// filling a past day can see which day they are scrolling through. Pure: the caller passes the phone zone.
import { zoneOffsetMinutes } from '@/lib/image/captureTime';
import { localDateIn } from '@/lib/jars';

/** A photo in the phone's library: its Photos id (`ph://…`), pixel size and when it was taken (ms). */
export type LibraryPhoto = { id: string; width: number; height: number; creationTime: number | null };

/** One list item: a day's header, or a row of up to `GALLERY_COLUMNS` photos. `localDate` null is "No date". */
export type GalleryItem =
  | { kind: 'day'; key: string; localDate: string | null; count: number }
  | { kind: 'row'; key: string; localDate: string | null; photos: LibraryPhoto[] };

export const GALLERY_COLUMNS = 4;

/**
 * The grid's list: each day newest first with its header, then its photos in rows; photos without a date
 * come last. Days are the photo's date in `tz`, the same date `captureInfo` gives the moment.
 */
export function galleryItems(photos: readonly LibraryPhoto[], tz: string): GalleryItem[] {
  const days = new Map<string | null, LibraryPhoto[]>();
  for (const photo of photos) {
    const day = photo.creationTime === null ? null : localDateIn(new Date(photo.creationTime), tz);
    const list = days.get(day);
    if (list) list.push(photo);
    else days.set(day, [photo]);
  }
  const order = [...days.keys()].sort((a, b) => (a === null ? 1 : b === null ? -1 : b.localeCompare(a)));
  const items: GalleryItem[] = [];
  for (const day of order) {
    const list = days.get(day) ?? [];
    const key = day ?? 'none';
    items.push({ kind: 'day', key: `day-${key}`, localDate: day, count: list.length });
    for (let i = 0; i < list.length; i += GALLERY_COLUMNS)
      items.push({ kind: 'row', key: `row-${key}-${i}`, localDate: day, photos: list.slice(i, i + GALLERY_COLUMNS) });
  }
  return items;
}

/**
 * Where the grid opens when filling `target`: that day's header, or when it has no photos, the next older
 * day's (where it would be). Null when no dated day is that old.
 */
export function targetIndex(items: readonly GalleryItem[], target: string): number | null {
  const index = items.findIndex((item) => item.kind === 'day' && item.localDate !== null && item.localDate <= target);
  return index === -1 ? null : index;
}

/** True while every loaded photo is from `target` or later, so the grid loads more before opening there. */
export function needsOlder(photos: readonly LibraryPhoto[], target: string, tz: string): boolean {
  let oldest: number | null = null;
  for (const photo of photos)
    if (photo.creationTime !== null && (oldest === null || photo.creationTime < oldest)) oldest = photo.creationTime;
  return oldest === null || localDateIn(new Date(oldest), tz) >= target;
}

/** Top offset of each item, plus the list's total height at the end. */
export function itemOffsets(items: readonly GalleryItem[], dayHeight: number, rowHeight: number): number[] {
  const offsets = [0];
  for (const item of items) offsets.push((offsets.at(-1) ?? 0) + (item.kind === 'day' ? dayHeight : rowHeight));
  return offsets;
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

/**
 * EXIF-style capture time for a library photo, so `captureInfo` dates it like the picker's EXIF: the
 * creation time as wall time in `tz` with that zone's offset then.
 */
export function exifFromCreationTime(ms: number, tz: string): { DateTimeOriginal: string; OffsetTimeOriginal: string } {
  const offset = zoneOffsetMinutes(tz, ms);
  const w = new Date(ms + offset * 60_000);
  return {
    DateTimeOriginal:
      `${pad(w.getUTCFullYear(), 4)}:${pad(w.getUTCMonth() + 1)}:${pad(w.getUTCDate())} ` +
      `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}`,
    OffsetTimeOriginal: `${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`,
  };
}
