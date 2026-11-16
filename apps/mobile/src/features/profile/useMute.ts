// Mute and Unmute (0151): the viewer stays a reader, but the author's posts leave their Moments and Jars
// timelines, the date scrubbers and the avatar row. mutes is private to the muter (RLS), so the author never
// knows. Afterwards the profile and every timeline are read again.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

/** Mutes or unmutes `authorId` for `viewerId`. Already in that state (another device) is fine. */
export async function setMuted(viewerId: string, authorId: string, muted: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = muted
    ? await supabase
        .from('mutes')
        .upsert({ muter_id: viewerId, muted_id: authorId }, { onConflict: 'muter_id,muted_id', ignoreDuplicates: true })
    : await supabase.from('mutes').delete().eq('muter_id', viewerId).eq('muted_id', authorId);
  if (error) throw new Error(error.message);
}

export function useMute(viewerId: string | null) {
  const queryClient = useQueryClient();
  const mute = useMutation({
    mutationFn: ({ authorId, muted }: { authorId: string; muted: boolean }) =>
      setMuted(viewerId ?? '', authorId, muted),
    onSettled: () =>
      Promise.all(
        ['profile', 'feed', 'momentsFeed', 'feedAuthors', 'feedDays'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
  return { setMuted: (authorId: string, muted: boolean) => mute.mutate({ authorId, muted }), busy: mute.isPending };
}
