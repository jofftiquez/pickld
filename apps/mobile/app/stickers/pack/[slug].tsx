import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackPreviewView } from '@/features/stickers/PackPreviewView';
import { buildPacks } from '@/features/stickers/shop';
import { useShopRows } from '@/features/stickers/useShop';

// /stickers/pack/[slug] (M6-02, FR-STK-07): Pack preview, from a locked tab in the Stickers tool or the shop.
export default function PackPreviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rows = useShopRows();
  const pack = useMemo(
    () =>
      rows.data
        ? (buildPacks(rows.data.packs, rows.data.stickers, new Date()).find((p) => p.slug === slug) ?? null)
        : undefined,
    [rows.data, slug],
  );
  return (
    <PackPreviewView
      pack={pack}
      failed={rows.isError}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onRetry={() => void rows.refetch()}
    />
  );
}
