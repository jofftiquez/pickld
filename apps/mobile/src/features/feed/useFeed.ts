// Data for the Jars tab (M3-04; FR-SOC-01, NFR-PERF-02, NFR-OFF-03): `feed_page` 20 jars at a time with
// thumbnail URLs from `fn:photo-urls` (thumbnails only, never full photos), and `feed_authors` for the
// avatar row. Both are React Query queries, so the persisted cache (src/lib/queryClient.ts) keeps the last
// feed readable offline.
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { feedAuthorRow, feedRow, nextCursor, type FeedCursor, type FeedPage } from './feedModel';

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Thumbnail URLs for a page's previews; a failure leaves the cells without a photo. */
async function thumbUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, m.thumb]));
}

export async function fetchFeedPage(cursor: FeedCursor | null): Promise<FeedPage> {
  const { data, error } = await getSupabase().rpc(
    'feed_page',
    cursor ? { cursor_at: cursor.at, cursor_id: cursor.id } : {},
  );
  if (error) throw new Error(error.message);
  const rows = z.array(feedRow).parse(data);
  const urls = await thumbUrls(rows.flatMap((r) => r.preview_moment_ids));
  return {
    jars: rows.map((r) => ({ ...r, previewUrls: r.preview_moment_ids.map((id) => urls.get(id) ?? null) })),
    nextCursor: nextCursor(rows),
  };
}

async function fetchFeedAuthors() {
  const { data, error } = await getSupabase().rpc('feed_authors');
  if (error) throw new Error(error.message);
  return z.array(feedAuthorRow).parse(data);
}

export const feedQueryKeys = {
  /** ['feed', userId]: every loaded page. */
  feed: (userId: string) => ['feed', userId] as const,
  authors: (userId: string) => ['feedAuthors', userId] as const,
};

export function useFeed() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const enabled = userId !== null;
  const feed = useInfiniteQuery({
    queryKey: feedQueryKeys.feed(userId ?? ''),
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: null as FeedCursor | null,
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
    isRefreshing: feed.isRefetching && !feed.isFetchingNextPage,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
    refresh: async () => {
      await Promise.all([feed.refetch(), authors.refetch()]);
    },
    markSeen: () => markSeen.mutate(),
  };
}
