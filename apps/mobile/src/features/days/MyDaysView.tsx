import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { deviceLocale } from '@/lib/format';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { CalendarDay } from './CalendarDay';
import { MonthPickerSheet } from './MonthPickerSheet';
import { MOMENTS_PER_JAR, type DayCell, type MonthGrid, type MonthNav } from './monthGrid';

export type MyDaysViewProps = {
  grid: MonthGrid;
  /** Moments across the shown month's jars. */
  momentCount: number;
  nav: MonthNav;
  selectedDate: string | null;
  /** Safe-area insets. */
  insets: { top: number; bottom: number };
  /** Back to where My days was opened from (Today's calendar button). */
  onBack?: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
  /** The selected-day card, under the calendar. */
  selectedDay?: ReactNode;
  /** Opens Memories (FR-DAY-03). */
  onMemories?: () => void;
  /** The months the month picker offers, oldest first: the range Previous and Next reach (`monthsBetween`). */
  pickableMonths?: readonly string[];
  /** Jumps to a month chosen in the month picker. Without it the month line is plain text. */
  onPickMonth?: (month: string) => void;
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

/** My days (design: Calendar). Presentational; app/my-days.tsx loads the data. */
export function MyDaysView({
  grid,
  momentCount,
  nav,
  selectedDate,
  insets,
  onBack,
  onPrevious,
  onNext,
  onSelectDay,
  selectedDay,
  onMemories,
  pickableMonths = [],
  onPickMonth,
  locale = deviceLocale(),
}: MyDaysViewProps) {
  const { t } = useTranslation();
  const month = monthLabel(grid.month, locale);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthPressed, setMonthPressed] = useState(false);
  const subtitle = (
    <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]} testID="my-days-subtitle">
      {t('myDays.subtitle', { month, count: momentCount })}
    </Text>
  );
  // A stack screen since D-52: no floating tab bar to clear at the bottom.
  const bottomPadding = Math.max(insets.bottom, space.lg) + space.lg;

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
      {onBack ? (
        <View style={styles.topBar}>
          <RoundIconButton icon="back" accessibilityLabel={t('myDays.back')} onPress={onBack} testID="my-days-back" />
        </View>
      ) : null}
      <View style={styles.header}>
        <View style={styles.titles}>
          {onPickMonth ? (
            // The month line opens the month picker, to jump far back without pressing Previous over and over.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('myDays.monthPicker.open', { month, count: momentCount })}
              accessibilityHint={t('myDays.monthPicker.openHint')}
              onPress={() => setPickerOpen(true)}
              onPressIn={() => setMonthPressed(true)}
              onPressOut={() => setMonthPressed(false)}
              hitSlop={hitSlopFor(undefined, sizes.monthButton)}
              testID="my-days-month"
              style={[styles.monthButton, monthPressed ? { opacity: PRESSED_OPACITY } : null]}
            >
              {subtitle}
              <Icon name="chevronDown" size={sizes.monthButtonIcon} strokeWidth={2.4} color="muted" />
            </Pressable>
          ) : (
            subtitle
          )}
          <Text
            maxFontSizeMultiplier={maxTextScale.title}
            testID="screen-title"
            accessibilityRole="header"
            style={[textStyle('screenTitle'), { color: colors.ink }]}
          >
            {t('myDays.title')}
          </Text>
        </View>
        <View style={styles.actions}>
          {onMemories ? (
            <RoundIconButton
              icon="sparkle"
              accessibilityLabel={t('myDays.memories')}
              onPress={onMemories}
              testID="my-days-memories"
            />
          ) : null}
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
      {onPickMonth ? (
        <MonthPickerSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          months={pickableMonths}
          selected={grid.month}
          onSelect={(picked) => {
            setPickerOpen(false);
            onPickMonth(picked);
          }}
          locale={locale}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', paddingHorizontal: space.xl, paddingBottom: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  titles: { flexShrink: 1, gap: space.xs / 2 },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    minHeight: sizes.monthButton,
  },
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
