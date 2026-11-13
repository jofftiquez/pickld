import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type OptionRowProps = {
  icon: IconName;
  /** Already translated. */
  label: string;
  /** What a screen reader says instead of `label`, e.g. with the current value. Already translated. */
  accessibilityLabel?: string;
  onPress: () => void;
  /** Red label and icon well, for Delete moment. */
  tone?: 'default' | 'danger';
  /** What sits at the end: a switch drawing, a chevron (Move) or a value and chevron (Visibility). Hidden from screen readers. */
  trailing?: ReactNode;
  /** `switch` for an on/off row: the whole row is the switch, read with its state. */
  accessibilityRole?: 'button' | 'switch';
  checked?: boolean;
  accessibilityHint?: string;
  disabled?: boolean;
  /** Draws the divider under the row; off on the last row. */
  divider?: boolean;
  testID?: string;
};

/** A Moment options row (design: MomentOptions): 38 px icon well, 15/600 label, optional trailing control. */
export function OptionRow({
  icon,
  label,
  accessibilityLabel,
  onPress,
  tone = 'default',
  trailing,
  accessibilityRole = 'button',
  checked,
  accessibilityHint,
  disabled = false,
  divider = true,
  testID,
}: OptionRowProps) {
  const danger = tone === 'danger';
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(accessibilityRole === 'switch' ? { checked: checked ?? false } : null) }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[
        styles.row,
        divider ? styles.divider : null,
        disabled ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <View style={[styles.well, { backgroundColor: danger ? colors.dangerTint : colors.tileIconWell }]}>
        <Icon name={icon} color={danger ? 'danger' : 'ink'} size={20} />
      </View>
      <Text style={[textStyle('body', '600'), styles.label, { color: danger ? colors.danger : colors.ink }]}>
        {label}
      </Text>
      {trailing ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
          {trailing}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    paddingVertical: space.md,
    minHeight: sizes.minTap,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  well: {
    width: sizes.optionIcon,
    height: sizes.optionIcon,
    borderRadius: radius.optionIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
