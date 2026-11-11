import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { textStyle } from '@/theme/text';
import { colors, crop, space } from '@/theme/tokens';

export type CropToolButtonProps = {
  icon: IconName;
  /** Already translated. */
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
};

/** Rotate, Flip or Fit under the crop frame (Crop): icon over a label on a soft tile, 64 points tall. */
export function CropToolButton({
  icon,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  testID,
}: CropToolButtonProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.root, pressed && styles.pressed]}
      testID={testID}
    >
      <Icon name={icon} size={20} strokeWidth={1.9} />
      <Text style={[textStyle('label'), styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: crop.toolButton,
    borderRadius: crop.toolRadius,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
  },
  pressed: { opacity: PRESSED_OPACITY },
  label: { color: colors.ink, textAlign: 'center' },
});
