// Zoom stops, pinch and tap to focus for the Camera screen (FR-CAP-01, D-144). Pure, so the rules can be
// tested without a camera. Zoom values are the camera's own zoom factors (vision-camera `setZoom`): on a
// phone with an ultra-wide lens the camera is one "virtual" device whose zoom 1 is the ultra-wide, so the
// wide lens the user calls 1× sits at a higher factor (2 on an iPhone 14 Pro). That factor is `neutral`.
import type { CameraDevice } from 'react-native-vision-camera';

/** What the zoom and focus controls need to know about the camera in use. */
export type LensInfo = {
  /** The physical lenses behind the camera, e.g. ['ultra-wide-angle', 'wide-angle', 'telephoto']. */
  lenses: readonly string[];
  minZoom: number;
  maxZoom: number;
  /** Zoom factors where the camera switches to the next lens (empty for a single lens). */
  switchFactors: readonly number[];
  /** Whether tapping the preview can focus (front cameras often can't). */
  supportsFocus: boolean;
};

/** A zoom factor for one camera; a preview ignores one meant for another camera (e.g. just after a flip). */
export type ZoomRequest = { lens: LensInfo; zoom: number };

/** A zoom button: what it shows (`factor`, 1 = the wide lens) and the zoom factor it sets. */
export type ZoomStop = { factor: number; zoom: number };

export type ZoomPlan = {
  /** Zoom factor of the wide lens (1×). */
  neutral: number;
  /** Pinch range. */
  min: number;
  max: number;
  /** Buttons, smallest first; empty when the camera has a single lens. */
  stops: ZoomStop[];
};

/** Pinch goes up to 10× the wide lens (or the camera's own limit); past that the picture is mush. */
export const MAX_ZOOM_FACTOR = 10;

export function lensInfo(
  device: Pick<
    CameraDevice,
    'type' | 'physicalDevices' | 'minZoom' | 'maxZoom' | 'zoomLensSwitchFactors' | 'supportsFocusMetering'
  >,
): LensInfo {
  const physical = device.physicalDevices.map((d) => d.type);
  return {
    // A physical camera lists no constituent devices: it is its own lens.
    lenses: physical.length > 0 ? physical : [device.type],
    minZoom: device.minZoom,
    maxZoom: device.maxZoom,
    switchFactors: device.zoomLensSwitchFactors,
    supportsFocus: device.supportsFocusMetering,
  };
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** The zoom for a pinch that started at `start` and has scaled by `scale`, kept within the range. */
export function pinchZoom(start: number, scale: number, min: number, max: number): number {
  'worklet';
  return clamp(start * scale, min, max);
}

const roundFactor = (factor: number) => Math.round(factor * 10) / 10;

/** The zoom as the user reads it (1 = wide lens), to one decimal: 0.5, 1, 2.4. */
export function displayFactor(zoom: number, neutral: number): number {
  return roundFactor(zoom / neutral);
}

/** "0.5", "1", "2.4": a factor for the "×" labels. */
export function formatFactor(factor: number): string {
  return String(roundFactor(factor));
}

export function zoomPlan(lens: LensInfo): ZoomPlan {
  const { lenses, minZoom, maxZoom, switchFactors } = lens;
  const multiLens = lenses.length > 1;
  const hasUltraWide = multiLens && lenses.includes('ultra-wide-angle');
  // With an ultra-wide, the first switch is from it to the wide lens: that factor is 1×.
  const neutral = clamp(hasUltraWide ? (switchFactors[0] ?? minZoom) : minZoom, minZoom, maxZoom);
  const max = Math.min(maxZoom, neutral * MAX_ZOOM_FACTOR);
  const plan: ZoomPlan = { neutral, min: minZoom, max, stops: [] };
  if (!multiLens) return plan;

  const stops: ZoomStop[] = [];
  const add = (zoom: number) => {
    const factor = displayFactor(zoom, neutral);
    if (zoom > max || stops.some((s) => s.factor === factor)) return;
    stops.push({ factor, zoom });
  };
  // The telephoto (2× on older phones, 3× on an iPhone 14 Pro, 5× on a 15 Pro Max): the last lens switch.
  const last = switchFactors[switchFactors.length - 1];
  const tele = lenses.includes('telephoto') && last !== undefined && last > neutral ? last : undefined;
  if (hasUltraWide) add(minZoom);
  add(neutral);
  // 2×, a crop of the wide lens, unless a telephoto under 3× already sits next to it.
  if (tele === undefined || tele >= neutral * 3) add(neutral * 2);
  if (tele !== undefined) add(tele);
  plan.stops = stops.sort((a, b) => a.factor - b.factor);
  return plan;
}

/** The button for the current zoom: the largest stop at or below it (-1 without buttons). */
export function selectedStop(stops: readonly ZoomStop[], factor: number): number {
  let selected = stops.length > 0 ? 0 : -1;
  stops.forEach((stop, index) => {
    if (stop.factor <= factor) selected = index;
  });
  return selected;
}

export type Point = { x: number; y: number };
export type ViewSize = { width: number; height: number };

/**
 * Where a tap focuses and where its square is drawn. The point is the tap in the preview's own coordinates
 * (vision-camera's `focusTo` maps it to the sensor), kept inside the preview; the square (`box` wide) is
 * centred on it but kept fully inside the preview.
 */
export function focusMark(tap: Point, view: ViewSize, box: number): { point: Point; left: number; top: number } {
  const point = { x: clamp(tap.x, 0, view.width), y: clamp(tap.y, 0, view.height) };
  return {
    point,
    left: clamp(point.x - box / 2, 0, Math.max(0, view.width - box)),
    top: clamp(point.y - box / 2, 0, Math.max(0, view.height - box)),
  };
}
