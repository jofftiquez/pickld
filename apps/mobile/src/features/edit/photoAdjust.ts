// The editor's quick photo buttons (FR-CAP-04): turn the photo a quarter turn clockwise or mirror it.
// Unlike filters and overlays this changes the photo itself: the editor previews the adjusted 3:4 photo
// (made by the same pipeline as preparation, `preparePhoto(photo, adjust)`) and Done saves those files.
// An adjust is always measured from the photo the editor opened with, in the pipeline's order: turn
// `rotate` degrees clockwise, then mirror when `flip`. A quarter turn of a 3:4 photo is 4:3, so the
// pipeline keeps its middle 3:4 (the largest centred crop).
import type { Rotation } from '@/lib/image/crop';

import { clampTransform, type Point, type Transform } from './overlays/transform';

export type PhotoAdjust = { rotate: Rotation; flip: boolean };

export const NO_ADJUST: PhotoAdjust = { rotate: 0, flip: false };

export function sameAdjust(a: PhotoAdjust, b: PhotoAdjust): boolean {
  return a.rotate === b.rotate && a.flip === b.flip;
}

export function isAdjusted(adjust: PhotoAdjust): boolean {
  return !sameAdjust(adjust, NO_ADJUST);
}

function turn(rotation: number): Rotation {
  return (((rotation % 360) + 360) % 360) as Rotation;
}

/**
 * The shown photo turned a further quarter turn clockwise. Turning a mirrored photo clockwise is the same as
 * mirroring the photo turned a quarter turn the other way, so a flipped adjust turns back.
 */
export function rotatedClockwise(adjust: PhotoAdjust): PhotoAdjust {
  return { rotate: turn(adjust.rotate + (adjust.flip ? -90 : 90)), flip: adjust.flip };
}

/** The shown photo mirrored left to right. */
export function flipped(adjust: PhotoAdjust): PhotoAdjust {
  return { ...adjust, flip: !adjust.flip };
}

// Points are measured on the opened photo, 3 wide and 4 tall (the 3:4 photo the editor works on).
const W = 3;
const H = 4;

/** The size of the opened photo once turned. */
function turnedSize(rotate: Rotation): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: H, height: W } : { width: W, height: H };
}

/** The centred 3:4 part of the turned photo that the pipeline keeps. */
function kept(rotate: Rotation): { x: number; width: number; height: number } {
  const size = turnedSize(rotate);
  const width = Math.min(size.width, (size.height * 3) / 4);
  return { x: (size.width - width) / 2, width, height: size.height };
}

/** A point on the adjusted photo (fractions of it) as a point on the opened photo (fractions of it). */
function toOpened(adjust: PhotoAdjust, p: Point): Point {
  const size = turnedSize(adjust.rotate);
  const k = kept(adjust.rotate);
  let x = k.x + p.x * k.width;
  const y = p.y * k.height;
  if (adjust.flip) x = size.width - x;
  switch (adjust.rotate) {
    case 0:
      return { x: x / W, y: y / H };
    case 90:
      return { x: y / W, y: (H - x) / H };
    case 180:
      return { x: (W - x) / W, y: (H - y) / H };
    case 270:
      return { x: (W - y) / W, y: x / H };
  }
}

/** A point on the opened photo (fractions of it) as a point on the adjusted photo (fractions of it). */
function fromOpened(adjust: PhotoAdjust, p: Point): Point {
  const px = p.x * W;
  const py = p.y * H;
  let turned: Point;
  switch (adjust.rotate) {
    case 0:
      turned = { x: px, y: py };
      break;
    case 90:
      turned = { x: H - py, y: px };
      break;
    case 180:
      turned = { x: W - px, y: H - py };
      break;
    case 270:
      turned = { x: py, y: W - px };
      break;
  }
  const size = turnedSize(adjust.rotate);
  const x = adjust.flip ? size.width - turned.x : turned.x;
  const k = kept(adjust.rotate);
  return { x: (x - k.x) / k.width, y: turned.y / k.height };
}

/**
 * Where an overlay goes when the photo under it changes from `from` to `to`: its centre stays on the same
 * spot of the photo (kept on the photo if that spot was cropped away). Its size and angle stay as they were,
 * so words stay level and readable; mirroring mirrors its tilt too.
 */
export function moveWithPhoto(t: Transform, from: PhotoAdjust, to: PhotoAdjust): Transform {
  const centre = fromOpened(to, toOpened(from, t));
  return clampTransform({
    x: centre.x,
    y: centre.y,
    scale: t.scale,
    rotation: from.flip === to.flip ? t.rotation : -t.rotation,
  });
}
