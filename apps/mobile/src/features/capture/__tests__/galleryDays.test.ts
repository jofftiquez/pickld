// The in-app gallery's days (FR-CAP-02): grouped by the phone zone's date, the same date the moment gets.
import { captureInfo } from '@/lib/image/captureTime';

import {
  exifFromCreationTime,
  galleryItems,
  itemOffsets,
  needsOlder,
  targetIndex,
  type LibraryPhoto,
} from '../galleryDays';

const MANILA = 'Asia/Manila'; // UTC+8, no DST
const photo = (id: string, iso: string | null): LibraryPhoto => ({
  id,
  width: 3024,
  height: 4032,
  creationTime: iso === null ? null : Date.parse(iso),
});

it('groups by the local date in the phone zone, split at local midnight, not UTC', () => {
  const items = galleryItems(
    [
      photo('a', '2026-11-11T16:30:00Z'), // Nov 12, 00:30 in Manila
      photo('b', '2026-11-11T15:59:00Z'), // Nov 11, 23:59 in Manila
      photo('c', '2026-11-11T01:00:00Z'), // Nov 11, 09:00
    ],
    MANILA,
  );
  expect(
    items.map((i) => (i.kind === 'day' ? `${i.localDate}:${i.count}` : i.photos.map((p) => p.id).join(''))),
  ).toEqual(['2026-11-12:1', 'a', '2026-11-11:2', 'bc']);
});

it('wraps a day into rows of four and puts undated photos last', () => {
  const day = Array.from({ length: 6 }, (_, i) => photo(`p${i}`, `2026-11-08T0${i}:00:00Z`));
  const items = galleryItems([photo('x', null), ...day], MANILA);
  expect(items.map((i) => (i.kind === 'day' ? i.localDate : i.photos.length))).toEqual(['2026-11-08', 4, 2, null, 1]);
  expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
});

it('opens on the day being filled, else the next older day, else nowhere', () => {
  const items = galleryItems(
    [photo('a', '2026-11-13T02:00:00Z'), photo('b', '2026-11-12T02:00:00Z'), photo('c', '2026-11-09T02:00:00Z')],
    MANILA,
  );
  expect(items[targetIndex(items, '2026-11-12') ?? -1]).toMatchObject({ kind: 'day', localDate: '2026-11-12' });
  // Nov 11 has no photos: the grid opens at Nov 9, where Nov 11 would be.
  expect(items[targetIndex(items, '2026-11-11') ?? -1]).toMatchObject({ kind: 'day', localDate: '2026-11-09' });
  expect(targetIndex(items, '2026-11-01')).toBeNull();
});

it('keeps loading until a photo older than the target day is loaded', () => {
  const loaded = [photo('a', '2026-11-13T02:00:00Z'), photo('b', '2026-11-11T17:00:00Z')]; // b: Nov 12, 01:00
  expect(needsOlder(loaded, '2026-11-12', MANILA)).toBe(true);
  expect(needsOlder([...loaded, photo('c', '2026-11-11T15:00:00Z')], '2026-11-12', MANILA)).toBe(false); // Nov 11
  expect(needsOlder([photo('x', null)], '2026-11-12', MANILA)).toBe(true);
});

it('adds up item offsets from the header and row heights', () => {
  const items = galleryItems([photo('a', '2026-11-13T02:00:00Z'), photo('b', '2026-11-12T02:00:00Z')], MANILA);
  expect(itemOffsets(items, 40, 100)).toEqual([0, 40, 140, 180, 280]);
});

describe('exifFromCreationTime', () => {
  it('dates the moment on the same day the grid shows, at the same instant', () => {
    const ms = Date.parse('2026-11-11T16:30:00Z');
    const exif = exifFromCreationTime(ms, MANILA);
    expect(exif).toEqual({ DateTimeOriginal: '2026:11:12 00:30:00', OffsetTimeOriginal: '+08:00' });
    const info = captureInfo(exif, MANILA, new Date('2026-11-14T00:00:00Z'));
    expect(info.localDate).toBe('2026-11-12');
    expect(Date.parse(info.capturedAt)).toBe(ms);
  });

  it('writes negative half-hour offsets', () => {
    expect(exifFromCreationTime(Date.parse('2026-11-12T02:00:00Z'), 'America/St_Johns')).toEqual({
      DateTimeOriginal: '2026:11:11 22:30:00',
      OffsetTimeOriginal: '-03:30',
    });
  });
});
