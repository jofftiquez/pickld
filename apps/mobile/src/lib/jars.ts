// Jar logic (FR-JAR-02, FR-JAR-04, FR-JAR-05, D-1). Pure functions over IANA zone names and
// instants; no network, no device clock unless the caller passes one. The server is the referee:
// `ensure_jar` (M2-02) and the jars triggers apply the same rules.
import type { Enums, Tables } from './database.types';

export type DaySlot = Enums<'day_slot'>;

/** The jar fields this module reads. `ends_at` is server-set (D-1) and wins when present. */
export type JarRef = Pick<Tables<'jars'>, 'id' | 'local_date' | 'tz'> & { ends_at?: string | null };

export type JarDecision<J extends JarRef> =
  /** Add to this jar: the open jar (travel rule) or an existing jar for a past date. */
  | { action: 'use'; jar: J }
  /** Westward collision (D-1): today's date in the phone zone already has this closed jar. The server
   * re-zones it to `tz` and moves `ends_at` to `endsAt` (never earlier). The zone changed by
   * definition, so the Time zone banner shows once. */
  | { action: 'rezone'; jar: J; tz: string; endsAt: Date }
  /** No jar yet. `zoneChanged` means the Time zone banner shows once for this new jar. */
  | { action: 'create'; localDate: string; tz: string; zoneChanged: boolean };

const formatters = new Map<string, Intl.DateTimeFormat>();

// Rule 7: IANA names only. Mirrors public.is_valid_tz: "UTC" or Area/Location; offsets such as
// "+08:00" (which newer Intl accepts), abbreviations and posix/ or right/ aliases are refused.
function formatterFor(tz: string): Intl.DateTimeFormat {
  const cached = formatters.get(tz);
  if (cached) return cached;
  if (tz !== 'UTC' && (!tz.includes('/') || tz.startsWith('posix/') || tz.startsWith('right/'))) {
    throw new RangeError(`Expected an IANA time zone name, got "${tz}"`);
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, // throws RangeError for unknown zones
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(tz, formatter);
  return formatter;
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(instant: Date, tz: string): WallClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatterFor(tz).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? NaN,
    month: parts.month ?? NaN,
    day: parts.day ?? NaN,
    hour: (parts.hour ?? NaN) % 24, // some engines print midnight as 24
    minute: parts.minute ?? NaN,
    second: parts.second ?? NaN,
  };
}

