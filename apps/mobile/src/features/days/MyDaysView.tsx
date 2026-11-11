import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundIconButton } from '@/components/RoundIconButton';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { CalendarDay } from './CalendarDay';
import { MOMENTS_PER_JAR, type DayCell, type MonthGrid, type MonthNav } from './monthGrid';

export type MyDaysViewProps = {
  grid: MonthGrid;
  /** Moments across the shown month's jars. */
  momentCount: number;
  nav: MonthNav;
  selectedDate: string | null;
  /** Safe-area insets; the bottom one is where the floating tab bar sits. */
  insets: { top: number; bottom: number };
  onPrevious: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
  /** The selected-day card, under the calendar. */
  selectedDay?: ReactNode;
  locale?: string;
};

// Calendar dates carry no zone; formatting them at UTC midnight keeps the day from shifting.
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    utc(`${month}-01`),
  );
}

function dayLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(utc(date));
}

// 2026-11-01 is a Sunday, so weekday n is that date plus n days.
function weekdayLetter(weekday: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 10, 1 + weekday)),
  );
}

/** My days (design: Calendar). Presentational; app/(tabs)/my-days.tsx loads the data. */
export function MyDaysView({
  grid,
  momentCount,
  nav,
  selectedDate,
  insets,
  onPrevious,
  onNext,
  onSelectDay,
  selectedDay,
  locale = deviceLocale(),
}: MyDaysViewProps) {
  const { t } = useTranslation();
  const month = monthLabel(grid.month, locale);
  const bottomPadding = Math.max(insets.bottom, space.lg) + sizes.tabBar + space.lg;

  const labelFor = (cell: DayCell) => {
    const date = dayLabel(cell.date, locale);
    if (cell.isFuture) return t('myDays.dayFuture', { date });
    const values = { date, count: cell.jar?.moment_count ?? 0, total: MOMENTS_PER_JAR };
    return cell.isToday ? t('myDays.dayToday', values) : t('myDays.day', values);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + sizes.headerTop, paddingBottom: bottomPadding }}
      testID="my-days-scroll"
    >
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]} testID="my-days-subtitle">
            {t('myDays.subtitle', { month, count: momentCount })}
          </Text>
          <Text
            testID="screen-title"
            accessibilityRole="header"
            style={[textStyle('screenTitle'), { color: colors.ink }]}
          >
            {t('myDays.title')}
          </Text>
        </View>
        <View style={styles.actions}>
          <RoundIconButton
            icon="back"
            accessibilityLabel={t('myDays.previousMonth')}
            onPress={onPrevious}
            disabled={!nav.canGoPrevious}
            testID="my-days-previous"
          />
          <RoundIconButton
            icon="chevronRight"
            accessibilityLabel={t('myDays.nextMonth')}
            onPress={onNext}
            disabled={!nav.canGoNext}
            testID="my-days-next"
          />
        </View>
      </View>

      <View style={styles.card} accessibilityLabel={t('myDays.calendar', { month })} testID="my-days-calendar">
        {/* The day labels already say the date, so the weekday letters are hidden from screen readers. */}
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {grid.weekdays.map((weekday) => (
            <Text key={weekday} style={[styles.weekday, textStyle('caption', '700'), { color: colors.muted }]}>
              {weekdayLetter(weekday, locale)}
            </Text>
          ))}
        </View>
        <View style={styles.weeks}>
          {grid.weeks.map((week) => (
            <View key={week.map((c) => (c.kind === 'day' ? c.date : c.key)).join()} style={styles.row}>
              {week.map((cell) =>
                cell.kind === 'blank' ? (
                  <View key={cell.key} style={styles.blank} />
                ) : (
                  <CalendarDay
                    key={cell.date}
                    cell={cell}
                    accessibilityLabel={labelFor(cell)}
                    selected={cell.date === selectedDate}
                    onPress={() => onSelectDay(cell.date)}
                  />
                ),
              )}
            </View>
          ))}
        </View>
      </View>
      {selectedDay}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  titles: { flexShrink: 1, gap: space.xs / 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: {
    marginHorizontal: space.lg,
    padding: sizes.cardPadding,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    gap: space.sm,
    ...shadow.card,
  },
  weeks: { gap: sizes.dayGap },
  row: { flexDirection: 'row', gap: sizes.dayGap },
  weekday: { flex: 1, textAlign: 'center' },
  blank: { flex: 1 },
});
