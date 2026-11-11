// Data for the Jar page (M3-07; FR-SOC-03): the jar, its author and its moments with signed photo URLs.
// Everything is read as the viewer, so RLS decides (can_view_jar, moments_others_select): a jar the
// viewer may not see comes back as nothing and the page says it isn't available. React Query, so the
// persisted cache keeps an opened jar readable offline.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { authorRow, jarMomentRow, jarRow, type JarPageData } from './jarPage';

const jarId = z.uuid();

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(z.object({ id: z.string(), full: z.string().nullable(), thumb: z.string().nullable() })),
  }),
});

type PhotoUrls = { full: string | null; thumb: string | null };

/** Signed URLs from `fn:photo-urls`; a failure leaves the photos on their placeholder. */
async function photoUrls(momentIds: string[]): Promise<Map<string, PhotoUrls>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, { full: m.full, thumb: m.thumb }]));
}

/** Null when the jar doesn't exist or the viewer may not see it (RLS can't tell them apart, on purpose). */
export async function fetchJarPage(id: string, viewerId: string): Promise<JarPageData | null> {
  const supabase = getSupabase();
  const { data: jar, error } = await supabase
    .from('jars')
    .select('id, user_id, local_date, tz, moment_count, visible_count, like_count, comment_count')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!jar) return null;
  const [author, moments] = await Promise.all([
    supabase.from('profiles').select('username, display_name').eq('id', jar.user_id).maybeSingle(),
    supabase
      .from('moments')
      .select('id, slot, status, is_private, is_backfilled, caption, captured_at, added_at, edits, like_count')
      .eq('jar_id', id)
      .eq('status', 'live'),
  ]);
  if (author.error) throw new Error(author.error.message);
  if (moments.error) throw new Error(moments.error.message);
  if (!author.data) return null;
  const rows = z.array(jarMomentRow).parse(moments.data);
  const urls = await photoUrls(rows.map((m) => m.id));
  return {
    jar: jarRow.parse(jar),
    author: authorRow.parse(author.data),
    moments: rows.map((m) => ({
      ...m,
      thumbUrl: urls.get(m.id)?.thumb ?? null,
      fullUrl: urls.get(m.id)?.full ?? null,
    })),
    viewerId,
  };
}

export const jarPageQueryKeys = {
  /** ['jarPage', viewerId, jarId] */
  jar: (viewerId: string, id: string) => ['jarPage', viewerId, id] as const,
};

/** The jar page for `id`; a malformed id is "not available" without a request. */
export function useJarPage(id: string | undefined) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const valid = jarId.safeParse(id).success;
  const query = useQuery({
    queryKey: jarPageQueryKeys.jar(viewerId ?? '', id ?? ''),
    queryFn: () => fetchJarPage(id ?? '', viewerId ?? ''),
    enabled: viewerId !== null && valid,
  });
  return {
    /** Undefined while loading; null when the jar isn't available to this viewer. */
    data: valid ? query.data : null,
    /** The request failed and nothing is cached. */
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
