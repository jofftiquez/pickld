// The Stickers tool's catalog (FR-STK-02): packs and stickers with the server's usable flags, and the
// user's onboarding answers for suggestions and My stickers order (owner-only RLS). React Query, so the persisted cache keeps
// the sheet working offline once it has loaded; the art itself is bundled (stickerArt.ts).
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { buildCatalog, type StickerCatalog } from './catalog';

export const stickerCatalogQueryKey = (userId: string) => ['stickerCatalog', userId] as const;

async function fetchCatalog(userId: string): Promise<StickerCatalog> {
  const supabase = getSupabase();
  const [packs, stickers, answers, prefs] = await Promise.all([
    supabase
      .from('sticker_packs')
      .select('id, slug, name, sort, tier, store_product_id, available_from, available_to, pack_usable'),
    supabase
      .from('stickers')
      .select('id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort, sticker_usable')
      // Retired stickers (0032) aren't offered; moments that use them still draw their bundled art.
      .is('retired_at', null),
    supabase
      .from('onboarding_answers')
      .select('day_type, whoamiwith, mebusywith, ootd')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('user_pack_prefs').select('pack_id, sort, hidden').eq('user_id', userId),
  ]);
  if (packs.error) throw new Error(packs.error.message);
  if (stickers.error) throw new Error(stickers.error.message);
  // Suggestions still work without the answers (slot hints alone).
  // Without the user's order the sheet still works, in catalog order.
  return buildCatalog(packs.data, stickers.data, answers.error ? null : answers.data, new Date(), prefs.data ?? []);
}

/** The signed-in user's catalog; `data` is undefined while loading or offline with nothing cached. */
export function useStickerCatalog() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: stickerCatalogQueryKey(userId ?? ''),
    queryFn: () => fetchCatalog(userId ?? ''),
    // The default staleness: each editor opens with the cached catalog and refreshes it in the background,
    // so a milestone sticker earned a moment ago shows up.
    enabled: userId !== null,
  });
}
