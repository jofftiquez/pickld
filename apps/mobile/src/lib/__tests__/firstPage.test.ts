import { InfiniteQueryObserver, QueryClient, type InfiniteData } from '@tanstack/react-query';

import { refetchFirstPage } from '../firstPage';

type Page = { rows: string[]; next: number | null };

describe('refetchFirstPage', () => {
  it('keeps only the first page and fetches just that one again, with the newest rows', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['feed', 'me'];
    let newest = 'a';
    const fetched: number[] = [];
    const observer = new InfiniteQueryObserver<Page, Error, InfiniteData<Page, number>, typeof queryKey, number>(
      client,
      {
        queryKey,
        initialPageParam: 0,
        getNextPageParam: (last) => last.next,
        queryFn: ({ pageParam }) => {
          fetched.push(pageParam);
          return Promise.resolve({ rows: [pageParam === 0 ? newest : `page${pageParam}`], next: pageParam + 1 });
        },
      },
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    expect(client.getQueryData<InfiniteData<Page, number>>(queryKey)?.pages).toHaveLength(3);

    newest = 'b';
    fetched.length = 0;
    await refetchFirstPage(client, queryKey);

    // React Query's own refetch would ask for pages 0, 1 and 2 again.
    expect(fetched).toEqual([0]);
    const data = client.getQueryData<InfiniteData<Page, number>>(queryKey);
    expect(data?.pages).toEqual([{ rows: ['b'], next: 1 }]);
    expect(data?.pageParams).toEqual([0]);
    unsubscribe();
    client.clear();
  });
});
