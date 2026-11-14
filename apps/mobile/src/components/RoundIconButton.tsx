import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { colors, radius, shadow, sizes } from '@/theme/tokens';

import { DISABLED_OPACITY, PRESSED_OPACITY } from './BaseButton';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type RoundIconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons need a spoken name (e.g. "Back", "More options"). Already translated. */
  accessibilityLabel: string;
  onPress: () => void;
  /**
   * `light` on app backgrounds; `glass` (white icon) over photos and the camera: lightly tinted Liquid Glass
   * on iOS 26 (D-80), a dark frosted blur below that or with Reduce Transparency on (D-57).
   */
  variant?: 'light' | 'glass';
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function RoundIconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'light',
  disabled = false,
  accessibilityHint,
  testID,
}: RoundIconButtonProps) {
  const [pressed, setPressed] = useState(false);
  const glass = variant === 'glass';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(sizes.roundButton, sizes.roundButton)}
      testID={testID}
      style={[
        styles.base,
        glass ? styles.glass : styles.light,
        pressed && !disabled ? { opacity: PRESSED_OPACITY } : null,
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      {glass ? (
        // Touches reach the glass for its press shimmer and still press the button.
        <GlassSurface
          tone="dark"
          radius={radius.pill}
          tint={colors.liquidDarkTint}
          interactive
          fallbackColor={colors.glass}
          style={[StyleSheet.absoluteFill, styles.center]}
          testID="glass"
        >
          {(glyph) => (
            // On Liquid Glass a soft shadow keeps the white icon readable over a bright photo (D-80).
            <View style={glyph?.icon}>
              <Icon name={icon} color="surface" size={22} strokeWidth={2} />
            </View>
          )}
        </GlassSurface>
      ) : (
        <Icon name={icon} color="ink" size={22} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.roundButton,
    height: sizes.roundButton,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: colors.surface, ...shadow.card },
  // The surface (and its color) is the GlassSurface holding the icon.
  glass: { overflow: 'hidden' },
});
