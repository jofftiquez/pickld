import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { useLiquidGlass } from '@/lib/useLiquidGlass';

export type GlassSurfaceProps = {
  /** `dark` over photos and the camera (white content), `light` on app backgrounds (ink content). */
  tone: 'dark' | 'light';
  /** Corner radius; the surface clips its children to it. */
  radius?: number;
  /** Liquid Glass style: `regular` (frosted, the default) or `clear` (more see-through). */
  glassStyle?: 'regular' | 'clear';
  /** Glass tint, a token from `colors`. It keeps labels as readable as the blur look below iOS 26. */
  tint?: ColorValue;
  /** Below iOS 26 or with Reduce Transparency on: today's frosted blur, or a plain view in `fallbackColor`. */
  fallback?: 'blur' | 'none';
  /** Fallback blur strength, so each surface keeps its current look. */
  blurIntensity?: number;
  /** The fallback's background (under the blur, if any), a token from `colors`. */
  fallbackColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: ReactNode;
  /** On the surface; the fallback blur gets `${testID}-blur`. */
  testID?: string;
};

/**
 * A frosted surface for controls (D-57): Liquid Glass (`GlassView`) on iOS 26 and later, and the `BlurView`
 * look below that or with Reduce Transparency on. The surface's size comes from `style`, so swapping one for
 * the other never moves the layout.
 */
export function GlassSurface({
  tone,
  radius = 0,
  glassStyle = 'regular',
  tint,
  fallback = 'blur',
  blurIntensity = 30,
  fallbackColor,
  style,
  pointerEvents,
  children,
  testID,
}: GlassSurfaceProps) {
  const glass = useLiquidGlass();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  if (glass) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        tintColor={tint}
        colorScheme={tone}
        style={[shape, style]}
        pointerEvents={pointerEvents}
        testID={testID}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[shape, fallbackColor ? { backgroundColor: fallbackColor } : null, style]}
      pointerEvents={pointerEvents}
      testID={testID}
    >
      {fallback === 'blur' ? (
        <BlurView
          intensity={blurIntensity}
          tint={tone}
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-blur` : undefined}
        />
      ) : null}
      {children}
    </View>
  );
}
