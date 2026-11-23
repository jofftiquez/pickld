// Requests to read you (0176): people waiting for your approval, for the Requests card on your Readers list and
// the Approve button on a request notification. reader_requests() returns only the caller's own requests;
// approve_reader() makes the follow and tells the reader; declining deletes the request without telling them.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

export const readerRequestRow = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  requested_at: z.string(),
});
export type ReaderRequest = z.infer<typeof readerRequestRow>;

export async function fetchReaderRequests(): Promise<ReaderRequest[]> {
  const { data, error } = await getSupabase().rpc('reader_requests');
  if (error) throw new Error(error.message);
  return z.array(readerRequestRow).parse(data);
}

/** The author `viewerId` approves or declines `readerId`'s request. */
export async function answerRequest(viewerId: string, readerId: string, approve: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = approve
    ? await supabase.rpc('approve_reader', { p_reader: readerId })
    : await supabase.from('follow_requests').delete().eq('reader_id', readerId).eq('author_id', viewerId);
  if (error) throw new Error(error.message);
}

export const readerRequestsKey = (viewerId: string) => ['readerRequests', viewerId] as const;

/** Your waiting requests (only when `enabled`), and Approve / Decline. An answered row leaves at once. */
export function useReaderRequests(viewerId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const key = readerRequestsKey(viewerId ?? '');
  const query = useQuery({ queryKey: key, queryFn: fetchReaderRequests, enabled: viewerId !== null && enabled });
  const answer = useMutation({
    mutationFn: ({ request, approve }: { request: Pick<ReaderRequest, 'id' | 'username'>; approve: boolean }) =>
      answerRequest(viewerId ?? '', request.id, approve),
    onMutate: async ({ request }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<ReaderRequest[]>(key);
      if (before)
        queryClient.setQueryData(
          key,
          before.filter((r) => r.id !== request.id),
        );
      return { before };
    },
    onError: (_error, _vars, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSuccess: (_data, { request, approve }) => {
      if (approve) showToast('readerApproved', { username: request.username });
    },
    onSettled: () =>
      Promise.all(
        ['readerRequests', 'profile', 'followList', 'notifications'].map((k) =>
          queryClient.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
  return {
    /** Undefined while loading or when not enabled. */
    requests: query.data,
    answer: (request: Pick<ReaderRequest, 'id' | 'username'>, approve: boolean) => {
      if (viewerId !== null) answer.mutate({ request, approve });
    },
    busy: answer.isPending,
  };
}
