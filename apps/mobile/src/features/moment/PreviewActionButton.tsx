import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type PreviewActionButtonProps = {
  icon: IconName;
  /** Already translated; also the spoken name. */
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** Red icon well and label, for Delete. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** From 200% text (D-37) the bar puts two actions per row with the label beside the icon. */
  wide?: boolean;
  testID?: string;
};

/** One action in the moment preview's bar (design: MomentPreview): an icon well with its label under it. */
export function PreviewActionButton({
  icon,
  label,
  onPress,
  accessibilityHint,
  tone = 'default',
  disabled = false,
  wide = false,
  testID,
}: PreviewActionButtonProps) {
  const danger = tone === 'danger';
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={testID}
      style={[
        styles.base,
        wide ? styles.wide : styles.narrow,
        disabled ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <View style={[styles.well, { backgroundColor: danger ? colors.dangerTint : colors.tileIconWell }]}>
        <Icon name={icon} color={danger ? 'danger' : 'ink'} size={20} strokeWidth={2} />
      </View>
      <Text
        style={[
          textStyle('label', '600'),
          wide ? styles.labelWide : styles.labelNarrow,
          { color: danger ? colors.danger : colors.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: sizes.minTap, alignItems: 'center', gap: space.xs },
  narrow: { flex: 1, paddingVertical: space.xs },
  // Two per row at large text: icon and label side by side, the label wrapping as it needs.
  wide: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', gap: space.sm, paddingVertical: space.xs },
  well: {
    width: sizes.optionIcon,
    height: sizes.optionIcon,
    borderRadius: radius.optionIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelNarrow: { textAlign: 'center' },
  labelWide: { flex: 1 },
});
