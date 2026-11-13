import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PUBLISH_CELEBRATION_MS } from '@/features/publish/publishCelebration';
import { motion } from '@/theme/tokens';

import { Confetti } from './Confetti';

/**
 * The confetti over Today or the day page after Publish (D-58, D-77): the Full jar celebration's pieces fall
 * once, then fade out. With Reduce Motion there is no confetti; the lid's fade on the jar card stays.
 */
export function PublishBurst() {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(1);
  useEffect(() => {
    shown.value = withDelay(PUBLISH_CELEBRATION_MS - motion.base, withTiming(0, { duration: motion.base }));
  }, [shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  if (reduceMotion) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="publish-burst">
      <Confetti />
    </Animated.View>
  );
}
