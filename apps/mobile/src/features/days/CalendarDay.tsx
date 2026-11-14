import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

import { fillFraction, type DayCell } from './monthGrid';
import { photoSource } from '@/lib/image/photoCache';

export type CalendarDayProps = {
  cell: DayCell;
  /** Spoken name, already translated (e.g. "November 7, 3 of 8 moments"). */
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
};

// Cells sit 5 pt apart, so each one reaches into half the gap instead of overlapping its neighbors.
const slop = Math.floor(sizes.dayGap / 2);
const HIT_SLOP = { top: slop, bottom: slop, left: slop, right: slop };

/** One day of the My days month (Calendar): cover photo, day number and fill bar; future days disabled. */
export function CalendarDay({ cell, accessibilityLabel, selected, onPress }: CalendarDayProps) {
  const [pressed, setPressed] = useState(false);
  const { jar, isFuture, isToday } = cell;
  const cover = isFuture ? null : (jar?.coverUrl ?? null);
  const count = isFuture ? 0 : (jar?.moment_count ?? 0);
  const numberColor = cover ? colors.surface : isFuture ? colors.dayFuture : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
      {cover ? (
        <>
          <Image
            testID="day-cover"
            source={photoSource(cover)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
          />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </>
      ) : null}
      <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('bodySmall', '700'), { color: numberColor }]}>
        {cell.day}
      </Text>
      {count > 0 ? (
        <View testID="day-fill" style={[styles.track, { backgroundColor: cover ? colors.fillTrack : colors.border }]}>
          <View style={[styles.fill, { width: `${fillFraction(count) * 100}%` }]} />
        </View>
      ) : null}
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
    paddingBottom: sizes.fillBar,
  },
  past: { backgroundColor: colors.dayCellEmpty },
  today: { borderWidth: sizes.todayRing, borderColor: colors.brand },
  selected: { borderWidth: sizes.todayRing, borderColor: colors.ink },
  scrim: { backgroundColor: colors.dayCellScrim },
  track: {
    position: 'absolute',
    left: sizes.fillBarInset,
    right: sizes.fillBarInset,
    bottom: sizes.fillBarInset,
    height: sizes.fillBar,
    borderRadius: radius.fillBar,
    overflow: 'hidden',
  },
  fill: { height: sizes.fillBar, borderRadius: radius.fillBar, backgroundColor: colors.brand },
});
