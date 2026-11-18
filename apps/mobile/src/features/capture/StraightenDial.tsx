import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type GestureResponderEvent } from 'react-native';

import { selectionHaptic } from '@/lib/haptics';
import { MAX_STRAIGHTEN } from '@/lib/image/crop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, crop, sizes } from '@/theme/tokens';

export type StraightenDialProps = {
  /** Degrees clockwise, within ±MAX_STRAIGHTEN. */
  value: number;
  /** Every step of a drag (a live preview) and every screen reader step. */
  onChange: (value: number) => void;
  /** A finger is on the dial (the Crop screen shows a fine grid meanwhile). */
  onActive?: (active: boolean) => void;
  testID?: string;
};

const DEGREES = Array.from({ length: MAX_STRAIGHTEN * 2 + 1 }, (_, i) => i - MAX_STRAIGHTEN);
/** Within this of level, a drag snaps to exactly 0. */
const SNAP = 0.3;
/** Screen readers step a whole degree. */
const STEP = 1;

/** `value` to a tenth of a degree, within range, snapped to 0 near level. */
function settle(value: number): number {
  const tenth = Math.round(Math.min(MAX_STRAIGHTEN, Math.max(-MAX_STRAIGHTEN, value)) * 10) / 10;
  return Math.abs(tenth) < SNAP ? 0 : tenth;
}

/** True when going from `from` to `to` reaches or passes a long tick (every fifth degree, level included). */
function crossesMark(from: number, to: number): boolean {
  if (from === to) return false;
  return DEGREES.some((d) => d % 5 === 0 && (to === d || (from - d) * (to - d) < 0));
}

/** "2.5" or "-3": a tenth when there is one. */
export function formatDegrees(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Straighten (FR-CAP-03): a ruler of degree ticks under the frame that slides beneath a fixed green marker, the
 * angle above it. Dragging the ruler left tilts the photo clockwise, a tenth of a degree at a time; it snaps to
 * level with a tick, and ticks again at every fifth degree. Screen readers adjust it a degree at a time. Nothing
 * animates (Reduce Motion).
 */
export function StraightenDial({ value, onChange, onActive, testID = 'crop-straighten' }: StraightenDialProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const drag = useRef<{ startPageX: number; startValue: number; last: number } | null>(null);
  const degrees = formatDegrees(value);

  const onGrant = ({ nativeEvent }: GestureResponderEvent) => {
    drag.current = { startPageX: nativeEvent.pageX, startValue: value, last: value };
    onActive?.(true);
  };
  const onMove = ({ nativeEvent }: GestureResponderEvent) => {
    const d = drag.current;
    if (d === null) return;
    const next = settle(d.startValue - (nativeEvent.pageX - d.startPageX) / crop.dialTickGap);
    if (next === d.last) return;
    if (crossesMark(d.last, next)) selectionHaptic();
    d.last = next;
    onChange(next);
  };
  const onEnd = () => {
    drag.current = null;
    onActive?.(false);
  };
  const onAccessibilityAction = ({ nativeEvent: { actionName } }: AccessibilityActionEvent) => {
    const step = actionName === 'increment' ? STEP : actionName === 'decrement' ? -STEP : 0;
    const next = settle(Math.round(value + step));
    if (next !== value) onChange(next);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('crop.straighten')}
      accessibilityHint={t('crop.straightenHint')}
      accessibilityValue={{ text: t('crop.straightenValue', { degrees }) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
      style={styles.root}
      testID={testID}
    >
      <Text
        style={[textStyle('label', '700'), styles.value, value === 0 ? null : styles.valueTilted]}
        maxFontSizeMultiplier={maxTextScale.control}
        testID={`${testID}-value`}
      >
        {t('crop.straightenShort', { degrees })}
      </Text>
      <View style={styles.ruler}>
        {DEGREES.map((d) => (
          <View
            key={d}
            style={[
              styles.tick,
              d % 5 === 0 ? styles.tickMajor : null,
              { left: width / 2 + (d - value) * crop.dialTickGap - styles.tick.width / 2 },
            ]}
          />
        ))}
        <View style={[styles.marker, { left: width / 2 - styles.marker.width / 2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: sizes.minTap, justifyContent: 'center', overflow: 'hidden' },
  value: { color: colors.onDarkMuted, textAlign: 'center' },
  valueTilted: { color: colors.surface },
  ruler: { height: crop.dialMarker, justifyContent: 'center' },
  tick: {
    position: 'absolute',
    width: 1,
    height: crop.dialTick,
    backgroundColor: colors.onDarkMuted,
    borderRadius: 1,
  },
  tickMajor: { height: crop.dialTickMajor, backgroundColor: colors.surface },
  marker: {
    position: 'absolute',
    width: 2,
    height: crop.dialMarker,
    borderRadius: 1,
    backgroundColor: colors.brand,
  },
});
