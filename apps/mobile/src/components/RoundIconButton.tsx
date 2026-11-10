import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { colors, radius, shadow, sizes } from '@/theme/tokens';

import { DISABLED_OPACITY, PRESSED_OPACITY } from './BaseButton';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type RoundIconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons need a spoken name (e.g. "Back", "More options"). Already translated. */
  accessibilityLabel: string;
  onPress: () => void;
  /** `light` on app backgrounds; `glass` (frosted, white icon) over photos and the camera. */
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
      {glass ? <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} testID="glass-blur" /> : null}
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
  glass: { backgroundColor: colors.glass, overflow: 'hidden' },
});
