import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, sizes } from '@/theme/tokens';

/** How long the square is up: fade in, hold, fade out. The parent removes it after this. */
export const FOCUS_MARK_MS = motion.fast + motion.focusMarkHold + motion.base;

const START_SCALE = 1.25;

/**
 * The square drawn where the viewfinder was tapped to focus (D-144): it settles in, holds, then fades. With
 * Reduce Motion it just appears and the parent takes it away. Decorative: hidden from screen readers.
 */
export function FocusIndicator({ left, top }: { left: number; top: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(START_SCALE);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(
      withSequence(
        withTiming(1, { duration: motion.fast }),
        withDelay(motion.focusMarkHold, withTiming(0, { duration: motion.base })),
      ),
    );
    scale.set(withTiming(1, { duration: motion.base }));
  }, [reduceMotion, opacity, scale]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="camera-focus-mark"
      style={[styles.mark, { left, top }, reduceMotion ? null : animated]}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    width: sizes.focusMark,
    height: sizes.focusMark,
    borderWidth: sizes.focusMarkBorder,
    borderColor: colors.surface,
  },
});
