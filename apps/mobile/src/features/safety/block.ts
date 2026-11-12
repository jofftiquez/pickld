// Block and Blocked accounts (M3-22; FR-SAF-02, FR-PUB-06). The database is the referee: blocks_owner
// (0001) lets you add and remove only your own blocks, blocks_sync (0019) removes follows both ways and the
// notifications between you, nobody is notified, and a block hides both profiles from each other (0005).
// blocked_accounts() (0022) lists your own blocks for the Blocked accounts screen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

export const blockedAccount = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  blocked_at: z.string(),
});
export type BlockedAccount = z.infer<typeof blockedAccount>;

export async function blockUser(viewerId: string, blockedId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('blocks')
    .upsert(
      { blocker_id: viewerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function unblockUser(viewerId: string, blockedId: string): Promise<void> {
  const { error } = await getSupabase().from('blocks').delete().eq('blocker_id', viewerId).eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
}

export async function fetchBlockedAccounts(): Promise<BlockedAccount[]> {
  const { data, error } = await getSupabase().rpc('blocked_accounts');
  if (error) throw new Error(error.message);
  return z.array(blockedAccount).parse(data);
}

export const blockQueryKeys = {
  /** ['blocked', viewerId] */
  list: (viewerId: string) => ['blocked', viewerId] as const,
};

/** Block and unblock; afterwards everything that shows other people is read again. */
export function useBlock() {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const refetch = () =>
    Promise.all(
      ['blocked', 'profile', 'followList', 'feed', 'feedAuthors', 'notifications', 'jarPage', 'comments'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  const block = useMutation({
    mutationFn: (blockedId: string) => blockUser(viewerId ?? '', blockedId),
    onSettled: refetch,
  });
  const unblock = useMutation({
    mutationFn: (blockedId: string) => unblockUser(viewerId ?? '', blockedId),
    onSettled: refetch,
  });
  return {
    viewerId,
    /** Resolves once the block is saved, so the caller can leave the blocked person's screen. */
    block: (blockedId: string) => block.mutateAsync(blockedId),
    unblock: (blockedId: string) => unblock.mutate(blockedId),
    busy: block.isPending || unblock.isPending,
    failed: block.isError,
  };
}

export function useBlockedAccounts() {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: blockQueryKeys.list(viewerId ?? ''),
    queryFn: fetchBlockedAccounts,
    enabled: viewerId !== null,
  });
  return {
    rows: query.data,
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
