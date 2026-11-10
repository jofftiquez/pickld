import { Pressable, StyleSheet, View } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { colors, radius, sizes } from '@/theme/tokens';

import { DISABLED_OPACITY } from './BaseButton';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required: what the switch controls (e.g. "Morning reminder"). Already translated. */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

const THUMB_INSET = (sizes.toggleHeight - sizes.toggleThumb) / 2;

/** 48 × 28 switch from Settings. Brand track when on, toggleOff when off. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false, testID }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={hitSlopFor(sizes.toggleWidth, sizes.toggleHeight)}
      testID={testID}
      style={[
        styles.track,
        { backgroundColor: value ? colors.brand : colors.toggleOff },
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      <View
        testID={testID ? `${testID}-thumb` : 'toggle-thumb'}
        style={[styles.thumb, value ? { right: THUMB_INSET } : { left: THUMB_INSET }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: sizes.toggleWidth,
    height: sizes.toggleHeight,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  thumb: {
    position: 'absolute',
    top: THUMB_INSET,
    width: sizes.toggleThumb,
    height: sizes.toggleThumb,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
