import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SecondaryButton } from '@/components/SecondaryButton';
import { usePrices } from '@/features/stickers/useShop';
import { textStyle } from '@/theme/text';
import { colors, radius, space, stickerTool, type Slot } from '@/theme/tokens';

import { suggestionsFor, type CatalogSticker } from './catalog';
import { stickerArtFor } from './stickerArt';
import { StickerImage } from './StickerImage';
import { useStickerCatalog } from './useStickerCatalog';

export type StickersPanelProps = {
  /** The photo's slot: its suggestions lead (FR-STK-03). */
  slot: Slot;
  onAdd: (sticker: CatalogSticker) => void;
};

const SUGGESTED = 'suggested';
// The grid shows three rows and scrolls inside the editor for longer packs.
const VISIBLE_ROWS = 3;

function rowsOf<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * The Stickers tool's panel (design: Stickers; FR-CAP-05, FR-STK-01..03): pack tabs led by "For #slot",
 * and a grid of the selected tab's stickers; tapping one adds it to the photo. Packs on sale that the user
 * doesn't own follow as locked tabs that open Pack preview, and a banner under the grid leads to the shop
 * (FR-STK-06, reversing D-6).
 */
export function StickersPanel({ slot, onAdd }: StickersPanelProps) {
  const { t } = useTranslation();
  const catalog = useStickerCatalog();
  const router = useRouter();
  const [selected, setSelected] = useState<string>(SUGGESTED);
  // A catalog persisted by an app version before the shop has no `locked` list.
  const locked = catalog.data?.locked ?? [];
  const seasonal = locked.find((pack) => pack.seasonal) ?? null;
  const prices = usePrices(seasonal ? [seasonal.productId] : []);

  if (!catalog.data) {
    return catalog.isError ? (
      <View style={styles.message} testID="stickers-unavailable">
        <Text style={[textStyle('bodySmall'), styles.messageText]}>{t('editStickers.unavailable')}</Text>
        <SecondaryButton label={t('editStickers.retry')} onPress={() => void catalog.refetch()} />
      </View>
    ) : (
      <View style={styles.message} testID="stickers-loading">
        <Text style={[textStyle('bodySmall'), styles.messageText]}>{t('editStickers.loading')}</Text>
      </View>
    );
  }

  const suggested = suggestionsFor(catalog.data, slot);
  const tabs = [
    ...(suggested.length > 0
      ? [{ key: SUGGESTED, label: t('editStickers.forSlot', { slot: t(`slots.${slot}`) }), slug: null }]
      : []),
    ...catalog.data.packs.map((pack) => ({ key: pack.id, label: pack.name, slug: pack.slug })),
  ];
  const price = seasonal ? prices.get(seasonal.productId) : undefined;
  // A pack that went away (or no suggestions) falls back to the first tab.
  const current = tabs.find((tab) => tab.key === selected) ?? tabs[0];
  const stickers =
    current === undefined
      ? []
      : current.key === SUGGESTED
        ? suggested
        : (catalog.data.packs.find((pack) => pack.id === current.key)?.stickers ?? []);
  const rowHeight = stickerTool.cellHeight + space.sm;

  return (
    <View style={styles.root} testID="stickers-panel">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={t('editStickers.packs')}
        contentContainerStyle={styles.tabs}
        style={styles.tabsScroller}
        testID="stickers-tabs"
      >
        {tabs.map((tab) => {
          const isSelected = tab.key === current?.key;
          const tint =
            tab.slug === null
              ? stickerTool.packTintDefault
              : (stickerTool.packTint[tab.slug] ?? stickerTool.packTintDefault);
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(tab.key)}
              // 36 px tab: 4 px above and below reach the 44 px minimum.
              hitSlop={{ top: space.xs, bottom: space.xs }}
              style={[styles.tab, { backgroundColor: isSelected ? colors.ink : tint }]}
              testID={`stickers-tab-${tab.slug ?? SUGGESTED}`}
            >
              <Text style={[textStyle('label', '700'), { color: isSelected ? colors.surface : colors.ink }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        {locked.map((pack) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            accessibilityLabel={t('editStickers.locked', { name: pack.name })}
            accessibilityHint={t('editStickers.lockedHint')}
            onPress={() => router.push(`/stickers/pack/${pack.slug}`)}
            hitSlop={{ top: space.xs, bottom: space.xs }}
            style={[
              styles.tab,
              styles.lockedTab,
              { backgroundColor: stickerTool.packTint[pack.slug] ?? stickerTool.packTintDefault },
            ]}
            testID={`stickers-locked-${pack.slug}`}
          >
            <Icon name="lock" size={14} strokeWidth={2.2} />
            <Text style={[textStyle('label', '700'), { color: colors.ink }]}>{pack.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={{ maxHeight: rowHeight * VISIBLE_ROWS - space.sm }}
        nestedScrollEnabled
        accessibilityLabel={t('editStickers.grid')}
        contentContainerStyle={styles.grid}
        testID="stickers-grid"
      >
        {rowsOf(stickers, stickerTool.cellColumns).map((row) => (
          <View key={row.map((s) => s.id).join()} style={styles.row}>
            {row.map((sticker) => {
              const art = stickerArtFor(sticker.asset);
              // Wide word art keeps the short box; near-square pictures (0032) get the taller one.
              const height =
                art && art.width < art.height * 1.6 ? stickerTool.cellPictureHeight : stickerTool.cellArtHeight;
              return (
                <Pressable
                  key={sticker.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('editStickers.add', { label: sticker.label })}
                  accessibilityHint={t('editStickers.addHint')}
                  onPress={() => onAdd(sticker)}
                  style={styles.cell}
                  testID={`sticker-option-${sticker.id}`}
                >
                  <StickerImage
                    asset={sticker.asset}
                    stamp={sticker.stamp}
                    width={art ? (height * art.width) / art.height : height}
                    height={height}
                  />
                </Pressable>
              );
            })}
            {Array.from({ length: stickerTool.cellColumns - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={styles.cellGap} />
            ))}
          </View>
        ))}
      </ScrollView>
      {locked.length > 0 ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={
            seasonal
              ? t('editStickers.shopNewLabel', { name: seasonal.name, price: price ?? '' })
              : t('editStickers.shopMore')
          }
          accessibilityHint={t('editStickers.shopHint')}
          onPress={() => router.push('/stickers/shop')}
          style={styles.shopBanner}
          testID="stickers-shop-banner"
        >
          <Text style={[textStyle('bodySmall', '700'), styles.shopText]} numberOfLines={1}>
            {seasonal
              ? price
                ? t('editStickers.shopNewPrice', { name: seasonal.name, price })
                : t('editStickers.shopNew', { name: seasonal.name })
              : t('editStickers.shopMore')}
          </Text>
          <Text style={[textStyle('bodySmall', '800'), { color: stickerTool.shopBannerLink }]}>
            {t('editStickers.shop')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md + 2 },
  // The tabs run to the sheet's right edge, as designed.
  tabsScroller: { marginRight: -space.xl },
  tabs: { gap: space.sm, paddingRight: space.xl },
  tab: {
    minHeight: stickerTool.packTabHeight,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTab: { flexDirection: 'row', gap: space.xs + 2 },
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  cell: {
    flex: 1,
    height: stickerTool.cellHeight,
    borderRadius: stickerTool.cellRadius,
    backgroundColor: stickerTool.cell,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    overflow: 'hidden',
  },
  cellGap: { flex: 1 },
  shopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: stickerTool.shopBannerRadius,
    backgroundColor: stickerTool.shopBanner,
  },
  shopText: { flex: 1, color: colors.ink },
  message: { gap: space.md, minHeight: stickerTool.cellHeight, justifyContent: 'center' },
  messageText: { color: colors.muted },
});
