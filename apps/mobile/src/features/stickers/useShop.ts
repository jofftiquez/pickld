// Data for the Sticker shop and Pack preview: every pack with its sale window and the server's usable flag,
// every sticker, and the user's onboarding answers (owner-only RLS), plus the store's prices.
import { useQuery } from '@tanstack/react-query';

import { rememberStickerArt } from '@/features/edit/stickers/remoteStickerArt';
import { useAuthStore } from '@/lib/authStore';
import { getStore, type StoreProduct } from '@/lib/store/store';
import { getSupabase } from '@/lib/supabase';

export type ShopRows = { packs: unknown[]; stickers: unknown[]; answers: unknown };

export const shopQueryKey = (userId: string) => ['stickerShop', userId] as const;

async function fetchShopRows(userId: string): Promise<ShopRows> {
  const supabase = getSupabase();
  const [packs, stickers, answers] = await Promise.all([
    supabase
      .from('sticker_packs')
      .select('id, slug, name, tier, description, store_product_id, available_from, available_to, sort, pack_usable'),
    supabase
      .from('stickers')
      .select(
        'id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort, sticker_usable, art_width, art_height, art_version',
      )
      // Retired stickers (0032) aren't offered; moments that use them still draw their art.
      .is('retired_at', null),
    supabase
      .from('onboarding_answers')
      .select('day_type, whoamiwith, mebusywith, ootd')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (packs.error) throw new Error(packs.error.message);
  if (stickers.error) throw new Error(stickers.error.message);
  rememberStickerArt(stickers.data);
  return { packs: packs.data, stickers: stickers.data, answers: answers.error ? null : answers.data };
}

export function useShopRows() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: shopQueryKey(userId ?? ''),
    queryFn: () => fetchShopRows(userId ?? ''),
    enabled: userId !== null,
  });
}

/** Store prices by product id; an empty map while loading or when this build has no store. */
export function usePrices(productIds: readonly string[]): ReadonlyMap<string, string> {
  const ids = [...new Set(productIds)].sort();
  const query = useQuery({
    queryKey: ['storeProducts', ids] as const,
    queryFn: () => getStore().products(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  return new Map((query.data ?? []).map((p: StoreProduct) => [p.id, p.price]));
}
