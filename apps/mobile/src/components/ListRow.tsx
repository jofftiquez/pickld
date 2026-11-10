import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';
import { Icon } from './Icon';

export type ListRowProps = {
  /** Already translated. */
  label: string;
  onPress: () => void;
  /** Current value shown before the chevron (e.g. "Readers", "2"). */
  value?: string;
  /** Red text and no chevron, for Sign out and Delete account. */
  tone?: 'default' | 'danger';
  /** Draws the divider under the row; turn off on the last row of a card. */
  divider?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** Settings row: 15/600 label, optional value, chevron. */
export function ListRow({
  label,
  onPress,
  value,
  tone = 'default',
  divider = true,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const danger = tone === 'danger';
  // Plain style array, not a style function: NativeWind's Pressable wrapper drops function styles on device.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[styles.row, divider ? styles.divider : null, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      <Text style={[textStyle('body', '600'), styles.label, { color: danger ? colors.danger : colors.ink }]}>
        {label}
      </Text>
      {value || !danger ? (
        <View style={styles.trailing}>
          {value ? <Text style={[textStyle('bodyMedium'), styles.value]}>{value}</Text> : null}
          {danger ? null : <Icon name="chevronRight" color="chevron" size={18} strokeWidth={2} />}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: sizes.minTap,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { flex: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  value: { color: colors.muted, flexShrink: 1 },
});
