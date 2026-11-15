import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useSimultaneousGestures,
  useTapGesture,
  type PinchGesture,
} from 'react-native-gesture-handler';

import { sizes } from '@/theme/tokens';

import { focusMark, type Point, type ViewSize } from './cameraZoom';
import { FOCUS_MARK_MS, FocusIndicator } from './FocusIndicator';

export type CameraTouchAreaProps = {
  children: ReactNode;
  /** Pinch to zoom (useCameraZoom). */
  pinch: PinchGesture;
  /** Whether the camera can focus on a point; without it, taps do nothing (front cameras often can't). */
  canFocus: boolean;
  /** A tap, in the preview's own coordinates. */
  onFocus: (point: Point) => void;
};

/**
 * The viewfinder's touch surface (D-144): tap to focus there, with a square where it was tapped, and pinch
 * to zoom. The buttons drawn over the viewfinder sit above it and keep their own taps.
 */
export function CameraTouchArea({ children, pinch, canFocus, onFocus }: CameraTouchAreaProps) {
  const size = useRef<ViewSize | null>(null);
  const marks = useRef(0);
  const [mark, setMark] = useState<{ id: number; left: number; top: number } | null>(null);

  useEffect(() => {
    if (!mark) return;
    const timer = setTimeout(() => setMark(null), FOCUS_MARK_MS);
    return () => clearTimeout(timer);
  }, [mark]);

  const tap = useTapGesture({
    runOnJS: true,
    enabled: canFocus,
    testID: 'camera-tap',
    onActivate: (event) => {
      if (!canFocus || !size.current) return;
      const { point, left, top } = focusMark({ x: event.x, y: event.y }, size.current, sizes.focusMark);
      onFocus(point);
      marks.current += 1;
      setMark({ id: marks.current, left, top });
    },
  });
  const gesture = useSimultaneousGestures(tap, pinch);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => {
          size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
        }}
        testID="camera-touch-area"
      >
        {children}
        {mark ? <FocusIndicator key={mark.id} left={mark.left} top={mark.top} /> : null}
      </View>
    </GestureDetector>
  );
}
