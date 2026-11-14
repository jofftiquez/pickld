import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type MonthChipProps = {
  /** Text drawn on the chip: a short month name ("Feb"), a year ("2025") or a day ("9"). */
  label: string;
  /** Spoken name, in full ("February 2025"). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` (default) for a choice in a group; `button` for a chip that goes somewhere (a day). */
  accessibilityRole?: 'radio' | 'button';
  /** No side padding, for the narrow day columns of the date picker. */
  compact?: boolean;
  testID?: string;
};

/**
 * One month, year or day in the month and date pickers (FR-DAY-01, FR-DAY-02): a Chip-styled radio, ink with
 * white text when selected.
 */
export function MonthChip({
  label,
  accessibilityLabel,
  accessibilityHint,
  selected,
  onPress,
  accessibilityRole = 'radio',
  compact = false,
  testID,
}: MonthChipProps) {
  // Plain style array, not a style function: NativeWind's Pressable wrapper drops function styles on device.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityRole === 'radio' ? { checked: selected } : undefined}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.chip)}
      testID={testID}
      style={[
        styles.base,
        compact ? styles.compact : null,
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
  compact: { paddingHorizontal: 0 },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
});
