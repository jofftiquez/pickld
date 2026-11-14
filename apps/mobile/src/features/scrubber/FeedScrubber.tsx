import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { deviceLocale } from '@/lib/format';
import { selectionHaptic, tapHaptic } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, space } from '@/theme/tokens';

import { buildRail, dayAtFraction, fractionOfDay, railMarks, stepDay, type FeedDay } from './scrubberModel';

/** The thumb: 44 pt tall, a full tap target (rule 11). */
const THUMB_HEIGHT = 44;
const THUMB_WIDTH = 32;
/** Rail marks closer than this (pt) to the one above are left out. */
const MARK_GAP = 28;

export type FeedScrubberProps = {
  /** The timeline's days, newest first (`moments_feed_days`, `feed_days`); undefined while loading. */
  days: FeedDay[] | undefined;
  /** The day of the first row on screen; the thumb rests there. */
  currentDay: string | null;
  /** From useScrubberVisibility: shown while the list moves and while dragged. */
  visible: boolean;
  /** The rail's space: below the screen title, above the tab bar. */
  top: number;
  bottom: number;
  onDragChange: (dragging: boolean) => void;
  /** A drag let go on a day, or a screen reader stepped to one. */
  onJump: (day: string) => void;
  locale?: string;
  testID?: string;
};

function utc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** The bubble: "Thu, Nov 12", with the year when it isn't this year. */
export function scrubberDayLabel(day: string, locale: string, thisYear: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(day.startsWith(thisYear) ? null : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(utc(day));
}

function markLabel(month: string, showYear: boolean, locale: string): string {
  return new Intl.DateTimeFormat(
    locale,
    showYear ? { year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' },
  ).format(utc(`${month}-01`));
}

/**
 * The date scrubber on the Moments and Jars timelines (FR-SOC-01), as in Google Photos: a thumb on the right edge
 * shows while the list scrolls. Dragging it shows month marks along the rail and a large bubble with the day
 * under the finger, with a tick for each day passed; letting go jumps the timeline to that day, loaded or not.
 * The rail is proportional to rows, so busy days get more room. A screen reader adjusts it a day at a time.
 */
export function FeedScrubber({
  days,
  currentDay,
  visible,
  top,
  bottom,
  onDragChange,
  onJump,
  locale = deviceLocale(),
  testID = 'feed-scrubber',
}: FeedScrubberProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const rail = useMemo(() => buildRail(days ?? []), [days]);
  const [height, setHeight] = useState(0);
  const track = Math.max(0, height - THUMB_HEIGHT);
  const [drag, setDrag] = useState<{ y: number; day: string } | null>(null);
  const dragStart = useRef(0);
  const lastDay = useRef<string | null>(null);
  const thisYear = String(new Date().getFullYear());

  const restDay = currentDay ?? rail.days[0]?.day ?? null;
  const restY = restDay === null ? 0 : fractionOfDay(rail, restDay) * track;
  const y = drag?.y ?? restY;
  const shown = visible || drag !== null;

  const fade = useAnimatedStyle(() => ({ opacity: withTiming(shown ? 1 : 0, { duration: reduceMotion ? 0 : 180 }) }));

  const dayAt = (at: number) => dayAtFraction(rail, track === 0 ? 0 : at / track);
  const moveTo = (at: number) => {
    const clamped = Math.min(Math.max(at, 0), track);
    const day = dayAt(clamped);
    if (day === null) return;
    if (lastDay.current !== null && lastDay.current !== day) selectionHaptic();
    lastDay.current = day;
    setDrag({ y: clamped, day });
  };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    testID: `${testID}-thumb`,
    onBegin: () => {
      dragStart.current = y;
      onDragChange(true);
      moveTo(y);
    },
    onUpdate: (e) => moveTo(dragStart.current + e.translationY),
    onDeactivate: (e) => {
      const day = dayAt(Math.min(Math.max(dragStart.current + e.translationY, 0), track));
      if (day !== null) {
        tapHaptic();
        onJump(day);
      }
    },
    onFinalize: () => {
      lastDay.current = null;
      setDrag(null);
      onDragChange(false);
    },
  });

  if (rail.days.length < 2) return null;

  const onAction = (e: AccessibilityActionEvent) => {
    if (restDay === null) return;
    // Swiping up (increment) moves to newer days, toward the top of the timeline.
    const next = stepDay(rail, restDay, e.nativeEvent.actionName === 'increment' ? -1 : 1);
    if (next !== null) onJump(next);
  };

  return (
    <GestureHandlerRootView
      pointerEvents="box-none"
      style={[styles.root, { top, bottom }]}
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
      testID={testID}
    >
      {drag !== null
        ? railMarks(rail, track, MARK_GAP).map((m) => (
            <View
              key={m.month}
              pointerEvents="none"
              style={[styles.mark, { top: m.fraction * track + THUMB_HEIGHT / 2 - MARK_GAP / 2 }]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('caption'), { color: colors.muted }]}>
                {markLabel(m.month, m.showYear, locale)}
              </Text>
            </View>
          ))
        : null}
      <Animated.View
        pointerEvents={shown ? 'box-none' : 'none'}
        style={[styles.thumbRow, { transform: [{ translateY: y }] }, fade]}
      >
        {drag !== null ? (
          <View style={styles.bubble} pointerEvents="none" testID={`${testID}-bubble`}>
            <Text
              maxFontSizeMultiplier={maxTextScale.control}
              numberOfLines={1}
              style={[textStyle('sectionTitle'), { color: colors.surface }]}
            >
              {scrubberDayLabel(drag.day, locale, thisYear)}
            </Text>
          </View>
        ) : null}
        <GestureDetector gesture={pan}>
          <View
            style={styles.thumb}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('scrubber.label')}
            accessibilityHint={t('scrubber.hint')}
            accessibilityValue={restDay === null ? undefined : { text: scrubberDayLabel(restDay, locale, thisYear) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onAction}
            hitSlop={{ left: space.md, right: space.xs }}
            testID={`${testID}-handle`}
          >
            <Icon name="chevronUpDown" color="ink" size={18} strokeWidth={2.2} />
          </View>
        </GestureDetector>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', right: 0, left: 0 },
  thumbRow: {
    position: 'absolute',
    top: 0,
    right: space.xs,
    height: THUMB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  bubble: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    ...shadow.floating,
  },
  mark: {
    position: 'absolute',
    right: THUMB_WIDTH + space.xs + space.md,
    height: MARK_GAP,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
