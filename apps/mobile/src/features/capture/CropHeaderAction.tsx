import { Pressable, StyleSheet, Text } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, crop, sizes } from '@/theme/tokens';

export type CropHeaderActionProps = {
  /** Already translated. */
  label: string;
  hint: string;
  onPress: () => void;
  /** Right-aligned (Reset) instead of left (Cancel). */
  end?: boolean;
  testID?: string;
};

/** Cancel or Reset in the Crop header: a text button at least 64 × 44 points. */
export function CropHeaderAction({ label, hint, onPress, end = false, testID }: CropHeaderActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.root, end && styles.end]}
      testID={testID}
    >
      <Text style={[textStyle('body', '600'), styles.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minWidth: crop.headerAction, minHeight: sizes.minTap, justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  text: { color: colors.cropAction },
});
