// My profile and Other profile (FR-SOC-08, FR-JAR-08; designs: Profile, ProfileOther). Rows are read as the
// viewer, so RLS decides what comes back (profiles_others_select drops blocked people; jars_select and
// moments_others_select only return jars and moments the viewer may see). The model filters again with the
// Jar page's rules, so a private or non-live moment never reaches another viewer's grid (rule 9).
import { z } from 'zod';

import { buildJarPage, type JarMoment, type JarMomentRow, type JarRow } from '@/features/jar/jarPage';

export const profileRow = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
  lid_color: z.string(),
  reader_count: z.number(),
  author_count: z.number(),
  /** Jars with at least one moment that isn't removed (FR-JAR-08; kept by the jars triggers). */
  jar_count: z.number(),
});
export type ProfileRow = z.infer<typeof profileRow>;

export type Relationship = {
  /** The viewer reads this person. */
  reading: boolean;
  /** This person reads the viewer: the "Reads you" tag. */
  readsYou: boolean;
};

export type ProfileData = { profile: ProfileRow; relationship: Relationship; viewerId: string };

/** The follow button's state (D-7): Reading unfollows; Read back when they already read you; else Read. */
export type FollowAction = 'read' | 'readBack' | 'reading';

export function followAction({ reading, readsYou }: Relationship): FollowAction {
  return reading ? 'reading' : readsYou ? 'readBack' : 'read';
}

/**
 * The profile with the viewer reading (or no longer reading) it, and its reader count moved by one: the
 * optimistic update (FR-SOC-07). Setting the state it already has changes nothing.
 */
export function withReading<T extends Pick<ProfileData, 'profile' | 'relationship'>>(data: T, reading: boolean): T {
  if (data.relationship.reading === reading) return data;
  return {
    ...data,
    profile: { ...data.profile, reader_count: Math.max(0, data.profile.reader_count + (reading ? 1 : -1)) },
    relationship: { ...data.relationship, reading },
  };
}

/** A moment row with the jar it belongs to, as the profile grids fetch it. */
export type ProfileMoment = JarMoment & { jar_id: string };

/** One tile in the Jars tab: the jar's cover, date and the count the viewer may know (D-9). */
export type ProfileJar = { jar: JarRow; count: number; cover: JarMoment; moments: JarMoment[] };

export function isOwnProfile({ profile, viewerId }: Pick<ProfileData, 'profile' | 'viewerId'>): boolean {
  return profile.id === viewerId;
}

/** Follow rows between the viewer and the profile, either direction, as the relationship. */
export function relationshipOf(
  rows: { reader_id: string; author_id: string }[],
  viewerId: string,
  profileId: string,
): Relationship {
  return {
    reading: rows.some((r) => r.reader_id === viewerId && r.author_id === profileId),
    readsYou: rows.some((r) => r.reader_id === profileId && r.author_id === viewerId),
  };
}

/**
 * The Jars tab: newest day first, each jar with the Jar page's cover and count. A jar with nothing the
 * viewer may see (empty, or only private and non-live moments for someone else) is left out, the same rule
 * as the jar count (FR-JAR-08).
 */
export function buildProfileJars(jars: JarRow[], moments: ProfileMoment[], viewerId: string): ProfileJar[] {
  const byJar = new Map<string, JarMoment[]>();
  for (const m of moments) byJar.set(m.jar_id, [...(byJar.get(m.jar_id) ?? []), m]);
  return [...jars]
    .sort((a, b) => b.local_date.localeCompare(a.local_date))
    .flatMap((jar) => {
      const page = buildJarPage({
        jar,
        author: { username: '', display_name: '' },
        moments: byJar.get(jar.id) ?? [],
        viewerId,
      });
      return page.cover ? [{ jar, count: page.count, cover: page.cover, moments: page.moments }] : [];
    });
}

/** The Moments tab: every shown moment, newest day first and the latest moment of each day first. */
export function profileMoments(jars: ProfileJar[]): { jar: JarRow; moment: JarMoment }[] {
  const takenAt = (m: Pick<JarMomentRow, 'captured_at' | 'added_at'>) => m.captured_at ?? m.added_at;
  return jars.flatMap(({ jar, moments }) =>
    [...moments].sort((a, b) => takenAt(b).localeCompare(takenAt(a))).map((moment) => ({ jar, moment })),
  );
}

/** "312", "1.2k", "48k": readers, authors and jars in the header (ProfileOther shows 1.2k). */
export function compactCount(n: number, locale: string): { value: string; thousands: boolean } {
  if (n < 1000) return { value: new Intl.NumberFormat(locale).format(n), thousands: false };
  const k = Math.floor(n / 100) / 10;
  return {
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: k < 10 ? 1 : 0 }).format(k < 10 ? k : Math.floor(k)),
    thousands: true,
  };
}
