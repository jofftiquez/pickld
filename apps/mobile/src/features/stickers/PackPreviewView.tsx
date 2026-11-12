import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { stickerArtFor } from '@/features/edit/stickers/stickerArt';
import { StickerImage } from '@/features/edit/stickers/StickerImage';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, sizes, space, stickerShop } from '@/theme/tokens';

import type { ShopPack } from './shop';

export type PackPreviewViewProps = {
  /** Undefined while loading; null when no pack has this slug. */
  pack: ShopPack | null | undefined;
  failed?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onRetry: () => void;
};

/**
 * Pack preview (PackPreview; FR-STK-07): a pack's name, story and every sticker. Locked tabs in the Stickers
 * tool and every pack in the shop open it.
 */
export function PackPreviewView({ pack, failed = false, insets, onBack, onRetry }: PackPreviewViewProps) {
  const { t } = useTranslation();
  const height = stickerShop.sampleHeight + 8;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="pack-preview">
      <View style={styles.header}>
        <RoundIconButton
          icon="back"
          accessibilityLabel={t('packPreview.back')}
          onPress={onBack}
          testID="pack-preview-back"
        />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {pack === undefined || pack === null ? (
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
              <Text style={[textStyle('body', '400'), { color: colors.inkSoft }]}>{pack.description}</Text>
            ) : null}
            <View
              style={styles.cloud}
              accessibilityLabel={pack.labels.join(', ')}
              accessible
              testID="pack-preview-stickers"
            >
              {pack.stickers.map((sticker) => {
                const art = stickerArtFor(sticker.asset);
                return (
                  <StickerImage
                    key={sticker.asset}
                    asset={sticker.asset}
                    width={art ? (height * art.width) / art.height : height}
                    height={height}
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: space.xl, paddingTop: sizes.headerTop, paddingBottom: space.md },
  content: { paddingHorizontal: space.xl, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  title: { color: colors.ink, flexShrink: 1 },
  cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  message: { gap: space.md, paddingVertical: space.xxl },
  center: { textAlign: 'center', color: colors.muted },
});
