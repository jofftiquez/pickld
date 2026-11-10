import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion, slots, space } from '@/theme/tokens';

const logo = require('../../assets/brand/splash-logo.png');

// Matches the native splash (same image, width and background) so the hand-off is invisible.
const LOGO_WIDTH = 220;
const LOGO_ASPECT = 1200 / 496;
// Eight squares fill like moments; each one takes half of motion.fast so the whole run stays under a second.
export const SQUARE_STEP_MS = motion.fast / 2;

type SquareProps = { index: number; filled: SharedValue<number> };

function Square({ index, filled }: SquareProps) {
  const style = useAnimatedStyle(() => ({ opacity: filled.value > index ? 1 : 0.4 }));
  return <Animated.View style={[styles.square, style]} />;
}

type Props = {
  /** The overlay starts fading once the app is ready and every square is filled. */
  ready: boolean;
  onHidden: () => void;
};

export function SplashOverlay({ ready, onHidden }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const filled = useSharedValue(reduceMotion ? slots.length : 0);
  const opacity = useSharedValue(1);
  const [squaresDone, setSquaresDone] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    filled.value = withTiming(slots.length, { duration: SQUARE_STEP_MS * slots.length }, (finished) => {
      if (finished) scheduleOnRN(setSquaresDone, true);
    });
  }, [filled, reduceMotion]);

  useEffect(() => {
    if (!ready || !squaresDone) return;
    opacity.value = withTiming(0, { duration: motion.base }, (finished) => {
      if (finished) scheduleOnRN(onHidden);
    });
  }, [ready, squaresDone, opacity, onHidden]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fade]}
      accessible
      accessibilityLabel={t('brand.loading')}
      accessibilityRole="progressbar"
      testID="splash-overlay"
    >
      <Image source={logo} style={styles.logo} contentFit="contain" accessible={false} />
      <View style={styles.footer}>
        <View style={styles.squares}>
          {slots.map((slot, i) => (
            <Square key={slot} index={i} filled={filled} />
          ))}
        </View>
        <Text className="font-jakarta-700 text-body" style={styles.tagline}>
          {t('brand.tagline')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT },
  footer: { position: 'absolute', bottom: space.xxxl * 3, alignItems: 'center', gap: space.md },
  squares: { flexDirection: 'row', gap: space.xs + 2 },
  square: { width: space.md, height: space.md, borderRadius: space.xs - 1, backgroundColor: colors.surface },
  tagline: { color: colors.surface },
});
