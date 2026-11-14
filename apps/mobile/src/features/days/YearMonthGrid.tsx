import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { space } from '@/theme/tokens';

import { MonthChip } from './MonthChip';

export type YearMonthGridProps = {
  /** The months that can be picked ("YYYY-MM"), oldest first. */
  months: readonly string[];
  /** The year whose months are shown ("YYYY"). */
  year: string;
  onYear: (year: string) => void;
  /** The month marked as chosen, or null. */
  selectedMonth: string | null;
  onMonth: (month: string) => void;
  locale: string;
  /** Prefix for the chips' test IDs: `<testID>-year-2025` and `<testID>-2025-03`. */
  testID: string;
};

const COLUMNS = 3;

export const formatMonth = (month: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

/** The years (newest first) in the pickable range. */
export const yearsOf = (months: readonly string[]) => [...new Set(months.map((m) => m.slice(0, 4)))].sort().reverse();

/**
 * A year strip (newest first, scrolled to the chosen year) over that year's months in three columns, for the
 * month and date pickers (FR-DAY-01, FR-DAY-02). Months outside the range are left out (a blank keeps the
 * grid in calendar order), so they can't be chosen.
 */
export function YearMonthGrid({ months, year, onYear, selectedMonth, onMonth, locale, testID }: YearMonthGridProps) {
  const { t } = useTranslation();
  const pickable = new Set(months);
  const strip = useRef<ScrollViewInstance>(null);
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const rows: string[][] = [];
  for (let i = 0; i < yearMonths.length; i += COLUMNS) rows.push(yearMonths.slice(i, i + COLUMNS));

  return (
    <View style={styles.container}>
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('myDays.picker.years')}
        contentContainerStyle={styles.years}
        style={styles.strip}
        testID={`${testID}-years`}
      >
        {yearsOf(months).map((y) => (
          <View
            key={y}
            // Brings the chosen year into view when the sheet opens (no animation, so Reduce Motion holds).
            onLayout={
              y === year
                ? (e) => strip.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - space.xl), animated: false })
                : undefined
            }
          >
            <MonthChip
              label={formatMonth(`${y}-01`, locale, { year: 'numeric' })}
              accessibilityLabel={formatMonth(`${y}-01`, locale, { year: 'numeric' })}
              selected={y === year}
              onPress={() => onYear(y)}
              testID={`${testID}-year-${y}`}
            />
          </View>
        ))}
      </ScrollView>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('myDays.picker.months')} style={styles.rows}>
        {rows
          .filter((row) => row.some((m) => pickable.has(m)))
          .map((row) => (
            <View key={row[0]} style={styles.row}>
              {/* Equal columns; a month out of range leaves its column empty. */}
              {row.map((month) => (
                <View key={month} style={styles.cell}>
                  {pickable.has(month) ? (
                    <MonthChip
                      label={formatMonth(month, locale, { month: 'short' })}
                      accessibilityLabel={formatMonth(month, locale, { month: 'long', year: 'numeric' })}
                      selected={month === selectedMonth}
                      onPress={() => onMonth(month)}
                      testID={`${testID}-${month}`}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  // Bleeds to the sheet's edges so the strip scrolls under them.
  strip: { marginHorizontal: -space.xl, flexGrow: 0 },
  years: { gap: space.sm, paddingHorizontal: space.xl },
  rows: { gap: space.sm },
  // Fixed thirds, so a row with an empty column keeps the same column widths as a full one.
  row: { flexDirection: 'row', marginHorizontal: -space.sm / 2 },
  cell: { width: `${100 / COLUMNS}%`, paddingHorizontal: space.sm / 2 },
});
