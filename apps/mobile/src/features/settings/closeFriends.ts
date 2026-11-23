// Close friends (0179): the owner's list of readers who see moments and jars shared with Close friends. The
// database is the referee: only the owner reads and writes their list (close_friends RLS), only current
// readers can be added, and stopping reading or a block takes someone off it. Nobody is told either way.
// The screen lists the owner's readers (search_follow_list, 0017) with who is on the list.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchFollowList, SEARCH_DEBOUNCE_MS } from '@/features/profile/useFollowList';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export async function fetchCloseFriendIds(): Promise<string[]> {
  const { data, error } = await getSupabase().from('close_friends').select('friend_id');
  if (error) throw new Error(error.message);
  return z
    .array(z.object({ friend_id: z.string() }))
    .parse(data)
    .map((r) => r.friend_id);
}

export async function setCloseFriend(ownerId: string, friendId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await getSupabase()
        .from('close_friends')
        .upsert(
          { owner_id: ownerId, friend_id: friendId },
          { onConflict: 'owner_id,friend_id', ignoreDuplicates: true },
        )
    : await getSupabase().from('close_friends').delete().eq('owner_id', ownerId).eq('friend_id', friendId);
  if (error) throw new Error(error.message);
}

export const closeFriendsQueryKeys = {
  /** ['closeFriends', viewerId] */
  ids: (viewerId: string) => ['closeFriends', viewerId] as const,
};

/** Who is on the caller's list; Settings shows the count. */
export function useCloseFriendIds() {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: closeFriendsQueryKeys.ids(viewerId ?? ''),
    queryFn: fetchCloseFriendIds,
    enabled: viewerId !== null,
  });
  return { viewerId, ids: query.data, failed: query.isError && query.data === undefined, refetch: query.refetch };
}

/** The Close friends screen: the caller's readers matching `query`, the list, and a switch for each. */
export function useCloseFriends(query: string) {
  const queryClient = useQueryClient();
  const { viewerId, ids, failed: idsFailed, refetch: refetchIds } = useCloseFriendIds();
  const settled = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const readers = useQuery({
    queryKey: ['followList', viewerId ?? '', viewerId ?? '', 'readers', settled] as const,
    queryFn: () => fetchFollowList(viewerId ?? '', 'readers', settled),
    enabled: viewerId !== null,
    placeholderData: (previous) => previous,
  });
  const key = closeFriendsQueryKeys.ids(viewerId ?? '');
  const toggle = useMutation({
    mutationFn: ({ friendId, on }: { friendId: string; on: boolean }) => setCloseFriend(viewerId ?? '', friendId, on),
    // The switch moves at once; a refusal or no connection puts it back when the list is read again.
    onMutate: async ({ friendId, on }) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<string[]>(key, (prev = []) =>
        on ? [...prev.filter((id) => id !== friendId), friendId] : prev.filter((id) => id !== friendId),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return {
    /** Undefined while the first load runs. */
    rows: readers.data,
    ids: new Set(ids ?? []),
    count: ids?.length,
    failed: (readers.isError && readers.data === undefined) || idsFailed,
    failedSave: toggle.isError,
    toggle: (friendId: string, on: boolean) => toggle.mutate({ friendId, on }),
    refresh: async () => {
      await Promise.all([readers.refetch(), refetchIds()]);
    },
  };
}
