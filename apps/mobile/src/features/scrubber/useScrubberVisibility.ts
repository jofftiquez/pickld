import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** How long the rail stays after the list stops moving. */
const HIDE_AFTER_MS = 1500;

/**
 * When the scrubber shows (FR-SOC-01): while the list scrolls and for a moment after, and all the time it is
 * dragged. With a screen reader on it always shows, so it can be found and adjusted. `showFirst` shows it for a
 * moment on mount: the timeline just jumped to a date, so the reader sees where they landed.
 */
export function useScrubberVisibility(showFirst = false) {
  const [moving, setMoving] = useState(showFirst);
  const [dragging, setDragging] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** The list moved (call from onScroll), or a drag ended: show now, hide a moment after the last call. */
  const poke = useCallback(() => {
    setMoving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setScreenReader(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    if (showFirst) timer.current = setTimeout(() => setMoving(false), HIDE_AFTER_MS);
    return () => {
      alive = false;
      sub.remove();
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const onDragChange = useCallback(
    (next: boolean) => {
      setDragging(next);
      if (!next) poke();
    },
    [poke],
  );

  return { visible: moving || dragging || screenReader, poke, onDragChange };
}