/** Zone offset from UTC in ms at an instant (positive east of Greenwich). */
function offsetMs(tz: string, utcMs: number): number {
  const w = wallClock(new Date(utcMs), tz);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - (utcMs - (((utcMs % 1000) + 1000) % 1000));
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function parseLocalDate(localDate: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [NaN, NaN, NaN];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (!match || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${localDate}"`);
  }
  return { year, month, day };
}

function addDays(localDate: string, days: number): string {
  const { year, month, day } = parseLocalDate(localDate);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const HOUR = 3_600_000;

/** The instant a local date starts in a zone, matching Postgres `date::timestamp at time zone tz`:
 * a midnight skipped by a spring-forward gap uses the offset before the change (the day starts at the
 * change), and a repeated midnight uses the offset after the change. */
function startOfLocalDate(localDate: string, tz: string): Date {
  const { year, month, day } = parseLocalDate(localDate);
  const wallAsUtc = Date.UTC(year, month - 1, day);
  // Local midnight lies within UTC-14h..UTC+12h of wallAsUtc; sample the offsets on both sides.
  const offsets = [...new Set([offsetMs(tz, wallAsUtc - 15 * HOUR), offsetMs(tz, wallAsUtc + 15 * HOUR)])];
  const valid = offsets.filter((o) => offsetMs(tz, wallAsUtc - o) === o);
  return new Date(Math.max(...(valid.length > 0 ? valid : offsets).map((o) => wallAsUtc - o)));
}

/** Local calendar date (YYYY-MM-DD) of an instant in an IANA zone. */
export function localDateIn(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/** The "Now" slot at an instant, local time: morning 05:00–11:59, afternoon 12:00–17:59,
 * evening 18:00–23:59, none (null) 00:00–04:59 (FR-JAR-02). */
export function currentSlot(instant: Date, tz: string): DaySlot | null {
  const { hour } = wallClock(instant, tz);
  if (hour < 5) return null;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** When a jar's day ends: the server's `ends_at` when present, otherwise the next local midnight
 * in the jar's own zone (FR-JAR-05). */
export function jarEndsAt(jar: Pick<JarRef, 'local_date' | 'tz' | 'ends_at'>): Date {
  if (jar.ends_at) {
    const endsAt = new Date(jar.ends_at);
    if (Number.isNaN(endsAt.getTime())) throw new RangeError(`Invalid ends_at "${jar.ends_at}"`);
    return endsAt;
  }
  return startOfLocalDate(addDays(jar.local_date, 1), jar.tz);
}

/** A jar is open until its day ends, whatever zone the phone is in now. */
export function isJarOpen(jar: Pick<JarRef, 'local_date' | 'tz' | 'ends_at'>, now: Date): boolean {
  return now.getTime() < jarEndsAt(jar).getTime();
}

/** The open jar at `now`, or null. If several are open, the latest date wins. */
export function findOpenJar<J extends JarRef>(jars: readonly J[], now: Date): J | null {
  let open: J | null = null;
  for (const jar of jars) {
    if (isJarOpen(jar, now) && (!open || jar.local_date > open.local_date)) open = jar;
  }
  return open;
}

/**
 * Which jar a new moment joins (AGENTS "Key logic", FR-JAR-04, FR-JAR-05, D-1).
 * 1. A past `targetDate` (gallery photo from an earlier day, Fill this jar) goes to that date's jar.
 * 2. An open jar wins, even if the phone changed zone (travel rule).
 * 3. Otherwise today's date in the phone zone: an existing jar for that date in another zone is a
 *    westward collision and is re-zoned; else a new jar, flagged when the zone differs from the
 *    previous jar's.
 * Pass server-corrected time as `now` when online (see `serverNow`).
 */
export function chooseJar<J extends JarRef>(input: {
  jars: readonly J[];
  phoneTz: string;
  now: Date;
  targetDate?: string;
}): JarDecision<J> {
  const { jars, phoneTz, now, targetDate } = input;
  const current = chooseCurrentJar(jars, phoneTz, now);
  const currentDate = current.action === 'create' ? current.localDate : current.jar.local_date;
  if (targetDate === undefined) return current;
  parseLocalDate(targetDate); // throws on a malformed date
  if (targetDate >= currentDate) return current;
  const past = jars.find((jar) => jar.local_date === targetDate);
  return past
    ? { action: 'use', jar: past }
    : { action: 'create', localDate: targetDate, tz: phoneTz, zoneChanged: false };
}

function chooseCurrentJar<J extends JarRef>(jars: readonly J[], phoneTz: string, now: Date): JarDecision<J> {
  const open = findOpenJar(jars, now);
  if (open) return { action: 'use', jar: open };

  const today = localDateIn(now, phoneTz);
  const sameDate = jars.find((jar) => jar.local_date === today);
  if (sameDate) {
    if (sameDate.tz === phoneTz) return { action: 'use', jar: sameDate };
    const phoneEnd = startOfLocalDate(addDays(today, 1), phoneTz).getTime();
    const endsAt = new Date(Math.max(jarEndsAt(sameDate).getTime(), phoneEnd));
    return { action: 'rezone', jar: sameDate, tz: phoneTz, endsAt };
  }

  let previous: J | null = null;
  for (const jar of jars) if (!previous || jar.local_date > previous.local_date) previous = jar;
  return { action: 'create', localDate: today, tz: phoneTz, zoneChanged: previous !== null && previous.tz !== phoneTz };
}

/**
 * Server clock minus device clock, in ms (T-101). `serverTime` is a server timestamp (ISO string or
 * HTTP Date header) read when the response arrived at `receivedAt` on the device clock; pass the
 * request's round trip to centre the estimate.
 */
export function serverOffsetMs(serverTime: string | Date, receivedAt: Date, roundTripMs = 0): number {
  const serverMs = new Date(serverTime).getTime();
  if (Number.isNaN(serverMs)) throw new RangeError(`Invalid server time "${String(serverTime)}"`);
  return serverMs + roundTripMs / 2 - receivedAt.getTime();
}

/** The device clock corrected by a server offset from `serverOffsetMs`. */
export function serverNow(offsetMs: number, deviceNow: Date = new Date()): Date {
  return new Date(deviceNow.getTime() + offsetMs);
}
