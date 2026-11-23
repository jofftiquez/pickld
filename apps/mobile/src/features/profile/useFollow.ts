// Read, Read back, Reading and Remove reader (M3-14; FR-SOC-07). The database is the referee: follows_insert
// lets a user add only their own follow (and 0005 only while active and not blocked), follows_delete lets
// the reader or the author remove one, and follows_sync keeps reader_count and author_count right on both
// profiles. The viewed profile changes at once (optimistic); afterwards every cached profile, follow list
// and the feed are read again, so the counts on both profiles match the server. For someone who approves readers
// (Private or under 18, 0176) the same insert becomes a request on the server; Requested cancels it.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/analytics';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

import { withReading } from './profileModel';
import type { FollowListRow } from './useFollowList';
import { profileQueryKeys, type ProfilePage } from './useProfile';

/** What a Read or Reading tap did: started reading, asked to (0176), stopped reading, or cancelled a request. */
export type ReadingResult = 'reading' | 'requested' | 'stopped' | 'cancelled';

/** Starts or stops `viewerId` reading `authorId`; stopping also cancels a request. Already in that state (another
 * device) is fine. A Read or Read back that went through is one `follow` event (NFR-ANL-01), wherever it was
 * tapped; a request is not, until it is approved. */
export async function setReading(viewerId: string, authorId: string, reading: boolean): Promise<ReadingResult> {
  const supabase = getSupabase();
  if (reading) {
    const row = { reader_id: viewerId, author_id: authorId };
    const { error } = await supabase
      .from('follows')
      .upsert(row, { onConflict: 'reader_id,author_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    const request = await supabase
      .from('follow_requests')
      .select('author_id')
      .eq('reader_id', viewerId)
      .eq('author_id', authorId);
    if (request.error) throw new Error(request.error.message);
    if ((request.data ?? []).length > 0) return 'requested';
    track('follow', {});
    return 'reading';
  }
  const [follow, request] = await Promise.all([
    supabase.from('follows').delete().eq('reader_id', viewerId).eq('author_id', authorId),
    supabase.from('follow_requests').delete().eq('reader_id', viewerId).eq('author_id', authorId).select('author_id'),
  ]);
  if (follow.error) throw new Error(follow.error.message);
  if (request.error) throw new Error(request.error.message);
  return (request.data ?? []).length > 0 ? 'cancelled' : 'stopped';
}

/** The author `viewerId` removes `readerId` from their readers. */
export async function removeReader(viewerId: string, readerId: string): Promise<void> {
  const { error } = await getSupabase().from('follows').delete().eq('reader_id', readerId).eq('author_id', viewerId);
  if (error) throw new Error(error.message);
}

type ReadingVars = { authorId: string; username: string; reading: boolean };

export function useFollow(viewerId: string | null) {
  const queryClient = useQueryClient();
  const refetch = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: ['followList'] }),
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
    ]);

  const reading = useMutation({
    mutationFn: ({ authorId, reading }: ReadingVars) => setReading(viewerId ?? '', authorId, reading),
    onMutate: async ({ authorId, username, reading }) => {
      const key = profileQueryKeys.profile(viewerId ?? '', username);
      await queryClient.cancelQueries({ queryKey: key });
      await queryClient.cancelQueries({ queryKey: ['followList'] });
      const before = queryClient.getQueryData<ProfilePage | null>(key);
      if (before) queryClient.setQueryData<ProfilePage>(key, withReading(before, reading));
      const lists = queryClient.getQueriesData<FollowListRow[]>({ queryKey: ['followList'] });
      for (const [listKey, rows] of lists) {
        if (rows) {
          queryClient.setQueryData(
            listKey,
            // A request shows as Requested once the server says so (onSettled reads the lists again).
            rows.map((r) => (r.id === authorId ? { ...r, is_following: reading, requested: false } : r)),
          );
        }
      }
      return { key, before, lists };
    },
    onError: (_error, _vars, context) => {
      if (context?.before !== undefined) queryClient.setQueryData(context.key, context.before);
      for (const [listKey, rows] of context?.lists ?? []) queryClient.setQueryData(listKey, rows);
    },
    onSuccess: (result, { username }) =>
      showToast(
        ({ reading: 'following', requested: 'requested', stopped: 'unfollowed', cancelled: 'requestCancelled' } as const)[
          result
        ],
        { username },
      ),
    onSettled: refetch,
  });

  const remove = useMutation({
    mutationFn: (readerId: string) => removeReader(viewerId ?? '', readerId),
    onSettled: refetch,
  });

  return {
    setReading: (vars: ReadingVars) => {
      if (viewerId !== null) reading.mutate(vars);
    },
    removeReader: (readerId: string) => {
      if (viewerId !== null) remove.mutate(readerId);
    },
    /** A request is in flight: the buttons wait so taps don't race. */
    busy: reading.isPending || remove.isPending,
  };
}
