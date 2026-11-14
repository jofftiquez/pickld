// Thumbs up on sticker packs (FR-STK-07, 0110). pack_thumbs() gives every published pack's count as the viewer
// sees it and whether they gave one; set_pack_thumb() turns the viewer's thumb on or off. A tap changes the
// count and the thumb at once (optimistic). Requests for one pack run one after another, so the last tap wins
// on the server; a failed request undoes its own change, and once a pack has no requests left in flight the
// counts are read again so they match the server.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { serialize } from '@/features/jar/useLike';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

export type PackThumb = { thumbs: number; mine: boolean };
export type PackThumbs = ReadonlyMap<string, PackThumb>;

const rowsSchema = z.array(z.object({ pack_id: z.string(), thumbs: z.number(), mine: z.boolean() }));

export const packThumbsQueryKey = (userId: string) => ['packThumbs', userId] as const;

async function fetchPackThumbs(): Promise<PackThumbs> {
  const { data, error } = await getSupabase().rpc('pack_thumbs');
  if (error) throw new Error(error.message);
  return new Map(rowsSchema.parse(data).map((r) => [r.pack_id, { thumbs: r.thumbs, mine: r.mine }]));
}

/** `thumbs` with the viewer's thumb on `packId` set to `on`; a pack it doesn't know is left out. */
export function withThumb(thumbs: PackThumbs, packId: string, on: boolean): PackThumbs {
  const current = thumbs.get(packId);
  if (!current || current.mine === on) return thumbs;
  const next = new Map(thumbs);
  next.set(packId, { thumbs: Math.max(0, current.thumbs + (on ? 1 : -1)), mine: on });
  return next;
}

const inFlight = new Map<string, number>();

/** Counts by pack id, and `toggle(packId)` to flip the viewer's thumb. */
export function usePackThumbs() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queryKey = packThumbsQueryKey(userId ?? '');
  const query = useQuery({ queryKey, queryFn: fetchPackThumbs, enabled: userId !== null });

  const mutation = useMutation({
    mutationFn: ({ packId, on }: { packId: string; on: boolean }) =>
      serialize(`pack:${packId}`, async () => {
        const { error } = await getSupabase().rpc('set_pack_thumb', { p_pack: packId, p_on: on });
        if (error) throw new Error(error.message);
      }),
    onMutate: ({ packId, on }) => {
      inFlight.set(packId, (inFlight.get(packId) ?? 0) + 1);
      queryClient.setQueryData<PackThumbs>(queryKey, (data) => (data ? withThumb(data, packId, on) : data));
    },
    onError: (_error, { packId, on }) => {
      queryClient.setQueryData<PackThumbs>(queryKey, (data) => (data ? withThumb(data, packId, !on) : data));
    },
    onSettled: (_data, _error, { packId }) => {
      const left = (inFlight.get(packId) ?? 1) - 1;
      if (left > 0) {
        inFlight.set(packId, left);
        return;
      }
      inFlight.delete(packId);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    thumbs: query.data,
    toggle: (packId: string) => {
      const current = queryClient.getQueryData<PackThumbs>(queryKey)?.get(packId);
      if (userId === null || !current) return;
      mutation.mutate({ packId, on: !current.mine });
    },
  };
}
