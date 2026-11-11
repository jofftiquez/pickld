import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type Segment<K extends string> = { key: K; label: string };

export type SegmentedControlProps<K extends string> = {
  /** Labels are already translated. */
  segments: readonly Segment<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** Spoken name for the group (e.g. "Profile sections"). */
  accessibilityLabel: string;
  /** `light`: white selected pill on the app background. `dark`: ink selected pill on a white sheet (editor tools). */
  variant?: 'light' | 'dark';
  testID?: string;
};

/** White pill tabs on a track (Profile Jars/Moments, Readers). Each segment is a tab with a selected state. */
export function SegmentedControl<K extends string>({
  segments,
  selected,
  onSelect,
  accessibilityLabel,
  variant = 'light',
  testID,
}: SegmentedControlProps<K>) {
  const dark = variant === 'dark';
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.track, dark ? styles.trackDark : null]}
    >
      {segments.map((segment) => {
        const isSelected = segment.key === selected;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(segment.key)}
            // 36 px tab + 4 px track padding on each side reaches the 44 px minimum.
            hitSlop={{ top: space.xs, bottom: space.xs }}
            style={[styles.tab, isSelected ? (dark ? styles.selectedDark : styles.selected) : null]}
          >
            <Text
              style={[
                textStyle('bodySmall', isSelected ? '700' : '600'),
                { color: isSelected ? (dark ? colors.surface : colors.ink) : colors.muted },
                styles.label,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.segmentTrack,
    borderRadius: radius.pill,
    padding: space.xs,
    alignSelf: 'stretch',
  },
  tab: {
    flex: 1,
    minHeight: sizes.segment,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  trackDark: { backgroundColor: colors.subtle },
  selected: { backgroundColor: colors.surface },
  selectedDark: { backgroundColor: colors.ink },
  label: { textAlign: 'center' },
});
