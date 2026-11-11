// Overlay transform math (FR-CAP-05, FR-CAP-08). Pure functions with no React Native imports, so the
// editor, the moment renderer (M2-18) and the web page can share them.
//
// A transform is stored relative to the photo, so it survives any display size: x and y are the
// overlay's centre as fractions of the photo's width and height (0..1), scale is the overlay's width as
// a fraction of the photo's width, rotation is in radians, clockwise (screen y points down). The
// overlay's height comes from its content: `aspect` is height ÷ width.

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Transform = { x: number; y: number; scale: number; rotation: number };

/** The overlay drawn on a photo of a given size, in that photo's pixels. */
export type PixelBox = { cx: number; cy: number; width: number; height: number; rotation: number };

/** Smallest overlay: a tenth of the photo's width. */
export const MIN_SCALE = 0.1;
/** Largest overlay: twice the photo's width (the stored schema allows up to 4). */
export const MAX_SCALE = 2;

const TAU = 2 * Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** The same angle in (-π, π], so stored rotations stay small however many turns a gesture makes. */
export function normalizeRotation(rotation: number): number {
  const r = (((rotation + Math.PI) % TAU) + TAU) % TAU; // [0, 2π)
  return r === 0 ? Math.PI : r - Math.PI;
}

/** Keeps the centre on the photo, the size within bounds and the angle in (-π, π]. */
export function clampTransform(t: Transform): Transform {
  return {
    x: clamp(t.x, 0, 1),
    y: clamp(t.y, 0, 1),
    scale: clampScale(t.scale),
    rotation: normalizeRotation(t.rotation),
  };
}

export function toPixels(t: Transform, photo: Size, aspect: number): PixelBox {
  const width = t.scale * photo.width;
  return { cx: t.x * photo.width, cy: t.y * photo.height, width, height: width * aspect, rotation: t.rotation };
}

export function fromPixels(box: Pick<PixelBox, 'cx' | 'cy' | 'width' | 'rotation'>, photo: Size): Transform {
  return { x: box.cx / photo.width, y: box.cy / photo.height, scale: box.width / photo.width, rotation: box.rotation };
}

/**
 * What a gesture has done since it began, in photo pixels: the drag, the pinch factor (1 = unchanged)
 * and the twist in radians (clockwise).
 */
export type GestureDelta = { dx: number; dy: number; scale: number; rotation: number };

export const NO_DELTA: GestureDelta = { dx: 0, dy: 0, scale: 1, rotation: 0 };

/**
 * The transform after a gesture, from the transform it started at. Scaling and rotating turn the overlay
 * about its own centre; the drag moves the centre. The result is clamped.
 */
export function applyDelta(start: Transform, delta: GestureDelta, photo: Size): Transform {
  return clampTransform({
    x: start.x + delta.dx / photo.width,
    y: start.y + delta.dy / photo.height,
    scale: start.scale * delta.scale,
    rotation: start.rotation + delta.rotation,
  });
}

/**
 * The corner handle: one finger dragged from `from` to `to` scales by the change in distance from the
 * overlay's centre and rotates by the change in angle around it. A finger on the centre changes nothing.
 */
export function handleDelta(center: Point, from: Point, to: Point): GestureDelta {
  const fromX = from.x - center.x;
  const fromY = from.y - center.y;
  const toX = to.x - center.x;
  const toY = to.y - center.y;
  const fromLength = Math.hypot(fromX, fromY);
  const toLength = Math.hypot(toX, toY);
  if (fromLength === 0 || toLength === 0) return NO_DELTA;
  const rotation = normalizeRotation(Math.atan2(toY, toX) - Math.atan2(fromY, fromX));
  return { dx: 0, dy: 0, scale: toLength / fromLength, rotation };
}

/** `p` in the overlay's own frame: relative to its centre, with its rotation undone. */
export function toLocal(box: PixelBox, p: Point): Point {
  const dx = p.x - box.cx;
  const dy = p.y - box.cy;
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** A point given in the overlay's own frame, back in photo pixels. */
export function fromLocal(box: PixelBox, p: Point): Point {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  return { x: box.cx + p.x * cos - p.y * sin, y: box.cy + p.x * sin + p.y * cos };
}

/**
 * Whether `p` lands on the overlay. The touch area is the rotated box, grown to at least
 * `minTouch × minTouch` so small overlays stay easy to grab (AGENTS rule 11).
 */
export function hitsBox(box: PixelBox, p: Point, minTouch: number): boolean {
  const local = toLocal(box, p);
  return (
    Math.abs(local.x) <= Math.max(box.width, minTouch) / 2 && Math.abs(local.y) <= Math.max(box.height, minTouch) / 2
  );
}

/** Whether `p` is within `radius` of a control drawn at `local` in the overlay's own frame. */
export function hitsControl(box: PixelBox, local: Point, p: Point, radius: number): boolean {
  const at = fromLocal(box, local);
  return Math.hypot(p.x - at.x, p.y - at.y) <= radius;
}

/** Which way an accessibility action nudges an overlay. */
export type Step = 'left' | 'right' | 'up' | 'down' | 'bigger' | 'smaller' | 'rotateLeft' | 'rotateRight';

/** One move step: this fraction of the photo's width or height. */
export const MOVE_STEP = 0.05;
/** One resize step multiplies or divides the width by this. */
export const SCALE_STEP = 1.25;
/** One rotate step: 15°. */
export const ROTATE_STEP = Math.PI / 12;

/** The accessibility alternative to gestures: one step in a direction, clamped. */
export function stepTransform(t: Transform, step: Step): Transform {
  switch (step) {
    case 'left':
      return clampTransform({ ...t, x: t.x - MOVE_STEP });
    case 'right':
      return clampTransform({ ...t, x: t.x + MOVE_STEP });
    case 'up':
      return clampTransform({ ...t, y: t.y - MOVE_STEP });
    case 'down':
      return clampTransform({ ...t, y: t.y + MOVE_STEP });
    case 'bigger':
      return clampTransform({ ...t, scale: t.scale * SCALE_STEP });
    case 'smaller':
      return clampTransform({ ...t, scale: t.scale / SCALE_STEP });
    case 'rotateLeft':
      return clampTransform({ ...t, rotation: t.rotation - ROTATE_STEP });
    case 'rotateRight':
      return clampTransform({ ...t, rotation: t.rotation + ROTATE_STEP });
  }
}

export function sameTransform(a: Transform, b: Transform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation === b.rotation;
}
