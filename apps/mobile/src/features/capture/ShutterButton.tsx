import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { colors, radius, sizes } from '@/theme/tokens';

export type ShutterButtonProps = {
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  disabled?: boolean;
};

/** The camera shutter: a white ring around a white disc (Camera). 84 px, so no hitSlop needed. */
export function ShutterButton({
  accessibilityLabel,
  accessibilityHint,
  onPress,
  disabled = false,
}: ShutterButtonProps) {
  const [pressed, setPressed] = useState(false);
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
      testID="camera-shutter"
      style={[styles.ring, disabled ? { opacity: DISABLED_OPACITY } : null]}
    >
      <View style={[styles.disc, pressed && !disabled ? { opacity: PRESSED_OPACITY } : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: sizes.shutter,
    height: sizes.shutter,
    borderRadius: radius.pill,
    borderWidth: sizes.shutterRing,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: sizes.shutterInner,
    height: sizes.shutterInner,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
