// Crop screen geometry (FR-CAP-03, M2-10). Pure.
//
// The photo (`image`, its pixel size) is turned `rotation` degrees clockwise, mirrored left to right when
// `flip`, tilted `straighten` degrees clockwise to level it (only its levelled middle counts, `levelledSize`),
// then drawn at `coverScale × zoom` points per pixel with its centre `pan` points from the centre
// of the 3:4 `frame`. Zoom 1 is the smallest size that still covers the frame; pan is clamped so the photo
// always fills the frame. `cropRectFor` turns that into the frame's rectangle in the levelled photo's
// pixels, which is what the image pipeline crops after turning and levelling the photo the same way.
import {
  cropRectRatio,
  levelledSize,
  MAX_STRAIGHTEN,
  rotatedSize,
  type CropRect,
  type Rotation,
  type Size,
} from '@/lib/image/crop';
import { crop, sizes, space } from '@/theme/tokens';

export type Point = { x: number; y: number };

export type CropState = { rotation: Rotation; flip: boolean; straighten: number; zoom: number; pan: Point };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** What the Crop screen is cropping: a moment (3:4, the camera's gallery photo and Re-crop), or Edit
 * profile's avatar (a square under a circle guide) or cover (the cover band's 5:2) (D-79). */
export type CropMode = 'moment' | 'avatar' | 'cover';

/** Each mode's frame shape, width : height. */
export const CROP_RATIO: Record<CropMode, Size> = {
  moment: { width: 3, height: 4 },
  avatar: { width: 1, height: 1 },
  cover: { width: 5, height: 2 },
};

export const initialCrop: CropState = { rotation: 0, flip: false, straighten: 0, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };

/** The part of the photo the frame crops from and Fit places: turned, then levelled by Straighten. */
export function croppedSize(image: Size, rotation: Rotation, straighten = 0): Size {
  return levelledSize(rotatedSize(image, rotation), straighten);
}

/** Crop's header at normal text sizes: the padding under the safe area, the 44-point row of Cancel, the
 * title and the main button, its bottom padding and the gap above the photo (CropView). */
export const CROP_HEADER_HEIGHT = crop.headerPaddingTop + sizes.minTap + space.sm + space.sm;

/** The sheet at normal text sizes, without the bottom safe area: its top padding, the zoom slider, the note and
 * the bottom padding, with the gap between them (CropView). Rotate, Flip and Reset sit on the photo (D-158). */
export const CROP_SHEET_HEIGHT = crop.sheetPaddingTop + sizes.minTap + space.lg + crop.noteHeight + space.lg;

/** A moment's tool sheet: the same, with the Fill / Fit row on top (D-152). */
export const MOMENT_CROP_SHEET_HEIGHT = CROP_SHEET_HEIGHT + sizes.minTap + space.lg;

/**
 * The frame (3:4 unless `ratio` says otherwise) on a screen of `window` size with these safe areas (D-65):
 * as wide as the side insets allow, but short enough that the header, the photo area (the frame plus
 * `crop.frameInsetY` above and below) and the tool sheet (`sheet` tall) fit on screen together, so the sheet
 * doesn't scroll at normal text sizes.
 */
export function cropFrame(
  window: Size,
  insets: { top: number; bottom: number },
  ratio: Size = CROP_RATIO.moment,
  sheet: number = CROP_SHEET_HEIGHT,
): Size {
  const area = window.height - insets.top - CROP_HEADER_HEIGHT - sheet - insets.bottom;
  const tallest = area - crop.frameInsetY * 2;
  const width = Math.max(1, Math.min(window.width - crop.frameInsetX * 2, (tallest * ratio.width) / ratio.height));
  return { width, height: (width * ratio.height) / ratio.width };
}

/** True when the photo is exactly 3:4 portrait, so it may skip the Crop screen. */
export function isThreeByFour(image: Size): boolean {
  return image.width > 0 && image.width * 4 === image.height * 3;
}

/** Points per photo pixel at zoom 1: the turned, levelled photo just covers the frame. */
export function coverScale(image: Size, frame: Size, rotation: Rotation, straighten = 0): number {
  const turned = croppedSize(image, rotation, straighten);
  return Math.max(frame.width / turned.width, frame.height / turned.height);
}

/** Points per photo pixel in Fit (D-152): the whole turned photo inside the frame. */
export function containScale(image: Size, frame: Size, rotation: Rotation): number {
  const turned = rotatedSize(image, rotation);
  return Math.min(frame.width / turned.width, frame.height / turned.height);
}

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : MIN_ZOOM;
}

/** How far the photo's centre may move from the frame's centre at this zoom, in points. */
export function maxPan(image: Size, frame: Size, rotation: Rotation, zoom: number, straighten = 0): Point {
  const turned = croppedSize(image, rotation, straighten);
  const scale = coverScale(image, frame, rotation, straighten) * clampZoom(zoom);
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
  const straighten = clamp(state.straighten, MAX_STRAIGHTEN);
  const limit = maxPan(image, frame, state.rotation, zoom, straighten);
  return { ...state, straighten, zoom, pan: { x: clamp(state.pan.x, limit.x), y: clamp(state.pan.y, limit.y) } };
}

/** Straighten: tilts the photo `degrees` clockwise (within ±MAX_STRAIGHTEN) about the frame's centre; zoom
 * stays, so the levelled photo grows to keep covering the frame, and pan is clamped. */
export function straightenCrop(state: CropState, degrees: number, image: Size, frame: Size): CropState {
  return clampCrop({ ...state, straighten: degrees }, image, frame);
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

/** Rotate 90°: a quarter turn clockwise, starting again from the whole photo fitted to the frame. Straighten
 * stays: the levelled photo turns with it. */
export function rotateCrop(state: CropState): CropState {
  return { ...state, rotation: ((state.rotation + 90) % 360) as Rotation, zoom: MIN_ZOOM, pan: { x: 0, y: 0 } };
}

/** Flip: mirror left to right; the same part of the photo stays in the frame, as level as it was (the tilt is
 * mirrored too). */
export function flipCrop(state: CropState): CropState {
  return {
    ...state,
    flip: !state.flip,
    straighten: state.straighten === 0 ? 0 : -state.straighten,
    pan: { x: state.pan.x === 0 ? 0 : -state.pan.x, y: state.pan.y },
  };
}

/**
 * The frame's rectangle in the turned (and mirrored) and levelled photo's pixels (`croppedSize`): whole pixels,
 * exactly 3:4 (or `ratio`), inside the levelled photo. The state is clamped first, so the rectangle never reaches past the photo's
 * edges.
 */
export function cropRectFor(state: CropState, image: Size, frame: Size, ratio: Size = CROP_RATIO.moment): CropRect {
  const s = clampCrop(state, image, frame);
  const turned = croppedSize(image, s.rotation, s.straighten);
  const scale = coverScale(image, frame, s.rotation, s.straighten) * s.zoom;
  const width = frame.width / scale;
  const height = frame.height / scale;
  return cropRectRatio(turned.width, turned.height, ratio, {
    originX: turned.width / 2 - s.pan.x / scale - width / 2,
    originY: turned.height / 2 - s.pan.y / scale - height / 2,
    width,
    height,
  });
}
