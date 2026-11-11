// 3:4 crop math for the image pipeline (FR-CAP-03). Pure.

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
