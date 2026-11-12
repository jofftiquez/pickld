// A profile's readers or authors for Readers & authors (M3-14; FR-SOC-09), from search_follow_list (0017):
// security invoker, so RLS and the RPC drop anyone blocked either way with the viewer and inactive
// profiles. The search runs once typing has paused.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export type FollowList = 'readers' | 'authors';

export const followListRow = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  /** The viewer reads them (Reading). */
  is_following: z.boolean(),
  /** They read the viewer (Read back). */
  follows_viewer: z.boolean(),
});
export type FollowListRow = z.infer<typeof followListRow>;

export const SEARCH_DEBOUNCE_MS = 300;

export async function fetchFollowList(ownerId: string, list: FollowList, query: string): Promise<FollowListRow[]> {
  const { data, error } = await getSupabase().rpc('search_follow_list', {
    owner: ownerId,
    list,
    query: query.trim(),
    lim: 200,
  });
  if (error) throw new Error(error.message);
  return z.array(followListRow).parse(data);
}

export const followListQueryKeys = {
  /** ['followList', viewerId, ownerId, list, query] */
  list: (viewerId: string, ownerId: string, list: FollowList, query: string) =>
    ['followList', viewerId, ownerId, list, query] as const,
};

/** Rows for `ownerId`'s `list` matching `query`; nothing is read until the owner is known. */
export function useFollowList(ownerId: string | null, list: FollowList, query: string) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const settled = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const result = useQuery({
    queryKey: followListQueryKeys.list(viewerId ?? '', ownerId ?? '', list, settled),
    queryFn: () => fetchFollowList(ownerId ?? '', list, settled),
    enabled: viewerId !== null && ownerId !== null,
    // Keep showing the same list's rows while a new search loads, instead of flashing empty; switching
    // lists never shows the other list's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[3] === list ? previous : undefined),
  });
  return {
    viewerId,
    /** Undefined while the first load runs. */
    rows: result.data,
    failed: result.isError && result.data === undefined,
    refresh: async () => {
      await result.refetch();
    },
  };
}
