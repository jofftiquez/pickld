import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePinchGesture, type PinchGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  displayFactor,
  pinchZoom,
  selectedStop,
  zoomPlan,
  type LensInfo,
  type ZoomPlan,
  type ZoomRequest,
  type ZoomStop,
} from './cameraZoom';

export type CameraZoom = {
  plan: ZoomPlan | null;
  /** The zoom to hold the camera at, until the next pinch step or button. */
  request: ZoomRequest | undefined;
  /** The current zoom as the user reads it (1 = wide lens); follows a pinch as it moves. */
  factor: number;
  /** The factor to show while a pinch is under way, else null. */
  pinchFactor: number | null;
  /** Index of the highlighted zoom button (-1 without buttons). */
  selected: number;
  select: (stop: ZoomStop) => void;
  /** Pinch to zoom, for the preview's gesture detector. Runs on the UI thread. */
  pinch: PinchGesture;
};

/**
 * Zoom for the Camera screen (D-144): zoom buttons for the lenses the camera has, and pinch to zoom. A new
 * camera (flip, or another lens set) starts at 1×. The pinch tracks on the UI thread and hands each step
 * to `onLiveZoom`, which sets the camera's zoom straight away; the step is kept when the fingers lift.
 */
export function useCameraZoom(lens: LensInfo | null, onLiveZoom: (zoom: number) => void): CameraZoom {
  const plan = useMemo(() => (lens ? zoomPlan(lens) : null), [lens]);
  // Kept per camera: a value for the previous camera reads as 1× on the new one, and a change of camera drops
  // it, so flipping there and back also starts at 1× (the same lens object can come back).
  const [kept, setKept] = useState<ZoomRequest | null>(null);
  const [keptCamera, setKeptCamera] = useState(lens);
  if (keptCamera !== lens) {
    setKeptCamera(lens);
    setKept(null);
  }
  const [live, setLive] = useState<{ lens: LensInfo; factor: number } | null>(null);
  const zoom = plan && kept && kept.lens === lens ? kept.zoom : (plan?.neutral ?? 1);
  const pinchFactor = live && live.lens === lens ? live.factor : null;
  const factor = pinchFactor ?? (plan ? displayFactor(zoom, plan.neutral) : 1);

  // The pinch starts from the zoom on screen.
  const current = useSharedValue(zoom);
  const start = useSharedValue(zoom);
  useEffect(() => current.set(zoom), [current, zoom]);

  const onPinchStep = useCallback(
    (next: number) => {
      if (!lens || !plan) return;
      onLiveZoom(next);
      const stepFactor = displayFactor(next, plan.neutral);
      setLive((prev) => (prev?.lens === lens && prev.factor === stepFactor ? prev : { lens, factor: stepFactor }));
    },
    [lens, plan, onLiveZoom],
  );
  const onPinchEnd = useCallback(
    (last: number) => {
      setLive(null);
      if (lens) setKept({ lens, zoom: last });
    },
    [lens],
  );

  const min = plan?.min ?? 1;
  const max = plan?.max ?? 1;
  const pinch = usePinchGesture({
    enabled: plan !== null,
    testID: 'camera-pinch',
    onActivate: () => {
      'worklet';
      start.set(current.get());
    },
    onUpdate: (event) => {
      'worklet';
      const next = pinchZoom(start.get(), event.scale, min, max);
      if (next === current.get()) return;
      current.set(next);
      scheduleOnRN(onPinchStep, next);
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(onPinchEnd, current.get());
    },
  });

  const select = useCallback(
    (stop: ZoomStop) => {
      if (lens) setKept({ lens, zoom: stop.zoom });
    },
    [lens],
  );

  return {
    plan,
    request: lens && plan ? { lens, zoom } : undefined,
    factor,
    pinchFactor,
    selected: plan ? selectedStop(plan.stops, factor) : -1,
    select,
    pinch,
  };
}
