// Full jar celebration and Sticker unlocked (FR-JAR-07, FR-STK-05). Pure: which of the two to show next
// on Today, given the open jar, the user's milestones and what this phone has already shown
// (see useCelebrations for the storage and the navigation).
import { slots } from '@/theme/tokens';

import type { ServerMoment } from './todayGrid';

/** The five milestones (0010, D-8), in the order their Sticker unlocked screens are shown. */
export const milestoneKeys = ['first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year'] as const;
export type MilestoneKey = (typeof milestoneKeys)[number];

/** Jars and milestones this phone already celebrated (or found already there, see `nextCelebration`). */
export type CelebrationsSeen = { jars: readonly string[]; milestones: readonly string[] };

export type Celebration =
  { kind: 'fullJar'; jarId: string; localDate: string } | { kind: 'sticker'; key: MilestoneKey };

/**
 * Moments that fill the jar: every server moment that isn't removed, so checking (and uploading) count as
 * well as live. This is the server's owner count (jars.moment_count, D-9), which also writes the full_jar
 * notification and grants the milestones, so the app and the server agree on when a jar is full.
 * Queued photos that haven't reached the server don't count yet.
 */
export function filledCount(moments: readonly Pick<ServerMoment, 'status'>[]): number {
  return moments.filter((m) => m.status !== 'removed').length;
}

export function isJarFull(moments: readonly Pick<ServerMoment, 'status'>[]): boolean {
  return filledCount(moments) >= slots.length;
}

/**
 * What to show next and what to remember.
 * - `seen` null means this phone has no record for the user yet (a new install, or the first launch with
 *   this feature): everything already there is recorded as seen and nothing is shown, so an old full jar or
 *   a milestone earned long ago doesn't pop up on launch.
 * - Otherwise the Full jar celebration comes first, once per jar; then one Sticker unlocked screen per
 *   milestone the phone hasn't seen, once each, in `milestoneKeys` order.
 * `seen` in the result is the record to store; it equals the input when nothing changed.
 */
export function nextCelebration(input: {
  seen: CelebrationsSeen | null;
  jar: { id: string; localDate: string } | null;
  moments: readonly Pick<ServerMoment, 'status'>[];
  milestones: readonly string[];
}): { show: Celebration | null; seen: CelebrationsSeen } {
  const { seen, jar, moments, milestones } = input;
  const earned = milestoneKeys.filter((key) => milestones.includes(key));
  const full = jar !== null && isJarFull(moments);
  if (seen === null) {
    return { show: null, seen: { jars: full ? [jar.id] : [], milestones: earned } };
  }
  if (full && !seen.jars.includes(jar.id)) {
    return {
      show: { kind: 'fullJar', jarId: jar.id, localDate: jar.localDate },
      seen: { ...seen, jars: [...seen.jars, jar.id] },
    };
  }
  const key = earned.find((k) => !seen.milestones.includes(k));
  if (key) {
    return { show: { kind: 'sticker', key }, seen: { ...seen, milestones: [...seen.milestones, key] } };
  }
  return { show: null, seen };
}
