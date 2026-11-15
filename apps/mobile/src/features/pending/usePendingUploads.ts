import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { todayQueryKeys } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { listQueue, subscribeQueue } from '@/lib/queue/store';

import { groupPending, pendingCount } from './pendingGroups';

/**
 * The signed-in user's pending uploads from the local queue (FR-CAP-04, NFR-OFF-01): the same query Today
 * reads, so every screen shows the same rows, re-read whenever the queue changes. `days` is undefined until
 * the queue has been read once.
 */
export function usePendingUploads() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: todayQueryKeys.queue(userId ?? ''),
    queryFn: () => listQueue(userId ?? ''),
    enabled: userId !== null,
    // Local SQLite: readable offline, and re-read on every mount.
    networkMode: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (userId === null) return;
    return subscribeQueue(() => void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) }));
  }, [queryClient, userId]);

  return {
    days: queue.data ? groupPending(queue.data) : undefined,
    count: queue.data ? pendingCount(queue.data) : 0,
  };
}
