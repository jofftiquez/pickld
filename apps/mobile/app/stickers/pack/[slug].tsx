import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackPreviewView } from '@/features/stickers/PackPreviewView';
import { buildPacks } from '@/features/stickers/shop';
import { useBuyPack } from '@/features/stickers/usePackPreview';
import { usePackThumbs } from '@/features/stickers/usePackThumbs';
import { usePrices, useShopRows } from '@/features/stickers/useShop';
import { WEB_BASE_URL } from '@/lib/links';

// /stickers/pack/[slug] (M6-02, M6-03; FR-STK-07): Pack preview, from a locked tab in the Stickers tool or the shop.
export default function PackPreviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const rows = useShopRows();
  const buy = useBuyPack();
  const thumbs = usePackThumbs();
  const pack = useMemo(
    () =>
      rows.data
        ? (buildPacks(rows.data.packs, rows.data.stickers, new Date()).find((p) => p.slug === slug) ?? null)
        : undefined,
    [rows.data, slug],
  );
  const prices = usePrices(pack?.productId ? [pack.productId] : []);
  return (
    <PackPreviewView
      pack={pack}
      failed={rows.isError}
      price={pack?.productId ? prices.get(pack.productId) : undefined}
      buying={buy.isPending}
      buyFailed={buy.isError}
      thumbs={pack ? thumbs.thumbs?.get(pack.id) : undefined}
      onThumb={() => {
        if (pack) thumbs.toggle(pack.id);
      }}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onRetry={() => void rows.refetch()}
      onBuy={() => {
        if (pack?.productId) buy.mutate(pack.productId);
      }}
      onShare={() => {
        if (pack) void Share.share({ message: t('packPreview.shareMessage', { name: pack.name, url: WEB_BASE_URL }) });
      }}
    />
  );
}
