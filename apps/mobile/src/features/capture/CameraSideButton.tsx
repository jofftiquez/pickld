import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { colors, radius, sizes } from '@/theme/tokens';

export type CameraSideButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  /** `tile`: white-bordered square (gallery shortcut); `round`: translucent circle (flip). */
  shape: 'tile' | 'round';
  testID?: string;
};

/** 52 px buttons beside the shutter (Camera). Already larger than the 44 px minimum. */
export function CameraSideButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  shape,
  testID,
}: CameraSideButtonProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[
        styles.base,
        shape === 'tile' ? styles.tile : styles.round,
        pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <Icon name={icon} color="surface" size={22} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.cameraSideButton,
    height: sizes.cameraSideButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // TODO(M2-08): show the latest gallery photo in the tile once photo library access exists.
  tile: {
    borderRadius: radius.thumbLg,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.onDarkControl,
  },
  round: { borderRadius: radius.pill, backgroundColor: colors.onDarkControl },
});
