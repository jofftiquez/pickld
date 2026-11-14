import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { useLiquidGlass } from '@/lib/useLiquidGlass';
import { glassGlyph } from '@/theme/tokens';

/** What content adds on Liquid Glass so it stays readable (D-80): a text shadow and an icon shadow. */
export type GlassGlyph = (typeof glassGlyph)[keyof typeof glassGlyph];

export type GlassSurfaceProps = {
  /** `dark` over photos and the camera (white content), `light` on app backgrounds (ink content). */
  tone: 'dark' | 'light';
  /** Corner radius; the surface clips its children to it. */
  radius?: number;
  /** Liquid Glass style: `regular` (frosted, the default) or `clear` (more see-through). */
  glassStyle?: 'regular' | 'clear';
  /** Liquid Glass tint, a `liquid…` token from `colors` (D-80); light, so the glass shows. */
  tint?: ColorValue;
  /** Liquid Glass reacts to touch (iOS's press shimmer), for pressable glass. Needs touches to reach it. */
  interactive?: boolean;
  /** Below iOS 26 or with Reduce Transparency on: today's frosted blur, or a plain view in `fallbackColor`. */
  fallback?: 'blur' | 'none';
  /** Fallback blur strength, so each surface keeps its current look. */
  blurIntensity?: number;
  /** The fallback's background (under the blur, if any), a token from `colors`. */
  fallbackColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /**
   * Content, or a function that gets the tone's `glassGlyph` shadows on Liquid Glass (null on the fallback,
   * which needs none), so labels and icons stay readable on the lighter tints (D-80).
   */
  children?: ReactNode | ((glyph: GlassGlyph | null) => ReactNode);
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
  interactive = false,
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
  const content = typeof children === 'function' ? children(glass ? glassGlyph[tone] : null) : children;
  if (glass) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        tintColor={tint}
        isInteractive={interactive}
        colorScheme={tone}
        style={[shape, style]}
        pointerEvents={pointerEvents}
        testID={testID}
      >
        {content}
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
      {content}
    </View>
  );
}
