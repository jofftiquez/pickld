// Likes on sticker packs (FR-STK-07, 0110; stored as pack thumbs). pack_thumbs() gives every published pack's count as the viewer
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
// The cache holds a plain object by pack id: queries are saved to disk as JSON (queryClient.ts), and a Map
// would come back as an empty object after a restart. `select` turns it into a Map for screens.
type CachedThumbs = Readonly<Record<string, PackThumb>>;

const rowsSchema = z.array(z.object({ pack_id: z.string(), thumbs: z.number(), mine: z.boolean() }));

// 'packLikes', not the first release's 'packThumbs', whose saved entries hold a broken Map.
export const packThumbsQueryKey = (userId: string) => ['packLikes', userId] as const;

async function fetchPackThumbs(): Promise<CachedThumbs> {
  const { data, error } = await getSupabase().rpc('pack_thumbs');
  if (error) throw new Error(error.message);
  return Object.fromEntries(rowsSchema.parse(data).map((r) => [r.pack_id, { thumbs: r.thumbs, mine: r.mine }]));
}

const toMap = (cached: CachedThumbs): PackThumbs => new Map(Object.entries(cached));

/** `thumbs` with the viewer's thumb on `packId` set to `on`; a pack it doesn't know is left out. */
export function withThumb(thumbs: CachedThumbs, packId: string, on: boolean): CachedThumbs {
  const current = thumbs[packId];
  if (!current || current.mine === on) return thumbs;
  return { ...thumbs, [packId]: { thumbs: Math.max(0, current.thumbs + (on ? 1 : -1)), mine: on } };
}

const inFlight = new Map<string, number>();

/** Counts by pack id, and `toggle(packId)` to flip the viewer's thumb. */
export function usePackThumbs() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queryKey = packThumbsQueryKey(userId ?? '');
  const query = useQuery({ queryKey, queryFn: fetchPackThumbs, select: toMap, enabled: userId !== null });

  const mutation = useMutation({
    mutationFn: ({ packId, on }: { packId: string; on: boolean }) =>
      serialize(`pack:${packId}`, async () => {
        const { error } = await getSupabase().rpc('set_pack_thumb', { p_pack: packId, p_on: on });
        if (error) throw new Error(error.message);
      }),
    onMutate: ({ packId, on }) => {
      inFlight.set(packId, (inFlight.get(packId) ?? 0) + 1);
      queryClient.setQueryData<CachedThumbs>(queryKey, (data) => (data ? withThumb(data, packId, on) : data));
    },
    onError: (_error, { packId, on }) => {
      queryClient.setQueryData<CachedThumbs>(queryKey, (data) => (data ? withThumb(data, packId, !on) : data));
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
      const current = queryClient.getQueryData<CachedThumbs>(queryKey)?.[packId];
      if (userId === null || !current) return;
      mutation.mutate({ packId, on: !current.mine });
    },
  };
}
