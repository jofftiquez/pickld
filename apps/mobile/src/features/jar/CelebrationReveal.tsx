import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

// The content grows from this scale while it fades in (not with Reduce Motion).
const POP_FROM = 0.9;

export type CelebrationRevealProps = {
  /** Reduce Motion: only a fade, no growing (NFR-A11Y-02). */
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Brings in a celebration's content: a pop with confetti, or a plain fade with Reduce Motion. */
export function CelebrationReveal({ reduceMotion, style, children }: CelebrationRevealProps) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(1, {
      duration: reduceMotion ? motion.base : motion.celebrationPop,
      easing: Easing.out(Easing.cubic),
    });
  }, [shown, reduceMotion]);
  const animated = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value }
      : { opacity: shown.value, transform: [{ scale: POP_FROM + (1 - POP_FROM) * shown.value }] },
  );
  return (
    <Animated.View testID={reduceMotion ? 'celebration-fade' : 'celebration-pop'} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
