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

export type LikeButtonProps = {
  count: number;
  liked: boolean;
  /** Pill height: 44 on the Jar page bar, 46 in Moment detail's sheet. */
  height: number;
  onPress: () => void;
  testID?: string;
};

// A new like's heart springs in from this share of its size (D-58, D-77).
const HEART_POP_FROM = 0.6;

/** The like count pill on the Jar page, Moment detail and the Moments timeline (Story, Moment; FR-SOC-05): a
 * filled heart once liked, which pops in with a light haptic (D-58). */
export function LikeButton({ count, liked, height, onPress, testID }: LikeButtonProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();
  const heart = usePop(liked, HEART_POP_FROM);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('jarPage.likes', { count })}
      accessibilityHint={liked ? t('jarPage.unlikeHint') : t('jarPage.likeHint')}
      accessibilityState={{ selected: liked }}
      onPress={() => {
        if (!liked) tapHaptic();
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, height)}
      style={[styles.pill, { height }, pressed ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <Animated.View style={heart} testID={liked ? `like-heart-${reduceMotion ? 'fade' : 'pop'}` : 'like-heart'}>
        <Icon name="heart" color="likeText" size={16} strokeWidth={2.2} filled={liked} />
      </Animated.View>
      <Text style={[textStyle('bodyMedium', '700'), { color: colors.likeText }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerTint,
  },
});
