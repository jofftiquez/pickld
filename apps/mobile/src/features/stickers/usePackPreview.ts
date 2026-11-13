// Data and actions for Pack preview (M6-03; FR-STK-07): the user's latest photo to preview a pack on, and
// buying a pack. A purchase goes through the store, then fn:store-sync reads the verified receipt back from
// RevenueCat and writes owned_packs (D-40); the shop and the Stickers tool refetch so the pack unlocks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { stickerCatalogQueryKey } from '@/features/edit/stickers/useStickerCatalog';
import { photoUrls } from '@/features/moment/useOwnMoment';
import { useAuthStore } from '@/lib/authStore';
import { getStore } from '@/lib/store/store';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

import { shopQueryKey } from './useShop';

/** The user's most recent moment photo (private ones too: the preview never leaves the phone), or null. */
async function latestPhoto(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('moments')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['checking', 'live'])
    .order('added_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const urls = await photoUrls(data.id);
  return urls.full ?? urls.thumb;
}

export function useLatestPhoto() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['latestPhoto', userId ?? ''] as const,
    queryFn: () => latestPhoto(userId ?? ''),
    enabled: userId !== null,
    staleTime: 10 * 60 * 1000, // the signed URL lasts 15 minutes
  });
}

const syncResponse = z.object({ data: z.object({ granted: z.array(z.string()), revoked: z.array(z.string()) }) });

/** Asks fn:store-sync to make owned_packs match the store; returns the pack slugs it unlocked. */
export async function syncPurchases(devProductId?: string): Promise<string[]> {
  const { data, error } = await getSupabase().functions.invoke<unknown>('store-sync', {
    body: devProductId ? { devProductId } : {},
  });
  if (error) throw error;
  const parsed = syncResponse.safeParse(data);
  if (!parsed.success) throw new Error('store-sync: unexpected response');
  return parsed.data.data.granted;
}

/** Buys a pack product; resolves `cancelled` when the user backs out of the store sheet. */
export function useBuyPack() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string): Promise<'bought' | 'cancelled'> => {
      if (!userId) throw new Error('not signed in');
      const result = await getStore().purchase(productId, userId);
      if (result.status === 'cancelled') return 'cancelled';
      await syncPurchases(result.devProductId);
      return 'bought';
    },
    onSuccess: async (outcome) => {
      if (outcome !== 'bought' || !userId) return;
      showToast('packAdded');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shopQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: stickerCatalogQueryKey(userId) }),
      ]);
    },
  });
}
