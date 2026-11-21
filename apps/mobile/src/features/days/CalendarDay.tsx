import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { JarGraphic, VIEW_H, VIEW_W } from '@/components/JarGraphic';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import type { DayCell } from './monthGrid';

export type CalendarDayProps = {
  cell: DayCell;
  /** Spoken name, already translated (e.g. "November 7, 3 of 8 moments"). */
  accessibilityLabel: string;
  /** What a tap does, already translated; left out for future days, which can't be tapped. */
  accessibilityHint?: string;
  selected: boolean;
  /** The owner's lid color, on the jars of published days. */
  lidColor?: string;
  onPress: () => void;
};

// Cells sit 5 pt apart, so each one reaches into half the gap instead of overlapping its neighbors.
const slop = Math.floor(sizes.dayGap / 2);
const HIT_SLOP = { top: slop, bottom: slop, left: slop, right: slop };

/**
 * One day of the My jars month (Calendar): the day number over a jar that fills one layer per moment, with
 * the lid on once the day is published; future days disabled.
 */
export function CalendarDay({
  cell,
  accessibilityLabel,
  accessibilityHint,
  selected,
  lidColor,
  onPress,
}: CalendarDayProps) {
  const [pressed, setPressed] = useState(false);
  // The jar grows with the day number at large text sizes, up to the same cap.
  const { fontScale } = useWindowDimensions();
  const jarSize = Math.round(sizes.calendarJar * Math.min(Math.max(fontScale, 1), maxTextScale.tile));
  const { jar, isFuture, isToday } = cell;
  const count = isFuture ? 0 : (jar?.moment_count ?? 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isFuture, selected }}
      disabled={isFuture}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={HIT_SLOP}
      testID={`day-${cell.date}`}
      style={[
        styles.cell,
        isFuture ? null : styles.past,
        isToday ? styles.today : selected ? styles.selected : null,
        pressed && !isFuture ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      <Text
        maxFontSizeMultiplier={maxTextScale.tile}
        style={[textStyle('bodySmall', '700'), { color: isFuture ? colors.dayFuture : colors.ink }]}
      >
        {cell.day}
      </Text>
      {/* The same space with or without a jar, so day numbers line up across a week. */}
      <View style={{ height: (jarSize * VIEW_H) / VIEW_W }}>
        {count > 0 ? (
          <JarGraphic
            count={count}
            size={jarSize}
            lidColor={lidColor}
            open={!jar?.published_at}
            decorative
            testID="day-jar"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: sizes.dayCell,
    borderRadius: radius.dayCell,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs / 2,
    paddingVertical: space.xs,
  },
  past: { backgroundColor: colors.dayCellEmpty },
  today: { borderWidth: sizes.todayRing, borderColor: colors.brand },
  selected: { borderWidth: sizes.todayRing, borderColor: colors.ink },
});
