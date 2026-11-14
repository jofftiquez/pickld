// Data for the Moments tab (QA round 1, piece 5; FR-SOC-01, FR-SOC-05, NFR-OFF-03): `moments_feed_page`
// (0067) 20 moments at a time with signed photo URLs from `fn:photo-urls`, and `feed_authors` to know
// whether the user reads anybody (the Find people card, D-53). React Query, so the persisted cache keeps
// the last timeline readable offline. Likes reuse the Jar page's request (`sendLike`) and its per-target
// ordering, with the optimistic change made in this timeline's cache.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { z } from 'zod';

import { anchorCursor } from '@/features/feed/feedModel';
import { fetchFeedAuthors, feedQueryKeys } from '@/features/feed/useFeed';
import { keyOf, sendLike, serialize } from '@/features/jar/useLike';
import { newerCursor, type PageCursor } from '@/features/scrubber/scrubberModel';
import { useAuthStore } from '@/lib/authStore';
import { refetchFirstPage } from '@/lib/firstPage';
import { getSupabase } from '@/lib/supabase';

import {
  MOMENTS_PAGE_SIZE,
  momentsFeedRow,
  nextMomentsCursor,
  withMomentLike,
  type FeedMoment,
  type MomentsPage,
} from './momentsModel';
import { rememberPlaceholders } from '@/lib/image/photoPlaceholders';

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(
      z.object({
        id: z.string(),
        full: z.string().nullable(),
        medium: z.string().nullable().optional(),
        thumb: z.string().nullable(),
      }),
    ),
  }),
});

type PhotoUrls = { full: string | null; medium: string | null; thumb: string | null };

/** Signed URLs for a page's photos; a failure leaves the photos on their placeholder. */
async function photoUrls(momentIds: string[]): Promise<Map<string, PhotoUrls>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  rememberPlaceholders(data);
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(
    parsed.data.data.moments.map((m) => [m.id, { full: m.full, medium: m.medium ?? null, thumb: m.thumb }]),
  );
}

/**
 * One page of moments from the timeline, or from Discover (`discover_moments_page`, 0070), which returns the same
 * rows. A `newer` cursor reads the timeline's rows just above it (`moments_feed_page_newer`, 0140), newest first.
 */
export async function fetchMomentsPage(
  cursor: PageCursor | null,
  rpc: 'moments_feed_page' | 'discover_moments_page' = 'moments_feed_page',
): Promise<MomentsPage> {
  const { data, error } = cursor?.newer
    ? await getSupabase().rpc('moments_feed_page_newer', { cursor_at: cursor.at, cursor_id: cursor.id })
    : await getSupabase().rpc(rpc, cursor ? { cursor_at: cursor.at, cursor_id: cursor.id } : {});
  if (error) throw new Error(error.message);
  const rows = z.array(momentsFeedRow).parse(data);
  if (cursor?.newer) rows.reverse();
  const urls = await photoUrls(rows.map((r) => r.moment_id));
  return {
    moments: rows.map((r) => ({
      ...r,
      fullUrl: urls.get(r.moment_id)?.full ?? null,
      mediumUrl: urls.get(r.moment_id)?.medium ?? null,
      thumbUrl: urls.get(r.moment_id)?.thumb ?? null,
    })),
    nextCursor: nextMomentsCursor(rows),
  };
}

export const momentsQueryKeys = {
  /** ['momentsFeed', userId]: every loaded page, newest first; an anchored list (`from`) is cached on its own. */
  feed: (userId: string, from?: string) =>
    from ? (['momentsFeed', userId, { from }] as const) : (['momentsFeed', userId] as const),
};

type Pages = InfiniteData<MomentsPage, PageCursor | null>;

/** Like requests still running per moment; the jar page is read again once a moment has none left. */
const inFlight = new Map<string, number>();

/** An anchored list leaves the (persisted) cache five minutes after the screen lets it go. */
const ANCHORED_GC_MS = 5 * 60 * 1000;

/**
 * The Moments timeline, newest first, or from `from` back (see `anchorCursor`). An anchored timeline (the date
 * scrubber's jump) also pages up toward the newest row (`fetchPreviousPage`), and leaves the cache soon after.
 */
export function useMomentsFeed(from?: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const enabled = userId !== null;
  const queryClient = useQueryClient();
  const queryKey = momentsQueryKeys.feed(userId ?? '', from);
  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchMomentsPage(pageParam),
    initialPageParam: (from ? anchorCursor(from) : null) as PageCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    getPreviousPageParam: (first, _pages, firstParam) => {
      const top = first.moments[0];
      return newerCursor(
        firstParam,
        top && { at: top.added_at, id: top.moment_id },
        first.moments.length,
        MOMENTS_PAGE_SIZE,
      );
    },
    gcTime: from ? ANCHORED_GC_MS : undefined,
    enabled,
  });
  const authors = useQuery({ queryKey: feedQueryKeys.authors(userId ?? ''), queryFn: fetchFeedAuthors, enabled });

  const setLiked = (momentId: string, liked: boolean) =>
    queryClient.setQueryData<Pages>(queryKey, (data) =>
      data ? { ...data, pages: withMomentLike(data.pages, momentId, liked) } : data,
    );
  const like = useMutation({
    mutationFn: (vars: { moment: FeedMoment; liked: boolean }) =>
      serialize(keyOf(vars.moment.jar_id, { kind: 'moment', id: vars.moment.moment_id }), () =>
        sendLike(userId ?? '', vars.moment.jar_id, {
          target: { kind: 'moment', id: vars.moment.moment_id },
          liked: vars.liked,
        }),
      ),
    onMutate: (vars) => {
      inFlight.set(vars.moment.moment_id, (inFlight.get(vars.moment.moment_id) ?? 0) + 1);
      setLiked(vars.moment.moment_id, vars.liked);
    },
    onError: (_error, vars) => setLiked(vars.moment.moment_id, !vars.liked),
    onSettled: (_data, _error, vars) => {
      const left = (inFlight.get(vars.moment.moment_id) ?? 1) - 1;
      if (left > 0) {
        inFlight.set(vars.moment.moment_id, left);
        return;
      }
      inFlight.delete(vars.moment.moment_id);
      // The jar page the moment belongs to shows the same heart.
      void queryClient.invalidateQueries({ queryKey: ['jarPage', userId ?? '', vars.moment.jar_id] });
    },
  });

  return {
    userId,
    moments: feed.data?.pages.flatMap((p) => p.moments),
    authors: authors.data,
    isLoading: feed.isLoading,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
    hasPreviousPage: feed.hasPreviousPage,
    isFetchingPreviousPage: feed.isFetchingPreviousPage,
    fetchPreviousPage: () => void feed.fetchPreviousPage(),
    /** Pull to refresh and the far back-to-top: the newest page only (`refetchFirstPage`). */
    refresh: async () => {
      await Promise.all([refetchFirstPage(queryClient, queryKey), authors.refetch()]);
    },
    toggleLike: (moment: FeedMoment) => {
      if (userId === null) return;
      like.mutate({ moment, liked: !moment.liked });
    },
  };
}
