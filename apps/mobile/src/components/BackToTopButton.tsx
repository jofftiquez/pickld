import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { shadow, sizes, space } from '@/theme/tokens';

import { BaseButton } from './BaseButton';

export type BackToTopButtonProps = {
  onPress: () => void;
  /** Distance from the screen's bottom edge: the list's bottom padding, so the pill floats above the tab bar. */
  bottom: number;
  testID?: string;
};

/** A white pill centred over the bottom of a feed, above the tab bar (useBackToTop decides when it shows). */
export function BackToTopButton({ onPress, bottom, testID = 'back-to-top' }: BackToTopButtonProps) {
  const { t } = useTranslation();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {/* The button hugs its label (alignSelf: flex-start); this box is what the row centres. */}
      <View>
        <BaseButton
          label={t('feed.backToTop')}
          icon="arrowUp"
          onPress={onPress}
          testID={testID}
          tone={{
            background: 'surface',
            text: 'ink',
            height: sizes.pillButton,
            textVariant: 'bodySmall',
            textWeight: '700',
            paddingHorizontal: space.lg,
            shadow: shadow.floating,
            stretch: false,
            icon: { size: 16, strokeWidth: 2.4 },
            maxTextScale: 1.5,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
