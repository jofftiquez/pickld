// The moment a moment thread is about (0068; D-51; design: Comments with a moment header): its owner,
// slot, caption, its own comment count, its edits, capture time and jar zone (for stamps), and signed
// photo URLs, so the thread opens with the whole moment drawn as on Moment detail (D-84). Read as the
// viewer, so RLS decides
// (can_view_moment): a moment they may not see, or one outside the route's jar, is "not available". It
// doesn't need the jar, which a reader may not see yet (a moment is visible before Publish jar, D-48).
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { slots } from '@/theme/tokens';

import { commentsQueryKeys } from './useComments';

const idParam = z.uuid();

const momentRow = z.object({
  id: z.string(),
  jar_id: z.string(),
  user_id: z.string(),
  slot: z.enum(slots),
  caption: z.string().nullable(),
  comment_count: z.number(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  edits: z.unknown(),
  author: z.object({ display_name: z.string(), avatar_path: z.string().nullish() }).nullable(),
});

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(z.object({ id: z.string(), full: z.string().nullable(), thumb: z.string().nullable() })),
  }),
});

const zoneRow = z.object({ tz: z.string() });

export type CommentMoment = z.infer<typeof momentRow> & {
  thumbUrl: string | null;
  fullUrl: string | null;
  /** The jar's IANA zone, for auto stamps; null if it couldn't be read (stamps then show their art). */
  tz: string | null;
};

/** Null when the moment doesn't exist, the viewer may not see it, or it isn't in `jarId`. */
export async function fetchCommentMoment(jarId: string, momentId: string): Promise<CommentMoment | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('moments')
    .select(
      'id, jar_id, user_id, slot, caption, comment_count, captured_at, added_at, edits, author:profiles(display_name, avatar_path)',
    )
    .eq('id', momentId)
    .eq('status', 'live')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const moment = momentRow.parse(data);
  if (moment.jar_id !== jarId) return null;
  // A failed signing leaves the photo on its placeholder. The zone comes from `moment_jar` (0067), which
  // answers whenever the viewer may see a live moment in the jar, even before it is published (D-67).
  const [urls, zone] = await Promise.all([
    supabase.functions.invoke<unknown>('photo-urls', { body: { momentIds: [moment.id] } }),
    supabase.rpc('moment_jar', { p_jar: jarId }),
  ]);
  const parsed = photoUrlsResponse.safeParse(urls.data);
  const signed = parsed.success ? parsed.data.data.moments.find((m) => m.id === moment.id) : undefined;
  const tz = zone.error ? null : (z.array(zoneRow).safeParse(zone.data).data?.[0]?.tz ?? null);
  return { ...moment, thumbUrl: signed?.thumb ?? null, fullUrl: signed?.full ?? null, tz };
}

export function useCommentMoment(jarId: string | undefined, momentId: string | undefined) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const valid = idParam.safeParse(jarId).success && idParam.safeParse(momentId).success;
  const query = useQuery({
    // Under the thread's key, so refreshing the thread refreshes the count too. 'moment-full' (D-84): the
    // row now carries edits and the full photo, so a persisted row from before isn't read back.
    queryKey: [...commentsQueryKeys.thread(viewerId ?? '', jarId ?? '', momentId ?? null), 'moment-full'],
    queryFn: () => fetchCommentMoment(jarId ?? '', momentId ?? ''),
    enabled: viewerId !== null && valid && momentId !== undefined,
  });
  return {
    /** Undefined while loading; null when not available to this viewer. */
    data: valid ? query.data : null,
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
