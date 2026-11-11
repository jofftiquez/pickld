import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';

export type RadioRowProps = {
  /** Already translated. */
  label: string;
  /** Second line under the label (e.g. "Anyone on Pickld"). Already translated. */
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** Draws the divider under the row; turn off on the last row of a card. */
  divider?: boolean;
  testID?: string;
};

/** One choice in a single-choice list (Publish "Who can see this jar"): label, description, radio. */
export function RadioRow({ label, description, selected, onSelect, divider = true, testID }: RadioRowProps) {
  // Plain style array, not a style function: NativeWind's Pressable wrapper drops function styles on device.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[styles.row, divider ? styles.divider : null, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      <View style={styles.text}>
        <Text style={[textStyle('body', '600'), { color: colors.ink }]}>{label}</Text>
        {description ? <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{description}</Text> : null}
      </View>
      <View
        testID={testID ? `${testID}-radio` : undefined}
        style={[styles.radio, { borderColor: selected ? colors.brand : colors.chevron }]}
      >
        {selected ? <View testID={testID ? `${testID}-dot` : undefined} style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md - 1,
    minHeight: sizes.minTap,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  text: { flex: 1, gap: 1 },
  radio: {
    width: sizes.radio,
    height: sizes.radio,
    borderRadius: radius.pill,
    borderWidth: sizes.radioRing,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: { width: sizes.radioDot, height: sizes.radioDot, borderRadius: radius.pill, backgroundColor: colors.brand },
});
