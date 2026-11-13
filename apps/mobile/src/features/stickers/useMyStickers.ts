// Data for My stickers (FR-STK-08): the packs with the server's usable flag, the stickers, the user's
// owned_packs rows (when a pack was bought) and their user_pack_prefs; saving the order and switches; and
// Restore purchases (the store replays purchases, then fn:store-sync reads them back).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { stickerCatalogQueryKey } from '@/features/edit/stickers/useStickerCatalog';
import { useAuthStore } from '@/lib/authStore';
import { getStore } from '@/lib/store/store';
import { getSupabase } from '@/lib/supabase';

import { buildMyPacks, prefRowsFor, type MyPack } from './myStickers';
import { syncPurchases } from './usePackPreview';
import { shopQueryKey } from './useShop';

export const myStickersQueryKey = (userId: string) => ['myStickers', userId] as const;

async function fetchMyPacks(userId: string): Promise<MyPack[]> {
  const supabase = getSupabase();
  const [packs, stickers, owned, prefs] = await Promise.all([
    supabase
      .from('sticker_packs')
      .select('id, slug, name, sort, tier, store_product_id, available_from, available_to, pack_usable'),
    supabase
      .from('stickers')
      .select('id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort, sticker_usable')
      // Retired stickers (0032) aren't offered; moments that use them still draw their bundled art.
      .is('retired_at', null),
    supabase.from('owned_packs').select('pack_id, source, acquired_at').eq('user_id', userId),
    supabase.from('user_pack_prefs').select('pack_id, sort, hidden').eq('user_id', userId),
  ]);
  for (const result of [packs, stickers, owned, prefs]) if (result.error) throw new Error(result.error.message);
  return buildMyPacks(packs.data ?? [], stickers.data ?? [], owned.data ?? [], prefs.data ?? []);
}

export function useMyPacks() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: myStickersQueryKey(userId ?? ''),
    queryFn: () => fetchMyPacks(userId ?? ''),
    enabled: userId !== null,
  });
}

/**
 * Saves the whole list (order and switches). The screen shows the new list at once; if saving fails, the
 * saved list comes back and the error is returned to the screen.
 */
export function useSavePacks() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = myStickersQueryKey(userId ?? '');
  return useMutation({
    mutationFn: async (packs: MyPack[]) => {
      if (!userId) throw new Error('not signed in');
      const { error } = await getSupabase().from('user_pack_prefs').upsert(prefRowsFor(userId, packs));
      if (error) throw new Error(error.message);
    },
    onMutate: async (packs) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<MyPack[]>(key);
      queryClient.setQueryData(key, packs);
      return { before };
    },
    onError: (_error, _packs, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSettled: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: stickerCatalogQueryKey(userId) }),
      ]);
    },
  });
}

/** Restore purchases: resolves to the pack slugs that came back (empty when there was nothing new). */
export function useRestorePurchases() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string[]> => {
      if (!userId) throw new Error('not signed in');
      await getStore().restore(userId);
      return syncPurchases();
    },
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myStickersQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: shopQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: stickerCatalogQueryKey(userId) }),
      ]);
    },
  });
}
