// Discover's lists (QA round 3, piece K; D-100, D-102; FR-EXP-03): `discover_moments_page` and
// `discover_jars_page` (0070), 20 rows a page, newest first. Their rows have the timelines' columns, so pages
// are fetched by the timelines' own functions (with signed photos) and drawn by their cards. Each list loads
// the first time its tab is shown. Reading an author takes them out of both lists at once.
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type { FeedCursor, FeedPage } from '@/features/feed/feedModel';
import { fetchFeedPage } from '@/features/feed/useFeed';
import { keyOf, sendLike, serialize } from '@/features/jar/useLike';
import { withMomentLike, type FeedMoment, type MomentsCursor, type MomentsPage } from '@/features/moments/momentsModel';
import { fetchMomentsPage } from '@/features/moments/useMomentsFeed';
import { useAuthStore } from '@/lib/authStore';

export type DiscoverTab = 'moments' | 'jars';

export const discoverQueryKeys = {
  /** ['discover', …]: both lists. */
  all: ['discover'] as const,
  moments: (userId: string) => ['discover', 'moments', userId] as const,
  jars: (userId: string) => ['discover', 'jars', userId] as const,
};

type MomentPages = InfiniteData<MomentsPage, MomentsCursor | null>;
type JarPages = InfiniteData<FeedPage, FeedCursor | null>;

/** The pages without `authorId`'s rows: once read, their moments and jars are the timelines' (D-102). */
export function withoutAuthor<P extends { moments?: { author_id: string }[]; jars?: { author_id: string }[] }>(
  pages: P[],
  authorId: string,
): P[] {
  return pages.map((page) => ({
    ...page,
    ...(page.moments ? { moments: page.moments.filter((m) => m.author_id !== authorId) } : {}),
    ...(page.jars ? { jars: page.jars.filter((j) => j.author_id !== authorId) } : {}),
  }));
}

/** Takes an author out of both Discover lists in the cache, before the server agrees. */
export async function removeDiscoverAuthor(queryClient: QueryClient, authorId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: discoverQueryKeys.all });
  queryClient.setQueriesData<MomentPages>({ queryKey: ['discover', 'moments'] }, (data) =>
    data ? { ...data, pages: withoutAuthor(data.pages, authorId) } : data,
  );
  queryClient.setQueriesData<JarPages>({ queryKey: ['discover', 'jars'] }, (data) =>
    data ? { ...data, pages: withoutAuthor(data.pages, authorId) } : data,
  );
}

/** Discover's Moments list; `enabled` once its tab has been shown. */
export function useDiscoverMoments(enabled: boolean) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queryKey = discoverQueryKeys.moments(userId ?? '');
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchMomentsPage(pageParam, 'discover_moments_page'),
    initialPageParam: null as MomentsCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null && enabled,
  });
  const setLiked = (momentId: string, liked: boolean) =>
    queryClient.setQueryData<MomentPages>(queryKey, (data) =>
      data ? { ...data, pages: withMomentLike(data.pages, momentId, liked) } : data,
    );
  // The timeline's like (FR-SOC-05): same request, same per-moment ordering, optimistic in this list.
  const like = useMutation({
    mutationFn: (vars: { moment: FeedMoment; liked: boolean }) =>
      serialize(keyOf(vars.moment.jar_id, { kind: 'moment', id: vars.moment.moment_id }), () =>
        sendLike(userId ?? '', vars.moment.jar_id, {
          target: { kind: 'moment', id: vars.moment.moment_id },
          liked: vars.liked,
        }),
      ),
    onMutate: (vars) => setLiked(vars.moment.moment_id, vars.liked),
    onError: (_error, vars) => setLiked(vars.moment.moment_id, !vars.liked),
    onSettled: (_data, _error, vars) =>
      queryClient.invalidateQueries({ queryKey: ['jarPage', userId ?? '', vars.moment.jar_id] }),
  });
  return {
    moments: list.data?.pages.flatMap((p) => p.moments),
    isLoading: list.isLoading,
    isError: list.isError,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: () => void list.fetchNextPage(),
    refresh: async () => {
      await list.refetch();
    },
    toggleLike: (moment: FeedMoment) => {
      if (userId !== null) like.mutate({ moment, liked: !moment.liked });
    },
  };
}

/** Discover's Jars list; `enabled` once its tab has been shown. */
export function useDiscoverJars(enabled: boolean) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const list = useInfiniteQuery({
    queryKey: discoverQueryKeys.jars(userId ?? ''),
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, 'discover_jars_page'),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null && enabled,
  });
  return {
    jars: list.data?.pages.flatMap((p) => p.jars),
    isLoading: list.isLoading,
    isError: list.isError,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: () => void list.fetchNextPage(),
    refresh: async () => {
      await list.refetch();
    },
  };
}
