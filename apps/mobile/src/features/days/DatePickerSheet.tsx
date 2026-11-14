import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DISABLED_OPACITY } from '@/components/BaseButton';
import { BottomSheet } from '@/components/BottomSheet';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { MonthChip } from './MonthChip';
import { buildMonthGrid } from './monthGrid';
import { YearMonthGrid, formatMonth } from './YearMonthGrid';

export type DatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The months that can be picked ("YYYY-MM"), oldest first: the same range the month picker offers. */
  months: readonly string[];
  /** The month the sheet opens on (the one My days shows). */
  initialMonth: string;
  /** Today in the phone zone, "YYYY-MM-DD": later days can't be chosen. */
  today: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekStart: number;
  onSelect: (date: string) => void;
  locale: string;
};

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * Goes straight to any day (FR-DAY-02, D-141): a year strip, that year's months, then the month's days. A day
 * opens its day page, where it can be filled; days after today are shown but can't be chosen.
 */
export function DatePickerSheet({
  visible,
  onClose,
  months,
  initialMonth,
  today,
  weekStart,
  onSelect,
  locale,
}: DatePickerSheetProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(initialMonth);
  // Each opening starts again on the month My days shows (state adjusted while rendering, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setMonth(initialMonth);
  }

  const year = month.slice(0, 4);
  const onYear = (next: string) => {
    // Keep the month of the year when it is in range, else the nearest month that is.
    const same = `${next}-${month.slice(5)}`;
    const inYear = months.filter((m) => m.startsWith(`${next}-`));
    const first = inYear[0];
    const last = inYear[inYear.length - 1];
    if (months.includes(same) || !first || !last) setMonth(same);
    else setMonth(same < first ? first : last);
  };
  const grid = buildMonthGrid({ month, today, weekStart });
  const weekdayLetter = (weekday: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 10, 1 + weekday)),
    );
  const dayName = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(utc(date));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('myDays.datePicker.title')}
      testID="date-picker"
      scrollable
    >
      <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.title]}>
        {t('myDays.datePicker.title')}
      </Text>
      <YearMonthGrid
        months={months}
        year={year}
        onYear={onYear}
        selectedMonth={month}
        onMonth={setMonth}
        locale={locale}
        testID="date-picker"
      />
      <View style={styles.days} accessibilityLabel={formatMonth(month, locale, { month: 'long', year: 'numeric' })}>
        {/* The day labels already say the date, so the weekday letters are hidden from screen readers. */}
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {grid.weekdays.map((weekday) => (
            <Text key={weekday} style={[styles.weekday, textStyle('caption', '700'), { color: colors.muted }]}>
              {weekdayLetter(weekday)}
            </Text>
          ))}
        </View>
        {grid.weeks.map((week) => (
          <View key={week.map((c) => (c.kind === 'day' ? c.date : c.key)).join()} style={styles.row}>
            {week.map((cell) =>
              cell.kind === 'blank' ? (
                <View key={cell.key} style={styles.cell} />
              ) : (
                <View key={cell.date} style={styles.cell}>
                  {cell.isFuture ? (
                    // Days after today stay refused, as on the server (0003, 0008).
                    <View
                      accessible
                      accessibilityLabel={t('myDays.dayFuture', { date: dayName(cell.date) })}
                      accessibilityState={{ disabled: true }}
                      style={styles.future}
                      testID={`date-picker-day-${cell.date}`}
                    >
                      <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{cell.day}</Text>
                    </View>
                  ) : (
                    <MonthChip
                      label={String(cell.day)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        cell.isToday ? t('myDays.datePicker.today', { date: dayName(cell.date) }) : dayName(cell.date)
                      }
                      accessibilityHint={cell.isToday ? undefined : t('myDays.datePicker.dayHint')}
                      selected={false}
                      compact
                      onPress={() => onSelect(cell.date)}
                      testID={`date-picker-day-${cell.date}`}
                    />
                  )}
                </View>
              ),
            )}
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, marginBottom: space.md },
  days: { gap: sizes.dayGap, marginTop: space.lg },
  row: { flexDirection: 'row', gap: sizes.dayGap },
  weekday: { flex: 1, textAlign: 'center' },
  cell: { flex: 1 },
  future: { minHeight: sizes.chip, alignItems: 'center', justifyContent: 'center', opacity: DISABLED_OPACITY },
});
