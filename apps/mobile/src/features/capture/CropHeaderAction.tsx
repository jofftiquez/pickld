import { Pressable, StyleSheet, Text } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, crop, sizes } from '@/theme/tokens';

export type CropHeaderActionProps = {
  /** Already translated. */
  label: string;
  hint: string;
  onPress: () => void;
  testID?: string;
};

/** Cancel in the Crop header: a text button at least 64 × 44 points. */
export function CropHeaderAction({ label, hint, onPress, testID }: CropHeaderActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.root}
      testID={testID}
    >
      <Text style={[textStyle('body', '600'), styles.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minWidth: crop.headerAction, minHeight: sizes.minTap, justifyContent: 'center' },
  text: { color: colors.cropAction },
});
