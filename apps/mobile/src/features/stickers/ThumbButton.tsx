import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { tapHaptic } from '@/lib/haptics';
import { hitSlopFor } from '@/lib/hitSlop';
import { usePop } from '@/lib/usePop';
import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

export type ThumbButtonProps = {
  count: number;
  thumbed: boolean;
  onPress: () => void;
  testID?: string;
};

const HEIGHT = 40;
// A new thumb springs in from this share of its size, like a like's heart (D-58, D-77).
const THUMB_POP_FROM = 0.6;

/** Thumbs up on Pack preview (FR-STK-07): the like pill's shape, pop and light haptic, in the brand green. */
export function ThumbButton({ count, thumbed, onPress, testID = 'pack-thumb' }: ThumbButtonProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();
  const thumb = usePop(thumbed, THUMB_POP_FROM);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('packPreview.thumbs', { count })}
      accessibilityHint={thumbed ? t('packPreview.unthumbHint') : t('packPreview.thumbHint')}
      accessibilityState={{ selected: thumbed }}
      onPress={() => {
        if (!thumbed) tapHaptic();
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, HEIGHT)}
      style={[styles.pill, pressed ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <Animated.View style={thumb} testID={thumbed ? `thumb-icon-${reduceMotion ? 'fade' : 'pop'}` : 'thumb-icon'}>
        <Icon name="thumbsUp" color="brandText" size={16} strokeWidth={2.2} filled={thumbed} />
      </Animated.View>
      <Text style={[textStyle('bodyMedium', '700'), { color: colors.brandText }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: HEIGHT,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
});
