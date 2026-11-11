// Crop screen geometry (FR-CAP-03, M2-10). Pure.
//
// The photo (`image`, its pixel size) is turned `rotation` degrees clockwise, mirrored left to right when
// `flip`, then drawn at `coverScale × zoom` points per pixel with its centre `pan` points from the centre
// of the 3:4 `frame`. Zoom 1 is the smallest size that still covers the frame; pan is clamped so the photo
// always fills the frame. `cropRectFor` turns that into the frame's rectangle in the turned photo's
// pixels, which is what the image pipeline crops after turning the photo the same way.
import { cropRect34, rotatedSize, type CropRect, type Rotation, type Size } from '@/lib/image/crop';
import { crop } from '@/theme/tokens';

export type Point = { x: number; y: number };

export type CropState = { rotation: Rotation; flip: boolean; zoom: number; pan: Point };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export const initialCrop: CropState = { rotation: 0, flip: false, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };

/** The 3:4 frame on a screen of `window` size: as wide as the insets allow, but short enough that the
 * tool sheet still fits (`crop.frameShare`). */
export function cropFrame(window: Size): Size {
  const width = Math.max(1, Math.min(window.width - crop.frameInsetX * 2, (window.height * crop.frameShare * 3) / 4));
  return { width, height: (width * 4) / 3 };
}

/** True when the photo is exactly 3:4 portrait, so it may skip the Crop screen. */
export function isThreeByFour(image: Size): boolean {
  return image.width > 0 && image.width * 4 === image.height * 3;
}

/** Points per photo pixel at zoom 1: the turned photo just covers the frame. */
export function coverScale(image: Size, frame: Size, rotation: Rotation): number {
  const turned = rotatedSize(image, rotation);
  return Math.max(frame.width / turned.width, frame.height / turned.height);
}

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : MIN_ZOOM;
}

/** How far the photo's centre may move from the frame's centre at this zoom, in points. */
export function maxPan(image: Size, frame: Size, rotation: Rotation, zoom: number): Point {
  const turned = rotatedSize(image, rotation);
  const scale = coverScale(image, frame, rotation) * clampZoom(zoom);
  return {
    x: Math.max(0, (turned.width * scale - frame.width) / 2),
    y: Math.max(0, (turned.height * scale - frame.height) / 2),
  };
}

const clamp = (value: number, limit: number) =>
  Number.isFinite(value) ? Math.min(limit, Math.max(-limit, value)) || 0 : 0;

/** `state` with zoom and pan pulled back inside their limits, so the photo fills the frame. */
export function clampCrop(state: CropState, image: Size, frame: Size): CropState {
  const zoom = clampZoom(state.zoom);
  const limit = maxPan(image, frame, state.rotation, zoom);
  return { ...state, zoom, pan: { x: clamp(state.pan.x, limit.x), y: clamp(state.pan.y, limit.y) } };
}

/** Moves the photo to `pan` (points), clamped. */
export function panCrop(state: CropState, pan: Point, image: Size, frame: Size): CropState {
  return clampCrop({ ...state, pan }, image, frame);
}

/** Zooms about the frame's centre: the point under the centre stays there (then pan is clamped). */
export function zoomCrop(state: CropState, zoom: number, image: Size, frame: Size): CropState {
  const from = clampZoom(state.zoom);
  const to = clampZoom(zoom);
  const ratio = to / from;
  return clampCrop({ ...state, zoom: to, pan: { x: state.pan.x * ratio, y: state.pan.y * ratio } }, image, frame);
}

/** Rotate 90°: a quarter turn clockwise, starting again from the whole photo fitted to the frame. */
export function rotateCrop(state: CropState): CropState {
  return { ...state, rotation: ((state.rotation + 90) % 360) as Rotation, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };
}

/** Flip: mirror left to right; the same part of the photo stays in the frame. */
export function flipCrop(state: CropState): CropState {
  return { ...state, flip: !state.flip, pan: { x: state.pan.x === 0 ? 0 : -state.pan.x, y: state.pan.y } };
}

/** Fit: the whole photo as large as it can be while covering the frame, centred; rotation and flip stay. */
export function fitCrop(state: CropState): CropState {
  return { ...state, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };
}

/**
 * The frame's rectangle in the turned (and mirrored) photo's pixels: whole pixels, exactly 3:4, inside
 * the photo. The state is clamped first, so the rectangle never reaches past the photo's edges.
 */
export function cropRectFor(state: CropState, image: Size, frame: Size): CropRect {
  const s = clampCrop(state, image, frame);
  const turned = rotatedSize(image, s.rotation);
  const scale = coverScale(image, frame, s.rotation) * s.zoom;
  const width = frame.width / scale;
  const height = frame.height / scale;
  return cropRect34(turned.width, turned.height, {
    originX: turned.width / 2 - s.pan.x / scale - width / 2,
    originY: turned.height / 2 - s.pan.y / scale - height / 2,
    width,
    height,
  });
}
