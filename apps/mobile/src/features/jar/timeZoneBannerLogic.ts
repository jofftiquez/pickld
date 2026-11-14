// Time zone banner rule (FR-JAR-05, AGENTS rule 7). Pure: the caller passes the jars and the
// acknowledgements read from the phone (see useTimeZoneBanner).
import { normalizeZone } from '@/lib/jars';

export type BannerJar = { id: string; tz: string; localDate: string };

/** An IANA Area/Location name or "UTC"; offsets ("+08:00"), abbreviations and aliases are refused, and so
 * are the fixed-offset Etc/GMT±N names, whose sign reads backwards ("Etc/GMT-8" is UTC+8). */
function isIanaZone(tz: string): boolean {
  return normalizeZone(tz) === tz && !tz.startsWith('Etc/');
}

/**
 * The jar started in another zone than the user's previous jar. `previousTz` is undefined when it isn't
 * known (offline with an old cache) and null when there is no earlier jar; neither is a change.
 */
export function zoneChanged(jarTz: string, previousTz: string | null | undefined): boolean {
  if (previousTz === null || previousTz === undefined) return false;
  if (!isIanaZone(jarTz) || !isIanaZone(previousTz)) return false;
  return jarTz !== previousTz;
}

/** Show the banner once per zone change: this jar's zone differs and the user hasn't tapped Got it on it. */
export function shouldShowTimeZoneBanner(input: {
  jar: BannerJar | null;
  previousTz: string | null | undefined;
  acknowledged: ReadonlySet<string>;
}): boolean {
  const { jar, previousTz, acknowledged } = input;
  if (!jar) return false;
  return zoneChanged(jar.tz, previousTz) && !acknowledged.has(jar.id);
}

/** A readable place for an IANA zone: its last segment with spaces ("America/Argentina/Buenos_Aires" →
 * "Buenos Aires"); "UTC" stays as is. Never an offset. */
export function zoneCity(tz: string): string {
  if (!isIanaZone(tz)) throw new RangeError(`Expected an IANA time zone name, got "${tz}"`);
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}
