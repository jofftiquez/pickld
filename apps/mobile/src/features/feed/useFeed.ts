// Data for the Jars tab (M3-04; FR-SOC-01, NFR-PERF-02, NFR-OFF-03): `feed_page` 20 jars at a time with
// thumbnail URLs from `fn:photo-urls` (thumbnails only, never full photos) and the previews' edits (D-96),
// and `feed_authors` for the
// avatar row. Both are React Query queries, so the persisted cache (src/lib/queryClient.ts) keeps the last
// feed readable offline.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchMomentRenders } from '@/features/moment/momentRenders';
import { useAuthStore } from '@/lib/authStore';
import { refetchFirstPage } from '@/lib/firstPage';
import { getSupabase } from '@/lib/supabase';

import { anchorCursor, feedAuthorRow, feedRow, nextCursor, type FeedCursor, type FeedPage } from './feedModel';
import { rememberPlaceholders } from '@/lib/image/photoPlaceholders';

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Thumbnail URLs for a page's previews; a failure leaves the cells without a photo. */
async function thumbUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  rememberPlaceholders(data);
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, m.thumb]));
}

/** One page of jars from the feed, or from Discover (`discover_jars_page`, 0070), which returns the same rows. */
export async function fetchFeedPage(
  cursor: FeedCursor | null,
  rpc: 'feed_page' | 'discover_jars_page' = 'feed_page',
): Promise<FeedPage> {
  const { data, error } = await getSupabase().rpc(rpc, cursor ? { cursor_at: cursor.at, cursor_id: cursor.id } : {});
  if (error) throw new Error(error.message);
  const rows = z.array(feedRow).parse(data);
  const ids = rows.flatMap((r) => r.preview_moment_ids);
  // The previews' edits, read per page as the viewer (D-96); a moment they can't read stays plain.
  const [urls, renders] = await Promise.all([thumbUrls(ids), fetchMomentRenders(ids)]);
  return {
    jars: rows.map((r) => ({
      ...r,
      previewUrls: r.preview_moment_ids.map((id) => urls.get(id) ?? null),
      previewRenders: Object.fromEntries(
        r.preview_moment_ids.flatMap((id) => {
          const render = renders.get(id);
          return render ? [[id, render] as const] : [];
        }),
      ),
    })),
    nextCursor: nextCursor(rows),
  };
}

/** The avatar row; the Moments timeline also reads it to know whether the user reads anybody. */
export async function fetchFeedAuthors() {
  const { data, error } = await getSupabase().rpc('feed_authors');
  if (error) throw new Error(error.message);
  return z.array(feedAuthorRow).parse(data);
}

export const feedQueryKeys = {
  /** ['feed', userId]: every loaded page, newest first; an anchored list (`from`) is cached on its own. */
  feed: (userId: string, from?: string) => (from ? (['feed', userId, { from }] as const) : (['feed', userId] as const)),
  authors: (userId: string) => ['feedAuthors', userId] as const,
};

/** The Jars feed, newest first, or from `from` back (see `anchorCursor`). */
export function useFeed(from?: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const enabled = userId !== null;
  const queryClient = useQueryClient();
  const queryKey = feedQueryKeys.feed(userId ?? '', from);
  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: from ? anchorCursor(from) : null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
  const authors = useQuery({ queryKey: feedQueryKeys.authors(userId ?? ''), queryFn: fetchFeedAuthors, enabled });
  // Marks the feed seen on the server clock. The rings and "new" flags already on screen stay until the
  // next refresh, so the reader still sees what was new when they opened the tab.
  const markSeen = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc('mark_feed_seen');
      if (error) throw new Error(error.message);
    },
  });
  return {
    userId,
    jars: feed.data?.pages.flatMap((p) => p.jars),
    authors: authors.data,
    isLoading: feed.isLoading,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
    /** Pull to refresh and the far back-to-top: the newest page only (`refetchFirstPage`). */
    refresh: async () => {
      await Promise.all([refetchFirstPage(queryClient, queryKey), authors.refetch()]);
    },
    markSeen: () => markSeen.mutate(),
  };
}
