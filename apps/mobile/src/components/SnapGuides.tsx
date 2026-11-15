import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated';

import { colors, motion, sizes } from '@/theme/tokens';

export type SnapGuidesProps = {
  /** The vertical centre line: the dragged thing is centred left to right. A plain flag or a shared value. */
  vertical: boolean | SharedValue<boolean>;
  /** The horizontal centre line: the dragged thing is centred top to bottom. */
  horizontal: boolean | SharedValue<boolean>;
  /** The lines get `<testID>-vertical` and `<testID>-horizontal`. */
  testID?: string;
};

/**
 * Centre snap guides (D-158): a thin line down and/or across the middle of the parent, shown while a drag is
 * snapped to its centre (see lib/image/snap.ts). They fade in and out quickly; with Reduce Motion they just show
 * and hide. Absolute fill, touches pass through, and decorative: hidden from VoiceOver.
 */
export function SnapGuides({ vertical, horizontal, testID = 'snap-guides' }: SnapGuidesProps) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Guide on={vertical} style={styles.vertical} testID={`${testID}-vertical`} />
      <Guide on={horizontal} style={styles.horizontal} testID={`${testID}-horizontal`} />
    </View>
  );
}

function Guide({ on, style, testID }: { on: boolean | SharedValue<boolean>; style: ViewStyle; testID: string }) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => {
    const opacity = (typeof on === 'boolean' ? on : on.get()) ? 1 : 0;
    return { opacity: reduceMotion ? opacity : withTiming(opacity, { duration: motion.fast }) };
  }, [on, reduceMotion]);
  return <Animated.View style={[styles.line, style, animated]} testID={testID} />;
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    backgroundColor: colors.snapGuide,
    shadowColor: colors.snapGuideShadow,
    shadowOpacity: 1,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  vertical: { top: 0, bottom: 0, left: '50%', width: sizes.snapGuideWidth, marginLeft: -sizes.snapGuideWidth / 2 },
  horizontal: { left: 0, right: 0, top: '50%', height: sizes.snapGuideWidth, marginTop: -sizes.snapGuideWidth / 2 },
});
