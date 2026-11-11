// Capture time and target jar date for a photo (FR-CAP-02, D-1). Pure: the caller passes the
// phone's IANA zone and `now`. The capture time is kept as an ISO string with its offset
// (`moments.captured_at`); it never decides "Added later", the server does (AGENTS rule 6).
import { z } from 'zod';

import { localDateIn } from '../jars';

export type CaptureSource =
  /** EXIF DateTimeOriginal with OffsetTimeOriginal: the photo's own local date. */
  | 'exif-offset'
  /** EXIF DateTimeOriginal without an offset: read as wall time in the phone's zone. */
  | 'exif-phone-zone'
  /** No usable EXIF time (or one in the future): taken now. */
  | 'now';

export type CaptureInfo = {
  /** ISO 8601 with offset, second precision, e.g. `2026-11-09T23:45:10+08:00`. */
  capturedAt: string;
  /** The jar date (YYYY-MM-DD) the photo belongs to. Pass it to `chooseJar` as `targetDate`: a past
   * date goes to that date's jar, today's date or later joins the current jar. */
  localDate: string;
  source: CaptureSource;
};

const optionalText = z.string().optional().catch(undefined);

/** The EXIF fields read here, from `readImageMetadata` or an image picker's `exif` object. Anything
 * else (or a non-object) is ignored. */
const ExifTimesSchema = z
  .object({ DateTimeOriginal: optionalText, OffsetTimeOriginal: optionalText })
  .catch({ DateTimeOriginal: undefined, OffsetTimeOriginal: undefined });

const MINUTE = 60_000;

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** `YYYY:MM:DD HH:MM:SS` (EXIF), also accepting `-` date separators and a `T`. Rejects impossible
 * dates and the all-zero "unknown" value. */
function parseExifDateTime(value: string | undefined): Wall | null {
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value?.trim() ?? '');
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const valid =
    year >= 1900 &&
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute &&
    d.getUTCSeconds() === second;
  return valid ? { year, month, day, hour, minute, second } : null;
}

/** `+HH:MM` / `-HH:MM` in minutes east of UTC, or null (EXIF writes `   :  ` when unknown). */
function parseExifOffset(value: string | undefined): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!m) return null;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes > 0)) return null;
  return (m[1] === '-' ? -1 : 1) * (hours * 60 + minutes);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Offset of an IANA zone from UTC in minutes at an instant. */
function zoneOffsetMinutes(tz: string, ms: number): number {
  let formatter = formatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, formatter);
  }
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter.formatToParts(new Date(ms)))
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  const wallAsUtc = Date.UTC(
    p.year ?? NaN,
    (p.month ?? NaN) - 1,
    p.day ?? NaN,
    (p.hour ?? NaN) % 24,
    p.minute ?? NaN,
    p.second ?? NaN,
  );
  return Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / MINUTE);
}

function isoWithOffset(ms: number, offsetMinutes: number): string {
  const w = new Date(Math.floor(ms / 1000) * 1000 + offsetMinutes * MINUTE);
  const sign = offsetMinutes < 0 ? '-' : '+';
  return (
    `${pad(w.getUTCFullYear(), 4)}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}` +
    `T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}` +
    `${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`
  );
}

const wallMs = (w: Wall) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/**
 * When a photo was taken and which jar date it targets.
 * - EXIF time with offset: that instant; the date is the photo's own local date.
 * - EXIF time without offset: wall time in `phoneTz` (a time skipped by a DST gap shifts forward).
 * - Missing, invalid or future EXIF time: `now` in `phoneTz` (a camera, or a wrong camera clock).
 * Throws RangeError when `phoneTz` is not an IANA zone name (rule 7).
 */
export function captureInfo(exif: unknown, phoneTz: string, now: Date): CaptureInfo {
  const today = localDateIn(now, phoneTz); // validates phoneTz
  const nowMs = now.getTime();
  const fields = ExifTimesSchema.parse(exif ?? {});
  const wall = parseExifDateTime(fields.DateTimeOriginal);

  if (wall) {
    const photoOffset = parseExifOffset(fields.OffsetTimeOriginal);
    if (photoOffset !== null) {
      const ms = wallMs(wall) - photoOffset * MINUTE;
      if (ms <= nowMs) {
        return {
          capturedAt: isoWithOffset(ms, photoOffset),
          localDate: `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`,
          source: 'exif-offset',
        };
      }
    } else {
      const guess = wallMs(wall);
      const o1 = zoneOffsetMinutes(phoneTz, guess);
      const ms1 = guess - o1 * MINUTE;
      const o2 = zoneOffsetMinutes(phoneTz, ms1);
      let ms = ms1;
      if (o2 !== o1) {
        const ms2 = guess - o2 * MINUTE;
        // Valid with the second offset, or a DST gap: take the later instant (shift forward).
        ms = zoneOffsetMinutes(phoneTz, ms2) === o2 ? ms2 : Math.max(ms1, ms2);
      }
      if (ms <= nowMs) {
        return {
          capturedAt: isoWithOffset(ms, zoneOffsetMinutes(phoneTz, ms)),
          localDate: localDateIn(new Date(ms), phoneTz),
          source: 'exif-phone-zone',
        };
      }
    }
  }

  return { capturedAt: isoWithOffset(nowMs, zoneOffsetMinutes(phoneTz, nowMs)), localDate: today, source: 'now' };
}
