// Read, Read back, Reading and Remove reader (M3-14; FR-SOC-07). The database is the referee: follows_insert
// lets a user add only their own follow (and 0005 only while active and not blocked), follows_delete lets
// the reader or the author remove one, and follows_sync keeps reader_count and author_count right on both
// profiles. The viewed profile changes at once (optimistic); afterwards every cached profile, follow list
// and the feed are read again, so the counts on both profiles match the server.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/analytics';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

import { withReading } from './profileModel';
import type { FollowListRow } from './useFollowList';
import { profileQueryKeys, type ProfilePage } from './useProfile';

/** Starts or stops `viewerId` reading `authorId`. Already in that state (another device) is fine. A Read or
 * Read back that went through is one `follow` event (NFR-ANL-01), wherever it was tapped. */
export async function setReading(viewerId: string, authorId: string, reading: boolean): Promise<void> {
  const supabase = getSupabase();
  const row = { reader_id: viewerId, author_id: authorId };
  const { error } = reading
    ? await supabase.from('follows').upsert(row, { onConflict: 'reader_id,author_id', ignoreDuplicates: true })
    : await supabase.from('follows').delete().eq('reader_id', viewerId).eq('author_id', authorId);
  if (error) throw new Error(error.message);
  if (reading) track('follow', {});
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
            rows.map((r) => (r.id === authorId ? { ...r, is_following: reading } : r)),
          );
        }
      }
      return { key, before, lists };
    },
    onError: (_error, _vars, context) => {
      if (context?.before !== undefined) queryClient.setQueryData(context.key, context.before);
      for (const [listKey, rows] of context?.lists ?? []) queryClient.setQueryData(listKey, rows);
    },
    onSuccess: (_data, { username, reading }) => showToast(reading ? 'following' : 'unfollowed', { username }),
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
