import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { MyStickersPane } from './MyStickersPane';
import type { ShopPack } from './shop';
import { StickerShopPane } from './StickerShopPane';
import type { StickersTab } from './stickersTab';

export type StickersHomeProps = {
  /** From `?tab=`; the switch then follows taps. */
  initialTab: StickersTab;
  insets: EdgeInsets;
  onClose: () => void;
  onOpenPack: (pack: ShopPack) => void;
};

/**
 * The Stickers page (D-61; FR-STK-06, FR-STK-08): one title with a Mine | Shop switch over My stickers and
 * the Sticker shop. Opened from Today's header, your profile, Settings and the editor's shop banner.
 */
export function StickersHome({ initialTab, insets, onClose, onOpenPack }: StickersHomeProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<StickersTab>(initialTab);
  // The page draws the top inset; each pane keeps the bottom one for its scroll padding.
  const paneInsets = { ...insets, top: 0 };
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="stickers-home">
      <View style={styles.header}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('stickersHome.title')}
        </Text>
        <RoundIconButton
          icon="close"
          accessibilityLabel={t('stickersHome.close')}
          onPress={onClose}
          testID="stickers-close"
        />
      </View>
      <View style={styles.switch}>
        <SegmentedControl
          segments={[
            { key: 'mine', label: t('stickersHome.mine') },
            { key: 'shop', label: t('stickersHome.shop') },
          ]}
          selected={tab}
          onSelect={setTab}
          accessibilityLabel={t('stickersHome.sections')}
          testID="stickers-tabs"
        />
      </View>
      {tab === 'mine' ? (
        <MyStickersPane insets={paneInsets} onShop={() => setTab('shop')} />
      ) : (
        <StickerShopPane insets={paneInsets} onOpenPack={onOpenPack} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: sizes.headerTop,
    paddingBottom: space.md,
  },
  title: { color: colors.ink, flexShrink: 1 },
  switch: { paddingHorizontal: space.xl, paddingBottom: space.md },
});
