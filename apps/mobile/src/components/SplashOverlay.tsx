import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MAX_LAYERS, VIEW_H, VIEW_W } from './JarGraphic';
import { SplashJar } from './SplashJar';
import { colors, motion, splash } from '@/theme/tokens';

const logo = require('../../assets/brand/splash-logo.png');

// Same canvas as the native launch image (assets/brand/splash.png): centered on screen, the jar in its middle
// and the logo on its bottom edge, so the hand-off from the launch screen doesn't move anything.
const JAR_HEIGHT = (splash.jarWidth * VIEW_H) / VIEW_W;
const LOGO_HEIGHT = (splash.logoWidth * 496) / 1200;

// While the app loads, one layer lands every SPLASH_LOADING_STEP_MS up to SPLASH_HOLD_LAYERS; the last layer
// waits for loading to finish. Once it has, whatever is left fills in SPLASH_COMPLETE_MS and the splash fades
// out in motion.base, so an app that is ready at once hands over in half a second.
export const SPLASH_LOADING_STEP_MS = motion.fast;
export const SPLASH_HOLD_LAYERS = MAX_LAYERS - 1;
export const SPLASH_COMPLETE_MS = motion.base;
export const SPLASH_FADE_MS = motion.base;

type Props = {
  /** The app has finished loading: the jar fills the rest of the way and the overlay fades out. */
  ready: boolean;
  onHidden: () => void;
};

export function SplashOverlay({ ready, onHidden }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  // Layers in the jar, 0–8. Starts empty, like the native launch image.
  const level = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const fadeOut = () => {
      'worklet';
      opacity.value = withTiming(0, { duration: SPLASH_FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(onHidden);
      });
    };
    // Reduce Motion: the jar stays still; the splash only cross-fades to the app.
    if (reduceMotion) {
      if (ready) fadeOut();
      return;
    }
    if (!ready) {
      level.value = withTiming(SPLASH_HOLD_LAYERS, {
        duration: SPLASH_HOLD_LAYERS * SPLASH_LOADING_STEP_MS,
        easing: Easing.linear,
      });
      return;
    }
    level.value = withTiming(
      MAX_LAYERS,
      { duration: SPLASH_COMPLETE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) fadeOut();
      },
    );
  }, [ready, reduceMotion, level, opacity, onHidden]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fade]}
      accessible
      accessibilityLabel={t('brand.loading')}
      accessibilityRole="progressbar"
      testID="splash-overlay"
    >
      <View style={styles.canvas}>
        <View style={styles.jar}>
          <SplashJar level={level} />
        </View>
        <Image source={logo} style={styles.logo} contentFit="contain" accessible={false} testID="splash-logo" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  canvas: { width: splash.canvasWidth, height: splash.canvasHeight },
  jar: {
    position: 'absolute',
    left: (splash.canvasWidth - splash.jarWidth) / 2,
    top: (splash.canvasHeight - JAR_HEIGHT) / 2,
  },
  logo: {
    position: 'absolute',
    left: (splash.canvasWidth - splash.logoWidth) / 2,
    bottom: 0,
    width: splash.logoWidth,
    height: LOGO_HEIGHT,
  },
});
