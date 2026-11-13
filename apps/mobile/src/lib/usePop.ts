import { useLayoutEffect, useRef } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

// A springy settle that overshoots a little past full size, then rests (D-77).
const SPRING = { damping: 11, stiffness: 260, mass: 0.8 };

/**
 * A pop for a small moment (a slot filling, a like landing; D-58): each time `play` turns true the view grows
 * from `from` of its size with a spring. With Reduce Motion it fades in instead, without moving (NFR-A11Y-02).
 * At rest the style changes nothing. `onMount` also plays it when the view mounts with `play` true.
 */
export function usePop(play: boolean, from: number, onMount = false) {
  const reduceMotion = useReducedMotion();
  // 1 is at rest. Only a change to true after mount plays; a layout effect, so the first frame starts small.
  const progress = useSharedValue(1);
  const played = useRef(onMount ? false : play);
  useLayoutEffect(() => {
    if (play && !played.current) {
      progress.value = 0;
      progress.value = reduceMotion ? withTiming(1, { duration: motion.base }) : withSpring(1, SPRING);
    }
    played.current = play;
  }, [play, progress, reduceMotion]);
  return useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { transform: [{ scale: from + (1 - from) * progress.value }] },
  );
}
