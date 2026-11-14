import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type MonthChipProps = {
  /** Short month name drawn on the chip ("Feb"). */
  label: string;
  /** Spoken name with the year ("February 2025"). */
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** One month in the month picker (FR-DAY-01): a Chip-styled radio, ink with white text when it is the shown month. */
export function MonthChip({ label, accessibilityLabel, selected, onPress, testID }: MonthChipProps) {
  // Plain style array, not a style function: NativeWind's Pressable wrapper drops function styles on device.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.chip)}
      testID={testID}
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <Text style={[textStyle('bodyMedium', '700'), { color: selected ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.chip,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
});
