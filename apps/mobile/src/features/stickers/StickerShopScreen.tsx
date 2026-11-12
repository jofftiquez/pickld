import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildShop } from './shop';
import { StickerShopView } from './StickerShopView';
import { usePrices, useShopRows } from './useShop';

/** /stickers/shop (FR-STK-06): opened from the editor's Stickers tool banner. */
export function StickerShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rows = useShopRows();
  const [query, setQuery] = useState('');
  const shop = useMemo(
    () =>
      rows.data ? buildShop(rows.data.packs, rows.data.stickers, rows.data.answers, new Date(), query) : undefined,
    [rows.data, query],
  );
  // Prices for every pack on sale, whatever the search shows, so typing doesn't refetch them.
  const all = useMemo(
    () => (rows.data ? buildShop(rows.data.packs, rows.data.stickers, rows.data.answers, new Date()) : undefined),
    [rows.data],
  );
  const prices = usePrices(
    all ? [all.seasonal, ...all.forYou].flatMap((p) => (p?.productId ? [p.productId] : [])) : [],
  );
  return (
    <StickerShopView
      shop={shop}
      failed={rows.isError}
      prices={prices}
      query={query}
      onQuery={setQuery}
      insets={insets}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onOpenPack={(pack) => router.push(`/stickers/pack/${pack.slug}`)}
      onRetry={() => void rows.refetch()}
    />
  );
}
