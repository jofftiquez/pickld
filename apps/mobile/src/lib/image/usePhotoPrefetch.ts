// Loads the photos of the next few list rows while the user reads the current ones (NFR-PERF-02), so a photo is
// usually in the phone's photo cache before its row scrolls into view. Each photo is fetched once per list.
import { useCallback, useEffect, useRef } from 'react';
import type { FlatListProps } from 'react-native';

import { photoCacheKey, prefetchPhotos } from './photoCache';

/** Rows past the last one on screen whose photos are loaded ahead. */
export const PREFETCH_AHEAD = 4;

/** The photo links of the `ahead` rows after `lastVisible`, skipping rows without one. */
export function upcomingPhotos<T>(
  items: readonly T[],
  lastVisible: number,
  photoOf: (item: T) => string | null | undefined,
  ahead = PREFETCH_AHEAD,
): string[] {
  return items
    .slice(lastVisible + 1, lastVisible + 1 + ahead)
    .map(photoOf)
    .filter((uri): uri is string => typeof uri === 'string');
}

/** An `onViewableItemsChanged` for a FlatList of `items` that prefetches the photos `photoOf` picks. */
export function usePhotoPrefetch<T>(
  items: readonly T[] | undefined,
  photoOf: (item: T) => string | null | undefined,
): NonNullable<FlatListProps<T>['onViewableItemsChanged']> {
  // FlatList refuses a new onViewableItemsChanged after mount, so the callback reads the latest list through refs.
  const latest = useRef({ items, photoOf });
  useEffect(() => {
    latest.current = { items, photoOf };
  }, [items, photoOf]);
  const fetched = useRef(new Set<string>());
  return useCallback<NonNullable<FlatListProps<T>['onViewableItemsChanged']>>(({ viewableItems }) => {
    const last = viewableItems.reduce((max, v) => Math.max(max, v.index ?? -1), -1);
    if (last < 0) return;
    const { items: list, photoOf: pick } = latest.current;
    const next = upcomingPhotos(list ?? [], last, pick).filter((uri) => {
      const key = photoCacheKey(uri);
      if (!key || fetched.current.has(key)) return false;
      fetched.current.add(key);
      return true;
    });
    if (next.length > 0) void prefetchPhotos(next);
  }, []);
}
