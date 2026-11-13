import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

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
   * `light` on app backgrounds; `glass` (white icon) over photos and the camera: Liquid Glass on iOS 26, a
   * dark frosted blur below that or with Reduce Transparency on (D-57).
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
        <GlassSurface
          tone="dark"
          radius={radius.pill}
          tint={colors.glass}
          fallbackColor={colors.glass}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          testID="glass"
        />
      ) : null}
      <Icon name={icon} color={glass ? 'surface' : 'ink'} size={22} strokeWidth={2} />
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
  light: { backgroundColor: colors.surface, ...shadow.card },
  // The surface (and its color) is the GlassSurface behind the icon.
  glass: { overflow: 'hidden' },
});
