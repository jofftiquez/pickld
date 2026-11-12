import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { stickerArtFor } from '@/features/edit/stickers/stickerArt';
import { StickerImage } from '@/features/edit/stickers/StickerImage';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, sizes, space, stickerShop, stickerTool } from '@/theme/tokens';

import type { ShopPack } from './shop';

/** How many stickers the cloud shows before "+N more" (PackPreview). */
export const PREVIEW_STICKERS = 12;

export type PackPreviewViewProps = {
  /** Undefined while loading; null when no pack has this slug. */
  pack: ShopPack | null | undefined;
  failed?: boolean;
  /** The store's price for the pack, or undefined when the store has none (nothing to buy). */
  price?: string;
  /** The user's latest photo to preview stickers on; null shows the pack tint only. */
  photoUrl?: string | null;
  buying?: boolean;
  buyFailed?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onRetry: () => void;
  onBuy: () => void;
  onShare: () => void;
};

/**
 * Pack preview (PackPreview; FR-STK-07): two of the pack's stickers on the user's own photo, its story, its
 * stickers and \"Get <pack> · <price>\". Locked tabs in the Stickers tool and every pack in the shop open it.
 */
export function PackPreviewView({
  pack,
  failed = false,
  price,
  photoUrl = null,
  buying = false,
  buyFailed = false,
  insets,
  onBack,
  onRetry,
  onBuy,
  onShare,
}: PackPreviewViewProps) {
  const { t } = useTranslation();
  const ready = pack !== undefined && pack !== null;
  const tint = ready ? (stickerTool.packTint[pack.slug] ?? stickerTool.packTintDefault) : colors.background;
  const shown = ready ? pack.stickers.slice(0, PREVIEW_STICKERS) : [];
  const more = ready ? pack.stickers.length - shown.length : 0;
  const canBuy = ready && !pack.owned && pack.onSale && !!pack.productId && !!price;

  return (
    <View style={styles.screen} testID="pack-preview">
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <View style={[styles.hero, { backgroundColor: tint, paddingTop: insets.top + sizes.headerTop }]}>
          <View style={styles.header}>
            <RoundIconButton
              icon="back"
              accessibilityLabel={t('packPreview.back')}
              onPress={onBack}
              testID="pack-preview-back"
            />
            {ready ? (
              <RoundIconButton
                icon="share"
                accessibilityLabel={t('packPreview.share', { name: pack.name })}
                onPress={onShare}
                testID="pack-preview-share"
              />
            ) : null}
          </View>
          {ready ? (
            <View style={styles.stage} accessible={false} importantForAccessibility="no-hide-descendants">
              <View style={styles.photoCard}>
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    contentFit="cover"
                    testID="pack-preview-photo"
                  />
                ) : (
                  <View style={[styles.photo, { backgroundColor: colors.surface }]} />
                )}
              </View>
              {pack.stickers[1] ? <Sample sticker={pack.stickers[1]} style={styles.sampleTop} rotate={-6} /> : null}
              {(pack.stickers[4] ?? pack.stickers[0]) ? (
                <Sample sticker={(pack.stickers[4] ?? pack.stickers[0])!} style={styles.sampleBottom} rotate={3} />
              ) : null}
            </View>
          ) : null}
          {ready && photoUrl ? (
            <View style={styles.previewPill}>
              <Text style={[textStyle('label', '700'), { color: stickerTool.shopBannerLink }]}>
                {t('packPreview.onYourPhoto')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {!ready ? (
            <View style={styles.message}>
              <Text style={[textStyle('body'), styles.center]}>
                {pack === null ? t('packPreview.missing') : failed ? t('packPreview.failed') : t('packPreview.loading')}
              </Text>
              {failed && pack === undefined ? (
                <SecondaryButton label={t('packPreview.retry')} onPress={onRetry} testID="pack-preview-retry" />
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.titleRow}>
                <Text
                  maxFontSizeMultiplier={maxTextScale.title}
                  accessibilityRole="header"
                  style={[textStyle('screenTitle'), styles.title]}
                >
                  {pack.name}
                </Text>
                <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>
                  {t('stickerShop.count', { count: pack.stickerCount })}
                </Text>
              </View>
              {pack.description ? (
                <Text style={[textStyle('body', '400'), { color: colors.muted }]}>{pack.description}</Text>
              ) : null}
              <View
                style={styles.cloud}
                accessibilityLabel={pack.labels.join(', ')}
                accessible
                testID="pack-preview-stickers"
              >
                {shown.map((sticker) => (
                  <Sample key={sticker.asset} sticker={sticker} height={stickerShop.cloudSampleHeight} />
                ))}
                {more > 0 ? (
                  <Text style={[textStyle('bodyMedium', '700'), styles.more]}>
                    {t('packPreview.more', { count: more })}
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {ready ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          {pack.owned ? (
            <Text style={[textStyle('bodyMedium', '700'), styles.center, { color: colors.brandText }]}>
              {t('packPreview.owned')}
            </Text>
          ) : canBuy ? (
            <>
              <PrimaryButton
                label={buying ? t('packPreview.buying') : t('packPreview.buy', { name: pack.name, price })}
                onPress={onBuy}
                disabled={buying}
                testID="pack-preview-buy"
              />
              <Text
                style={[textStyle('label', '400'), styles.center, { color: buyFailed ? colors.danger : colors.muted }]}
              >
                {buyFailed ? t('packPreview.buyFailed') : t('packPreview.keep')}
              </Text>
            </>
          ) : (
            <Text style={[textStyle('label', '400'), styles.center]}>{t('packPreview.notForSale')}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Sample({
  sticker,
  height = stickerShop.heroSampleHeight,
  rotate = 0,
  style,
}: {
  sticker: { asset: string };
  height?: number;
  rotate?: number;
  style?: object;
}) {
  const art = stickerArtFor(sticker.asset);
  return (
    <View style={[style, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null]}>
      <StickerImage asset={sticker.asset} width={art ? (height * art.width) / art.height : height} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: {
    borderBottomLeftRadius: stickerShop.heroRadius,
    borderBottomRightRadius: stickerShop.heroRadius,
    paddingHorizontal: space.xl,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { height: stickerShop.heroStageHeight, alignItems: 'center', justifyContent: 'flex-end' },
  photoCard: {
    width: stickerShop.heroPhotoWidth,
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 5,
    marginBottom: -16,
    transform: [{ rotate: '-3deg' }],
  },
  photo: { flex: 1, borderRadius: 15 },
  sampleTop: { position: 'absolute', top: 26, left: 44 },
  sampleBottom: { position: 'absolute', bottom: 30, right: 44 },
  previewPill: {
    position: 'absolute',
    left: space.lg,
    bottom: space.lg,
    backgroundColor: colors.surface,
    opacity: 0.92,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  title: { color: colors.ink, flexShrink: 1 },
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.xs,
    rowGap: space.xs,
    marginTop: space.xs,
  },
  more: { color: colors.muted, paddingHorizontal: space.sm },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm, backgroundColor: colors.background },
  message: { gap: space.md, paddingVertical: space.xxl },
  center: { textAlign: 'center', color: colors.muted },
});
