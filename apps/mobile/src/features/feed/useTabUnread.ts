// The tab bar's unread dots (FR-EXP-04), for both tab bars. Each tab reads its own list's first page from the cache
// entry its screen uses (same query key, no second fetch) and compares the newest item from someone else with the
// last one seen there, kept on the phone per tab per user (`tabUnread.ts`).
import { useInfiniteQuery } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { fetchMomentsPage, momentsQueryKeys } from '@/features/moments/useMomentsFeed';
import type { PageCursor } from '@/features/scrubber/scrubberModel';
import { useAuthStore } from '@/lib/authStore';

import { hasUnread, newestJarAt, newestMomentAt, seenKey, seenUpdate, type UnreadTab } from './tabUnread';
import { fetchFeedPage, feedQueryKeys } from './useFeed';

// The dot can wait: refetched at most every 5 minutes, on app foreground or when a screen reads the list.
const STALE_TIME = 5 * 60_000;

const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);

/**
 * True while `tab`'s list has an item from someone else newer than the newest one seen with the tab open; false
 * while it is open. `newest` is that item's time from the list's first page; `listLoaded` once the page has loaded.
 */
function useUnreadDot(tab: UnreadTab, focused: boolean, newest: string | null, listLoaded: boolean): boolean {
  const userId = useUserId();
  // Unknown until read for this user (no dot meanwhile); `at` null when nothing is stored yet.
  const [seen, setSeen] = useState<{ userId: string; at: string | null } | null>(null);
  const loaded = seen !== null && seen.userId === userId;
  const stored = loaded ? seen.at : null;

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    Storage.getItem(seenKey(tab, userId))
      .then((at) => active && setSeen({ userId, at }))
      .catch(() => {}); // unreadable store: stay unknown and show no dot
    return () => {
      active = false;
    };
  }, [tab, userId]);

  useEffect(() => {
    if (userId === null || !loaded) return;
    const next = seenUpdate({ stored, newest, listLoaded, focused });
    if (next === null) return;
    // Kept in memory even if the write fails, so the dot doesn't come back this session.
    void Storage.setItem(seenKey(tab, userId), next)
      .catch(() => {})
      .then(() => setSeen((prev) => (prev === null || prev.userId === userId ? { userId, at: next } : prev)));
  }, [tab, userId, loaded, stored, newest, listLoaded, focused]);

  return loaded && !focused && hasUnread(newest, stored);
}

/** The Moments tab's dot: someone else's moment went into the timeline after the newest one seen there. */
export function useMomentsUnread(focused: boolean): boolean {
  const userId = useUserId();
  // The timeline's own query (useMomentsFeed): same key, page function and cursors.
  const first = useInfiniteQuery({
    queryKey: momentsQueryKeys.feed(userId ?? ''),
    queryFn: ({ pageParam }) => fetchMomentsPage(pageParam),
    initialPageParam: null as PageCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null,
    staleTime: STALE_TIME,
    select: (data) => newestMomentAt(data.pages[0]?.moments ?? [], userId),
  });
  return useUnreadDot('moments', focused, first.data ?? null, first.isSuccess);
}

/** The Jars tab's dot: someone else's published jar reached the top after the newest one seen there. */
export function useJarsUnread(focused: boolean): boolean {
  const userId = useUserId();
  // The timeline's own query (useFeed): same key, page function and cursors.
  const first = useInfiniteQuery({
    queryKey: feedQueryKeys.feed(userId ?? ''),
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: null as PageCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null,
    staleTime: STALE_TIME,
    select: (data) => newestJarAt(data.pages[0]?.jars ?? [], userId),
  });
  return useUnreadDot('jars', focused, first.data ?? null, first.isSuccess);
}
