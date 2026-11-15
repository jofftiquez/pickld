// The in-app gallery's days (FR-CAP-02): grouped by the phone zone's date, the same date the moment gets.
import { captureInfo } from '@/lib/image/captureTime';

import {
  dayRange,
  exifFromCreationTime,
  galleryItems,
  itemOffsets,
  needsOlder,
  photosOnDay,
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

describe('one day of photos (Only Nov 8)', () => {
  it('runs from local midnight to the next, in the phone zone', () => {
    expect(dayRange('2026-11-08', MANILA)).toEqual({
      from: Date.parse('2026-11-07T16:00:00Z'),
      to: Date.parse('2026-11-08T16:00:00Z'),
    });
    // New York's clocks go back on Nov 1, 2026: a 25-hour day, EDT midnight to EST midnight.
    expect(dayRange('2026-11-01', 'America/New_York')).toEqual({
      from: Date.parse('2026-11-01T04:00:00Z'),
      to: Date.parse('2026-11-02T05:00:00Z'),
    });
    // And forward on Mar 8: 23 hours.
    expect(dayRange('2026-03-08', 'America/New_York')).toEqual({
      from: Date.parse('2026-03-08T05:00:00Z'),
      to: Date.parse('2026-03-09T04:00:00Z'),
    });
  });

  it('keeps the photos under that day header: 23:50 and 00:10 on its side of each midnight', () => {
    const photos = [
      photo('after', '2026-11-08T16:10:00Z'), // Nov 9, 00:10 in Manila
      photo('late', '2026-11-08T15:50:00Z'), // Nov 8, 23:50
      photo('early', '2026-11-07T16:10:00Z'), // Nov 8, 00:10
      photo('before', '2026-11-07T15:50:00Z'), // Nov 7, 23:50
      photo('undated', null),
    ];
    expect(photosOnDay(photos, '2026-11-08', MANILA).map((p) => p.id)).toEqual(['late', 'early']);
    const { from, to } = dayRange('2026-11-08', MANILA);
    const inRange = photos.filter((p) => p.creationTime !== null && p.creationTime >= from && p.creationTime < to);
    expect(inRange.map((p) => p.id)).toEqual(['late', 'early']);
    const section = galleryItems(photos, MANILA).filter((i) => i.localDate === '2026-11-08' && i.kind === 'row');
    expect(section.flatMap((i) => (i.kind === 'row' ? i.photos.map((p) => p.id) : []))).toEqual(['late', 'early']);
  });
});
