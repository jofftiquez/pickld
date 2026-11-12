import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { hitSlopFor } from '@/lib/hitSlop';
import { useLargeText } from '@/lib/useLargeText';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { RadioRow } from './RadioRow';

export type SelectOption<T extends string | number> = { value: T; label: string };

export type SelectFieldProps<T extends string | number> = {
  /** Visible label above the field; also the sheet's title and the spoken name. Already translated. */
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Shown while nothing is picked. Already translated. */
  placeholder: string;
  /** `chip`: a compact pill showing only the value, the label stays spoken (Settings reminder times). */
  /** Large text: take the whole row, for long values such as times (D-37). */
  fullWidthWhenLarge?: boolean;
  variant?: 'field' | 'chip';
  testID?: string;
};

/** A field that opens a sheet of choices, such as the birthday's Month, Day and Year (About). */
export function SelectField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder,
  variant = 'field',
  fullWidthWhenLarge = false,
  testID,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const chip = variant === 'chip';
  const large = useLargeText();
  return (
    <View
      style={
        chip
          ? undefined
          : [styles.container, large && (fullWidthWhenLarge ? styles.containerFull : styles.containerLarge)]
      }
    >
      {chip ? null : (
        <Text style={[textStyle('label'), styles.label]} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        hitSlop={chip ? hitSlopFor(undefined, sizes.timeChip) : undefined}
        style={chip ? styles.chip : styles.field}
        testID={testID}
      >
        <Text
          style={[
            textStyle(chip ? 'bodySmall' : 'body', chip ? '700' : undefined),
            { color: selected ? colors.ink : colors.muted },
          ]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        {chip ? null : <Icon name="chevronDown" size={18} strokeWidth={2} />}
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} accessibilityLabel={label} scrollable>
        <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.title]}>
          {label}
        </Text>
        <View accessibilityRole="radiogroup">
          {options.map((o, i) => (
            <RadioRow
              key={o.value}
              label={o.label}
              selected={o.value === value}
              divider={i < options.length - 1}
              onSelect={() => {
                onChange(o.value);
                setOpen(false);
              }}
              testID={testID ? `${testID}-${o.value}` : undefined}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 6 },
  // Large text: wide enough for a year, so fields in a row (Birthday) wrap instead of truncating (D-37).
  containerLarge: { minWidth: sizes.selectFieldLarge },
  containerFull: { minWidth: '100%' },
  label: { color: colors.muted },
  field: {
    minHeight: sizes.textField,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  chip: {
    // minHeight: grows with large text instead of clipping the time.
    minHeight: sizes.timeChip,
    paddingHorizontal: 10,
    borderRadius: radius.timeChip,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.ink, marginBottom: space.xs },
});
