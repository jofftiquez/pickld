import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Keeps only the first page of a paged list and fetches it again: the newest rows, without re-downloading every
 * page the reader scrolled through (React Query's own refetch reloads each loaded page in turn). The later pages
 * load again as the reader scrolls; their photos are still in the photo cache by key.
 */
export async function refetchFirstPage(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData<InfiniteData<unknown, unknown>>(queryKey, (data) =>
    data && data.pages.length > 1 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
  );
  await queryClient.refetchQueries({ queryKey, exact: true });
}
