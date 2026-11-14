import { useMemo, useState } from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { buildShop, type ShopPack } from './shop';
import { StickerShopView } from './StickerShopView';
import { usePackThumbs } from './usePackThumbs';
import { usePrices, useShopRows } from './useShop';

export type StickerShopPaneProps = {
  insets: EdgeInsets;
  /** Opens Pack preview. */
  onOpenPack: (pack: ShopPack) => void;
};

/** Shop on the Stickers page (FR-STK-06, D-61): loads the packs and store prices for StickerShopView. */
export function StickerShopPane({ insets, onOpenPack }: StickerShopPaneProps) {
  const rows = useShopRows();
  const { thumbs } = usePackThumbs();
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
      thumbs={thumbs}
      query={query}
      onQuery={setQuery}
      insets={insets}
      onOpenPack={onOpenPack}
      onRetry={() => void rows.refetch()}
    />
  );
}
