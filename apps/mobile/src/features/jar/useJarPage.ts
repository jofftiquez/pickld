// Data for the Jar page (M3-07; FR-SOC-03): the jar, its author and its moments with signed photo URLs.
// Everything is read as the viewer, so RLS decides (can_view_jar, moments_others_select): a jar the
// viewer may not see comes back as nothing and the page says it isn't available. React Query, so the
// persisted cache keeps an opened jar readable offline.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { authorRow, jarMomentRow, jarRow, type JarPageData, type JarRow, type Liked } from './jarPage';

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

/**
 * The jar row as the viewer. A jar they may not open (not yet published, D-48) still has moments they may
 * see; `moment_jar` (0067) gives Moment detail its zone and owner then, without its counts, marked `open:
 * false` so the Jar page never shows it (FR-PUB-02, D-67).
 */
async function fetchJarRow(id: string): Promise<JarRow | null> {
  const supabase = getSupabase();
  const { data: jar, error } = await supabase
    .from('jars')
    .select('id, user_id, local_date, tz, moment_count, visible_count, like_count, comment_count')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (jar) return jarRow.parse(jar);
  const fallback = await supabase.rpc('moment_jar', { p_jar: id });
  if (fallback.error) throw new Error(fallback.error.message);
  const row = z.array(jarRow).parse(fallback.data)[0];
  return row ? { ...row, open: false } : null;
}

/** Null when the jar doesn't exist or the viewer may not see it (RLS can't tell them apart, on purpose). */
export async function fetchJarPage(id: string, viewerId: string): Promise<JarPageData | null> {
  const supabase = getSupabase();
  const jar = await fetchJarRow(id);
  if (!jar) return null;
  const [author, moments] = await Promise.all([
    supabase.from('profiles').select('username, display_name, lid_color').eq('id', jar.user_id).maybeSingle(),
    supabase
      .from('moments')
      .select(
        'id, slot, status, visibility, is_backfilled, caption, captured_at, added_at, edits, like_count, comment_count',
      )
      .eq('jar_id', id)
      .eq('status', 'live'),
  ]);
  if (author.error) throw new Error(author.error.message);
  if (moments.error) throw new Error(moments.error.message);
  if (!author.data) return null;
  const rows = z.array(jarMomentRow).parse(moments.data);
  const [urls, liked] = await Promise.all([photoUrls(rows.map((m) => m.id)), fetchLiked(viewerId, id, rows)]);
  return {
    jar,
    author: authorRow.parse(author.data),
    moments: rows.map((m) => ({
      ...m,
      thumbUrl: urls.get(m.id)?.thumb ?? null,
      fullUrl: urls.get(m.id)?.full ?? null,
    })),
    viewerId,
    liked,
  };
}

const likedRow = z.object({ target: z.enum(['jar', 'moment']), target_id: z.string() });

/** The viewer's own likes on the jar and its moments. */
async function fetchLiked(viewerId: string, id: string, moments: { id: string }[]): Promise<Liked> {
  const { data, error } = await getSupabase()
    .from('reactions')
    .select('target, target_id')
    .eq('user_id', viewerId)
    .in('target_id', [id, ...moments.map((m) => m.id)]);
  if (error) throw new Error(error.message);
  const rows = z.array(likedRow).parse(data);
  return {
    jar: rows.some((r) => r.target === 'jar' && r.target_id === id),
    moments: rows.filter((r) => r.target === 'moment').map((r) => r.target_id),
  };
}

export const jarPageQueryKeys = {
  /** ['jarPage', viewerId, jarId] */
  jar: (viewerId: string, id: string) => ['jarPage', viewerId, id] as const,
};

/**
 * The jar page for `id`; a malformed id is "not available" without a request. Only Moment detail passes
 * `fromMoment`: it may read a jar the viewer can't open for the moments in it they may see (D-67).
 */
export function useJarPage(id: string | undefined, { fromMoment = false }: { fromMoment?: boolean } = {}) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const valid = jarId.safeParse(id).success;
  const query = useQuery({
    queryKey: jarPageQueryKeys.jar(viewerId ?? '', id ?? ''),
    queryFn: () => fetchJarPage(id ?? '', viewerId ?? ''),
    enabled: viewerId !== null && valid,
  });
  return {
    /** Undefined while loading; null when the jar isn't available to this viewer. */
    data: valid ? (!fromMoment && query.data?.jar.open === false ? null : query.data) : null,
    /** The request failed and nothing is cached. */
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
