import { Pressable, StyleSheet, Text } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type ChipProps = {
  /** Already translated. */
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  testID?: string;
};

/** Multi-select chip from QuizPeople: ink with white text when selected, white with a border when not. */
export function Chip({ label, selected, onPress, accessibilityHint, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={hitSlopFor(undefined, sizes.chip)}
      testID={testID}
      style={[styles.base, selected ? styles.selected : styles.unselected]}
    >
      <Text style={[textStyle('bodyMedium', '700'), { color: selected ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.chip,
    minWidth: sizes.minTap,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
});
