import { useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent } from 'react-native';

import { colors, radius, sizes, space } from '@/theme/tokens';

export type TextSizeSliderProps = {
  value: number;
  min: number;
  max: number;
  /** One accessibility step (swipe up or down). */
  step: number;
  /** Called once per drag, when the finger lifts, so a drag is one Undo step. */
  onCommit: (value: number) => void;
  /** Called on every move while dragging, for a live preview (Crop's zoom). */
  onChange?: (value: number) => void;
  /** Already translated. */
  accessibilityLabel: string;
  testID?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The Text panel's size slider (design: Text): a brand-green track and thumb, 44 points tall. The thumb
 * follows the finger and the value is committed when it lifts. Screen readers adjust it in steps.
 * Nothing animates, so Reduce Motion has nothing to turn off.
 */
export function TextSizeSlider({
  value,
  min,
  max,
  step,
  onCommit,
  onChange,
  accessibilityLabel,
  testID,
}: TextSizeSliderProps) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<{ startX: number; startPageX: number; value: number } | null>(null);
  const shown = drag?.value ?? value;
  const travel = Math.max(0, width - sizes.sliderThumb);

  const valueAt = (x: number) =>
    travel === 0 ? value : Math.round(min + clamp((x - sizes.sliderThumb / 2) / travel, 0, 1) * (max - min));

  const onGrant = ({ nativeEvent }: GestureResponderEvent) => {
    const next = valueAt(nativeEvent.locationX);
    setDrag({ startX: nativeEvent.locationX, startPageX: nativeEvent.pageX, value: next });
    onChange?.(next);
  };
  const onMove = ({ nativeEvent }: GestureResponderEvent) => {
    // locationX jumps when the finger crosses the thumb, so moves are measured from where it went down.
    setDrag((d) => (d === null ? d : { ...d, value: valueAt(d.startX + nativeEvent.pageX - d.startPageX) }));
    if (drag !== null) onChange?.(valueAt(drag.startX + nativeEvent.pageX - drag.startPageX));
  };
  const onEnd = () => {
    if (drag !== null && drag.value !== value) onCommit(drag.value);
    setDrag(null);
  };

  const onAccessibilityAction = ({ nativeEvent: { actionName } }: AccessibilityActionEvent) => {
    const next = clamp(value + (actionName === 'increment' ? step : actionName === 'decrement' ? -step : 0), min, max);
    if (next !== value) onCommit(next);
  };

  const fraction = max === min ? 0 : (shown - min) / (max - min);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // The screen scrolls vertically; a finger on the slider stays with the slider.
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
      style={styles.root}
      testID={testID}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: fraction * travel }]} />
      </View>
      <View style={[styles.thumb, { left: fraction * travel }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, height: sizes.minTap, justifyContent: 'center', marginHorizontal: space.xs },
  track: {
    marginHorizontal: sizes.sliderThumb / 2,
    height: sizes.sliderTrack,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: sizes.sliderTrack, backgroundColor: colors.brand },
  thumb: {
    position: 'absolute',
    width: sizes.sliderThumb,
    height: sizes.sliderThumb,
    borderRadius: sizes.sliderThumb / 2,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
