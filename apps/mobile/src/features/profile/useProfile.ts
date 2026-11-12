// Data for My profile and Other profile (M3-13; FR-SOC-08): the profile, the follow rows between the viewer
// and that person, and their latest jars with live moments and signed thumbnail URLs. Everything is read as
// the viewer, so RLS decides: a blocked or suspended profile comes back as nothing, and only jars and
// moments the viewer may see come back. React Query, so the persisted cache keeps a profile readable offline.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { jarMomentRow, jarRow } from '@/features/jar/jarPage';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { buildProfileJars, profileRow, relationshipOf, type ProfileData, type ProfileJar } from './profileModel';

/** Ten rows of the 3-column grid; older jars stay on My days (owner) until the grid pages (M5). */
export const PROFILE_JAR_LIMIT = 30;
const PHOTO_BATCH = 100; // fn:photo-urls MAX_BATCH

const username = z.string().regex(/^[A-Za-z0-9._]{3,20}$/);

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Thumbnail URLs from `fn:photo-urls`, in batches; a failed batch leaves its tiles on their placeholder. */
async function thumbUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  const batches: string[][] = [];
  for (let i = 0; i < momentIds.length; i += PHOTO_BATCH) batches.push(momentIds.slice(i, i + PHOTO_BATCH));
  const results = await Promise.all(
    batches.map(async (momentIds) => {
      const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
      const parsed = photoUrlsResponse.safeParse(data);
      return error || !parsed.success ? [] : parsed.data.data.moments;
    }),
  );
  return new Map(results.flat().map((m) => [m.id, m.thumb]));
}

export type ProfilePage = ProfileData & { jars: ProfileJar[] };

const followRow = z.object({ reader_id: z.string(), author_id: z.string() });

/** Null when nobody has the username or the viewer may not see them (RLS can't tell them apart, on purpose). */
export async function fetchProfile(name: string, viewerId: string): Promise<ProfilePage | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, lid_color, reader_count, author_count, jar_count')
    .eq('username', name)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const profile = profileRow.parse(data);
  const [follows, jars] = await Promise.all([
    supabase
      .from('follows')
      .select('reader_id, author_id')
      .or(
        `and(reader_id.eq.${viewerId},author_id.eq.${profile.id}),and(reader_id.eq.${profile.id},author_id.eq.${viewerId})`,
      ),
    supabase
      .from('jars')
      .select('id, user_id, local_date, tz, moment_count, visible_count, like_count, comment_count')
      .eq('user_id', profile.id)
      .gt('moment_count', 0)
      .order('local_date', { ascending: false })
      .limit(PROFILE_JAR_LIMIT),
  ]);
  if (follows.error) throw new Error(follows.error.message);
  if (jars.error) throw new Error(jars.error.message);
  const jarRows = z.array(jarRow).parse(jars.data);
  const moments =
    jarRows.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('moments')
          .select(
            'id, jar_id, slot, status, is_private, is_backfilled, caption, captured_at, added_at, edits, like_count',
          )
          .in(
            'jar_id',
            jarRows.map((j) => j.id),
          )
          .eq('status', 'live');
  if (moments.error) throw new Error(moments.error.message);
  const rows = z.array(jarMomentRow.extend({ jar_id: z.string() })).parse(moments.data);
  const urls = await thumbUrls(rows.map((m) => m.id));
  return {
    profile,
    relationship: relationshipOf(z.array(followRow).parse(follows.data), viewerId, profile.id),
    viewerId,
    jars: buildProfileJars(
      jarRows,
      rows.map((m) => ({ ...m, thumbUrl: urls.get(m.id) ?? null, fullUrl: null })),
      viewerId,
    ),
  };
}

export const profileQueryKeys = {
  /** ['profile', username] per AGENTS.md, scoped to the viewer so a sign-out never shows another's cache. */
  profile: (viewerId: string, name: string) => ['profile', name.toLowerCase(), viewerId] as const,
};

/** The profile for `name`; a malformed username is "not available" without a request. */
export function useProfile(name: string | undefined) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const valid = username.safeParse(name).success;
  const query = useQuery({
    queryKey: profileQueryKeys.profile(viewerId ?? '', name ?? ''),
    queryFn: () => fetchProfile(name ?? '', viewerId ?? ''),
    enabled: viewerId !== null && valid,
  });
  return {
    /** Undefined while loading; null when the profile isn't available to this viewer. */
    data: valid ? query.data : null,
    /** The request failed and nothing is cached. */
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
