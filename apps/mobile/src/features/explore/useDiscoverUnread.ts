// The Discover tab's unread dot (FR-EXP-04), for both tab bars. Reads the first page of Discover's Moments list
// in the background and compares its newest item with the last one seen, kept on the phone per user.
import { useInfiniteQuery } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/lib/authStore';

import { discoverSeenUpdate, hasUnreadDiscover, newestDiscoverAt } from './discoverUnread';
import { discoverMomentsQuery } from './useDiscover';

// The dot can wait: refetched at most every 5 minutes, on app foreground or when a screen reads the list.
const STALE_TIME = 5 * 60_000;

const seenKey = (userId: string) => `discoverSeen:${userId}`;

/** True while Discover has items newer than the newest one seen with the tab open; false while it is open. */
export function useDiscoverUnread(focused: boolean): boolean {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const first = useInfiniteQuery({
    ...discoverMomentsQuery(userId),
    staleTime: STALE_TIME,
    select: (data) => newestDiscoverAt(data.pages[0]?.moments ?? []),
  });
  const newest = first.data ?? null;
  const listLoaded = first.isSuccess;
  // Unknown until read for this user (no dot meanwhile); `at` null when nothing is stored yet.
  const [seen, setSeen] = useState<{ userId: string; at: string | null } | null>(null);
  const loaded = seen !== null && seen.userId === userId;
  const stored = loaded ? seen.at : null;

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    Storage.getItem(seenKey(userId))
      .then((at) => active && setSeen({ userId, at }))
      .catch(() => {}); // unreadable store: stay unknown and show no dot
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (userId === null || !loaded) return;
    const next = discoverSeenUpdate({ stored, newest, listLoaded, focused });
    if (next === null) return;
    // Kept in memory even if the write fails, so the dot doesn't come back this session.
    void Storage.setItem(seenKey(userId), next)
      .catch(() => {})
      .then(() => setSeen((prev) => (prev === null || prev.userId === userId ? { userId, at: next } : prev)));
  }, [userId, loaded, stored, newest, listLoaded, focused]);

  return loaded && !focused && hasUnreadDiscover(newest, stored);
}
