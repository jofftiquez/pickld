import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, type QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Storage from 'expo-sqlite/kv-store';

const DAY = 24 * 60 * 60 * 1000;

// Cached queries are written to SQLite so screens can show the last known data offline after a restart
// (NFR-OFF-03). gcTime must be at least maxAge, or restored queries are dropped right away.
export const CACHE_MAX_AGE = 7 * DAY;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: CACHE_MAX_AGE, staleTime: 30 * 1000, networkMode: 'offlineFirst' },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
}

export const queryPersister = createAsyncStoragePersister({
  storage: Storage,
  key: 'pickld-query-cache',
  throttleTime: 1000,
});

/**
 * A timeline the date scrubber jumped into (`['feed' | 'momentsFeed', userId, { from }]`, FR-SOC-01). It lives only
 * while that jump is on screen: never persisted, and dropped on the next jump, so a jump always opens at its day.
 */
export function isAnchoredQueryKey(key: QueryKey): boolean {
  return key.some((part) => typeof part === 'object' && part !== null && 'from' in part);
}

// Bump `buster` when cached data shapes change incompatibly.
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: CACHE_MAX_AGE,
  buster: '2', // 2: moments carry visibility instead of is_private (D-48)
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) && !isAnchoredQueryKey(query.queryKey),
  },
};
