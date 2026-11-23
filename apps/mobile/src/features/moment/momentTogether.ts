// Together moments (0176): a person tagged on a moment asks to show it on their profile's Together page, and
// the author says yes or no. The database decides who may ask, answer and see (together_moments RLS and its
// functions); the app only shows what it reads and calls them.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

const togetherRow = z.object({
  moment_id: z.string(),
  user_id: z.string(),
  author_id: z.string(),
  status: z.enum(['requested', 'approved', 'declined']),
});
export type TogetherRow = z.infer<typeof togetherRow>;

/** The together rows the viewer may see on these moments, by moment id: their own and, as author, every one. */
export async function fetchMomentTogether(momentIds: readonly string[]): Promise<Record<string, TogetherRow[]>> {
  if (momentIds.length === 0) return {};
  const { data, error } = await getSupabase()
    .from('together_moments')
    .select('moment_id, user_id, author_id, status')
    .in('moment_id', [...momentIds]);
  if (error) throw new Error(error.message);
  const rows: Record<string, TogetherRow[]> = {};
  for (const row of z.array(togetherRow).parse(data)) (rows[row.moment_id] ??= []).push(row);
  return rows;
}

export function useMomentTogether(momentIds: readonly string[]) {
  const ids = [...momentIds].sort();
  return useQuery({
    queryKey: ['moment-together', ids],
    queryFn: () => fetchMomentTogether(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

export type TogetherAction =
  /** The tagged person asks. */
  | { kind: 'request'; momentId: string }
  /** The author says yes or no. */
  | { kind: 'answer'; momentId: string; userId: string; approve: boolean }
  /** The tagged person cancels or takes it off; the author takes their yes back (final). */
  | { kind: 'remove'; momentId: string; userId: string };

export function useTogetherAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (action: TogetherAction) => {
      const supabase = getSupabase();
      const { error } =
        action.kind === 'request'
          ? await supabase.rpc('request_together', { p_moment: action.momentId })
          : action.kind === 'answer'
            ? await supabase.rpc('answer_together', {
                p_moment: action.momentId,
                p_user: action.userId,
                p_approve: action.approve,
              })
            : await supabase.rpc('remove_together', { p_moment: action.momentId, p_user: action.userId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['moment-together'] });
      void client.invalidateQueries({ queryKey: ['together'] });
      void client.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
