import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { MonthChip } from './MonthChip';

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

const COLUMNS = 3;

const format = (month: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

/**
 * Jumps My days to a month (FR-DAY-01): the years newest first, each a grid of its months. Months outside
 * the range are left out (a blank keeps the grid in calendar order), so they can't be chosen.
 */
export function MonthPickerSheet({ visible, onClose, months, selected, onSelect, locale }: MonthPickerSheetProps) {
  const { t } = useTranslation();
  const pickable = new Set(months);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort().reverse();

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
      {years.map((year) => {
        const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
        const rows: string[][] = [];
        for (let i = 0; i < yearMonths.length; i += COLUMNS) rows.push(yearMonths.slice(i, i + COLUMNS));
        return (
          <View key={year} style={styles.year}>
            <Text accessibilityRole="header" style={[textStyle('label', '700'), { color: colors.muted }]}>
              {format(`${year}-01`, locale, { year: 'numeric' })}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.rows}>
              {rows
                .filter((row) => row.some((m) => pickable.has(m)))
                .map((row) => (
                  <View key={row[0]} style={styles.row}>
                    {row.map((month) =>
                      pickable.has(month) ? (
                        <MonthChip
                          key={month}
                          label={format(month, locale, { month: 'short' })}
                          accessibilityLabel={format(month, locale, { month: 'long', year: 'numeric' })}
                          selected={month === selected}
                          onPress={() => onSelect(month)}
                          testID={`month-picker-${month}`}
                        />
                      ) : (
                        <View key={month} style={styles.blank} />
                      ),
                    )}
                  </View>
                ))}
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, marginBottom: space.sm },
  year: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.md },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  blank: { flex: 1 },
});
