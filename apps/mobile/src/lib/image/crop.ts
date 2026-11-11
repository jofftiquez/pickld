// 3:4 crop math for the image pipeline (FR-CAP-03). Pure.
import { z } from 'zod';

/** Uploaded photo and thumbnail sizes, portrait 3:4 (FR-CAP-03, M2-09). */
export const FULL_SIZE = { width: 1440, height: 1920 } as const;
export const THUMB_SIZE = { width: 480, height: 640 } as const;

/** A rectangle in source pixels, as `expo-image-manipulator` crops take it. */
export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * The largest 3:4 rectangle centred in `area` (the whole image by default), clamped to the image
 * and rounded to whole pixels. The Crop screen passes its frame as `area`; a frame that is slightly
 * off 3:4 from rounding is trimmed to 3:4.
 */
export function cropRect34(imageWidth: number, imageHeight: number, area?: CropRect): CropRect {
  if (!(imageWidth >= 1 && imageHeight >= 1)) throw new RangeError('Image has no pixels');
  const a = area ?? { originX: 0, originY: 0, width: imageWidth, height: imageHeight };
  if (![a.originX, a.originY, a.width, a.height].every(Number.isFinite))
    throw new RangeError('Crop area is not finite');

  const left = Math.min(Math.max(a.originX, 0), imageWidth);
  const top = Math.min(Math.max(a.originY, 0), imageHeight);
  const right = Math.min(Math.max(a.originX + a.width, left), imageWidth);
  const bottom = Math.min(Math.max(a.originY + a.height, top), imageHeight);
  const areaWidth = right - left;
  const areaHeight = bottom - top;

  const width = Math.min(Math.floor(areaWidth), Math.round((areaHeight * 3) / 4));
  const height = Math.min(Math.floor(areaHeight), Math.round((width * 4) / 3));
  if (width < 1 || height < 1) throw new RangeError('Crop area is empty');
  return {
    originX: Math.min(Math.round(left + (areaWidth - width) / 2), Math.floor(imageWidth) - width),
    originY: Math.min(Math.round(top + (areaHeight - height) / 2), Math.floor(imageHeight) - height),
    width,
    height,
  };
}

/** Quarter turns clockwise, as the Crop screen's Rotate button makes them. */
export const rotations = [0, 90, 180, 270] as const;
export type Rotation = (typeof rotations)[number];

export type Size = { width: number; height: number };

const positive = z.number().finite().positive();

/**
 * What the Crop screen chose (M2-10), stored on the queued photo until it is prepared. The photo is turned
 * `rotate` degrees clockwise, then mirrored left to right when `flip`; `crop` is the frame in that turned
 * image's pixels, measured on an image of `cropBasis` size (the size the picker reported). Preparation
 * scales `crop` to the size it actually decodes, so a picker that reports a scaled size still crops the
 * same part of the photo.
 */
export const cropSpecSchema = z.object({
  crop: z.object({
    originX: z.number().finite().nonnegative(),
    originY: z.number().finite().nonnegative(),
    width: positive,
    height: positive,
  }),
  cropBasis: z.object({ width: positive, height: positive }),
  rotate: z.literal(rotations),
  flip: z.boolean(),
});
export type CropSpec = z.infer<typeof cropSpecSchema>;

/** The size of `image` after `rotation`: a quarter turn swaps width and height. */
export function rotatedSize(image: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { width: image.height, height: image.width } : image;
}

/** `rect` (measured on an image of `basis` size) in the pixels of an image of `actual` size. */
export function scaleRect(rect: CropRect, basis: Size, actual: Size): CropRect {
  const sx = actual.width / basis.width;
  const sy = actual.height / basis.height;
  return { originX: rect.originX * sx, originY: rect.originY * sy, width: rect.width * sx, height: rect.height * sy };
}
