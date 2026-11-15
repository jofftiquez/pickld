import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DISABLED_OPACITY, PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space, type Slot } from '@/theme/tokens';

export type SlotPickerProps = {
  visible: boolean;
  /** The slot the camera is on: marked selected. */
  current: Slot;
  /** Slots the target day's jar already holds (server moments and queued photos): shown done, not choosable. */
  taken: ReadonlySet<Slot>;
  /** Fill this jar: the past day (already formatted). Today's jar otherwise. */
  date?: string;
  /** A free slot was picked (never the current one). */
  onPick: (slot: Slot) => void;
  onClose: () => void;
};

/**
 * Change the moment from the camera (D-151): the target day's 8 slots in jar order. Done slots are
 * dimmed and can't be picked; the current one carries a check. Picking a free slot switches the camera to
 * it; the day stays the same.
 */
export function SlotPicker({ visible, current, taken, date, onPick, onClose }: SlotPickerProps) {
  const { t } = useTranslation();
  const othersDone = slots.every((slot) => slot === current || taken.has(slot));
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('camera.slotPicker.title')}
      testID="camera-slot-picker"
    >
      <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.title]}>
        {t('camera.slotPicker.title')}
      </Text>
      <Text style={[textStyle('label', '500'), styles.muted, styles.subtitle]}>
        {othersDone
          ? t('camera.slotPicker.allDone')
          : date
            ? t('myDays.camera.when', { date })
            : t('camera.slotPicker.today')}
      </Text>
      {slots.map((slot, i) => (
        <SlotPickerRow
          key={slot}
          slot={slot}
          selected={slot === current}
          done={taken.has(slot)}
          divider={i < slots.length - 1}
          onPress={() => (slot === current ? onClose() : onPick(slot))}
        />
      ))}
    </BottomSheet>
  );
}

type SlotPickerRowProps = {
  slot: Slot;
  selected: boolean;
  done: boolean;
  divider: boolean;
  onPress: () => void;
};

/** One slot: icon well, hashtag, then a check (the current slot) or "Done" (already in the jar). */
function SlotPickerRow({ slot, selected, done, divider, onPress }: SlotPickerRowProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const label = t(`slots.${slot}`);
  // The current slot stays pressable (it just closes the picker), even when the camera opened on a filled
  // slot to replace it.
  const disabled = done && !selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? t('camera.slotPicker.doneLabel', { slot: label }) : label}
      accessibilityHint={selected || disabled ? undefined : t('camera.slotPicker.hint', { slot: label })}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={`camera-slot-picker-${slot}`}
      style={[
        styles.row,
        divider ? styles.divider : null,
        disabled ? { opacity: DISABLED_OPACITY } : pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <View style={styles.well}>
        <Icon name={slot} color="ink" size={20} />
      </View>
      <Text style={[textStyle('body', '600'), styles.label]}>{label}</Text>
      {done && !selected ? (
        <Text style={[textStyle('label', '600'), styles.muted]}>{t('camera.slotPicker.done')}</Text>
      ) : null}
      {selected ? (
        <View style={styles.check} testID={`camera-slot-picker-${slot}-check`}>
          <Icon name="check" color="surface" size={16} strokeWidth={2.6} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink },
  subtitle: { marginTop: 2, marginBottom: space.xs },
  muted: { color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    paddingVertical: space.sm,
    minHeight: sizes.minTap,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  well: {
    width: sizes.optionIcon,
    height: sizes.optionIcon,
    borderRadius: radius.optionIcon,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.ink },
  check: {
    width: sizes.slotPickerCheck,
    height: sizes.slotPickerCheck,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
