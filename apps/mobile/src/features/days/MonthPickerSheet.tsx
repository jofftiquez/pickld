import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { YearMonthGrid } from './YearMonthGrid';

export type MonthPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The months that can be picked ("YYYY-MM"), oldest first: the same range Previous and Next reach. */
  months: readonly string[];
  /** The month My days shows now. */
  selected: string;
  onSelect: (month: string) => void;
  locale: string;
};

/**
 * Jumps My days to a month (FR-DAY-01): a year strip over that year's months. It opens on the shown month's
 * year; months outside the range are left out, so they can't be chosen.
 */
export function MonthPickerSheet({ visible, onClose, months, selected, onSelect, locale }: MonthPickerSheetProps) {
  const { t } = useTranslation();
  const [year, setYear] = useState(selected.slice(0, 4));
  // Each opening starts again on the month My days shows (state adjusted while rendering, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setYear(selected.slice(0, 4));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('myDays.monthPicker.title')}
      testID="month-picker"
      scrollable
    >
      <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.title]}>
        {t('myDays.monthPicker.title')}
      </Text>
      <YearMonthGrid
        months={months}
        year={year}
        onYear={setYear}
        selectedMonth={selected}
        onMonth={onSelect}
        locale={locale}
        testID="month-picker"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, marginBottom: space.md },
});
