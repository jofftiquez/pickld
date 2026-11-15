import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space, type Slot } from '@/theme/tokens';

export type SlotChoiceProps = {
  slot: Slot;
  /** The slot already holds a moment that day: shown, not choosable. */
  taken: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** One slot on the Add to Pickld screen: a white pill on the dark screen, dimmed when that slot is filled. */
export function SlotChoice({ slot, taken, disabled, onPress }: SlotChoiceProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const label = t(`slots.${slot}`);
  const off = taken || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={taken ? t('sharedPhoto.slotTaken', { slot: label }) : label}
      accessibilityHint={taken ? undefined : t('sharedPhoto.slotHint', { slot: label })}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={`shared-photo-slot-${slot}`}
      style={[
        styles.pill,
        taken ? styles.taken : styles.free,
        off ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[textStyle('body', '700'), { color: taken ? colors.surface : colors.ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: sizes.minTap + space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  free: { backgroundColor: colors.surface },
  taken: { backgroundColor: colors.onDarkButton },
});
