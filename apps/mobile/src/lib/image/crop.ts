// 3:4 crop math for the image pipeline (FR-CAP-03). Pure.
import { z } from 'zod';

import { crop as cropTokens, fitBorderWidths, fitCornerRadii } from '@/theme/tokens';

/** Uploaded photo and thumbnail sizes, portrait 3:4 (FR-CAP-03, M2-09). */
export const FULL_SIZE = { width: 1440, height: 1920 } as const;
export const THUMB_SIZE = { width: 480, height: 640 } as const;
/** The feed copy (NFR-PERF-02): a timeline card is about 360 pt wide, 1080 px on a 3× screen. */
export const MEDIUM_SIZE = { width: 1080, height: 1440 } as const;

/** A rectangle in source pixels, as `expo-image-manipulator` crops take it. */
export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * The largest 3:4 rectangle centred in `area` (the whole image by default), clamped to the image
 * and rounded to whole pixels. The Crop screen passes its frame as `area`; a frame that is slightly
 * off 3:4 from rounding is trimmed to 3:4.
 */
export function cropRect34(imageWidth: number, imageHeight: number, area?: CropRect): CropRect {
  return cropRectRatio(imageWidth, imageHeight, { width: 3, height: 4 }, area);
}

/**
 * The largest rectangle of `ratio` (width : height, e.g. 1:1 for an avatar or 5:2 for a cover) centred in
 * `area` (the whole image by default), clamped to the image and rounded to whole pixels (D-79).
 */
export function cropRectRatio(imageWidth: number, imageHeight: number, ratio: Size, area?: CropRect): CropRect {
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

  const width = Math.min(Math.floor(areaWidth), Math.round((areaHeight * ratio.width) / ratio.height));
  const height = Math.min(Math.floor(areaHeight), Math.round((width * ratio.height) / ratio.width));
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
 * Fit's frame styles (D-152): what fills the 3:4 frame around a photo placed whole inside it. Plain colours
 * (tokens' `fitFrameColors`) or a soft blur of the photo itself; no borders, patterns or text.
 */
export const fitFrames = ['white', 'offWhite', 'cream', 'black', 'blur'] as const;
export type FitFrame = (typeof fitFrames)[number];

/** Fit's border widths (D-154): none, or a plain border around the photo (tokens' `fitBorderWidths`). */
export const fitBorders = ['none', 'thin', 'medium', 'thick'] as const;
export type FitBorder = (typeof fitBorders)[number];
/** Fit's border colours (tokens' `fitBorderColors`). */
export const fitBorderColorNames = ['white', 'cream', 'black'] as const;
export type FitBorderColor = (typeof fitBorderColorNames)[number];
/** Fit's corners: square, or rounded (tokens' `fitCornerRadii`), on the photo and its border alike. */
export const fitCorners = ['none', 'small', 'medium', 'large'] as const;
export type FitCorners = (typeof fitCorners)[number];

/**
 * Fit's choices (D-152, D-154), saved in the queued crop spec. `scale` is the photo's size as a share of the
 * largest it can be while it and its border fit whole in the frame; `x` and `y` move its centre from the frame's
 * centre by shares of the frame's width and height (clamped so it stays whole inside). Rows queued before D-154
 * have only `frame`: the photo whole, centred, as large as it fits, no border, square corners.
 */
export const fitSpecSchema = z.object({
  frame: z.enum(fitFrames),
  scale: z.number().finite().min(cropTokens.fitMinScale).max(1).optional(),
  x: z.number().finite().min(-0.5).max(0.5).optional(),
  y: z.number().finite().min(-0.5).max(0.5).optional(),
  border: z.enum(fitBorders).optional(),
  borderColor: z.enum(fitBorderColorNames).optional(),
  corners: z.enum(fitCorners).optional(),
});
export type FitSpec = z.infer<typeof fitSpecSchema>;
/** Every Fit choice made: what the Crop screen holds and draws. */
export type FitLayout = Required<FitSpec>;

export const DEFAULT_FIT_LAYOUT: Omit<FitLayout, 'frame'> = {
  scale: 1,
  x: 0,
  y: 0,
  border: 'none',
  borderColor: 'white',
  corners: 'none',
};

/** `spec` with the choices it doesn't name at their defaults (rows queued before D-154). */
export function fitLayoutOf(spec: FitSpec): FitLayout {
  return { ...DEFAULT_FIT_LAYOUT, ...spec } as FitLayout;
}

/** The frame style and decoration: remembered on the phone (cropPrefs). */
export type FitStyle = Pick<FitLayout, 'frame' | 'border' | 'borderColor' | 'corners'>;
/** Where the photo sits: starts whole and centred for every photo. */
export type FitPlace = Pick<FitLayout, 'scale' | 'x' | 'y'>;
export const DEFAULT_FIT_PLACE: FitPlace = { scale: 1, x: 0, y: 0 };

/** `scale` within Fit's range: `crop.fitMinScale` up to 1 (the largest that fits whole). */
export function clampFitScale(scale: number): number {
  return Number.isFinite(scale) ? Math.min(1, Math.max(cropTokens.fitMinScale, scale)) : 1;
}

export type Rect = { x: number; y: number; width: number; height: number };

/** Where Fit draws, in `out`'s units: the photo, the box around it (the photo plus its border), the border's
 * width and the box's outer corner radius (the photo's own corners are `radius − border`, so the curves match). */
export type FitPlacement = { box: Rect; photo: Rect; border: number; radius: number };

/**
 * Where Fit (D-152, D-154) places a photo of `source` size (already turned) in an `out` frame, unrounded: the
 * border is `fitBorderWidths` × the frame's width, the photo `scale` of the largest size that fits whole inside
 * it, the box moved `x`, `y` (shares of the frame) from the centre but never past the frame's edges. The Crop
 * screen draws this in points; preparation rounds it to pixels (`fitPixels`).
 */
export function fitPlacement(
  source: Size,
  out: Size,
  layout: Pick<FitLayout, 'scale' | 'x' | 'y' | 'border' | 'corners'>,
): FitPlacement {
  if (!(source.width >= 1 && source.height >= 1)) throw new RangeError('Image has no pixels');
  const border = layout.border === 'none' ? 0 : fitBorderWidths[layout.border] * out.width;
  const room = { width: Math.max(0, out.width - border * 2), height: Math.max(0, out.height - border * 2) };
  const fits = Math.min(room.width / source.width, room.height / source.height) * clampFitScale(layout.scale);
  const photo = { width: source.width * fits, height: source.height * fits };
  const box = { width: photo.width + border * 2, height: photo.height + border * 2 };
  const free = { width: Math.max(0, out.width - box.width), height: Math.max(0, out.height - box.height) };
  const within = (value: number, limit: number) => (Number.isFinite(value) ? Math.min(limit, Math.max(0, value)) : 0);
  const left = within(free.width / 2 + layout.x * out.width, free.width);
  const top = within(free.height / 2 + layout.y * out.height, free.height);
  // The photo's own corners get the chosen radius; the border's outside curve is that plus the border, so the
  // border is equally wide all round.
  const rounded = layout.corners === 'none' ? 0 : fitCornerRadii[layout.corners] * out.width;
  const radius = rounded > 0 ? Math.min(rounded + border, box.width / 2, box.height / 2) : 0;
  return {
    box: { x: left, y: top, ...box },
    photo: { x: left + border, y: top + border, ...photo },
    border,
    radius,
  };
}

/**
 * `layout` with its size within range and its position pulled back so the photo and its border stay whole inside
 * a 3:4 frame (`out`; the shares are the same at any size of it). `source` is the turned photo's size.
 */
export function clampFitLayout<T extends Pick<FitLayout, 'scale' | 'x' | 'y' | 'border' | 'corners'>>(
  source: Size,
  layout: T,
  out: Size = FULL_SIZE,
): T {
  const scale = clampFitScale(layout.scale);
  const { box } = fitPlacement(source, out, { ...layout, scale, x: 0, y: 0 });
  const limitX = Math.max(0, (out.width - box.width) / 2 / out.width);
  const limitY = Math.max(0, (out.height - box.height) / 2 / out.height);
  const within = (value: number, limit: number) =>
    Number.isFinite(value) ? Math.min(limit, Math.max(-limit, value)) || 0 : 0;
  return { ...layout, scale, x: within(layout.x, limitX), y: within(layout.y, limitY) };
}

/** `fitPlacement` in whole pixels: each edge rounded on its own, so the box stays inside the frame and the photo
 * is drawn 1:1 at `photo` (at most a pixel off its own aspect). */
export type FitPixels = { box: CropRect; photo: CropRect; border: number; radius: number };

export function fitPixels(
  source: Size,
  out: Size,
  layout: Pick<FitLayout, 'scale' | 'x' | 'y' | 'border' | 'corners'>,
): FitPixels {
  const place = fitPlacement(source, out, layout);
  const border = Math.round(place.border);
  const left = Math.round(place.box.x);
  const top = Math.round(place.box.y);
  const width = Math.max(border * 2 + 1, Math.round(place.box.x + place.box.width) - left);
  const height = Math.max(border * 2 + 1, Math.round(place.box.y + place.box.height) - top);
  return {
    box: { originX: left, originY: top, width, height },
    photo: { originX: left + border, originY: top + border, width: width - border * 2, height: height - border * 2 },
    border,
    radius: Math.round(place.radius),
  };
}

/**
 * Where Fit (D-152) draws a photo of `source` size inside an `out` frame (the 1440 × 1920 full photo by
 * default) with no layout changes: as large as it fits, centred, in whole pixels (`fitPixels`' photo).
 */
export function fitRect34(source: Size, out: Size = FULL_SIZE): CropRect {
  return fitPixels(source, out, DEFAULT_FIT_LAYOUT).photo;
}

/**
 * What the Crop screen chose (M2-10), stored on the queued photo until it is prepared. The photo is turned
 * `rotate` degrees clockwise, then mirrored left to right when `flip`; `crop` is the frame in that turned
 * image's pixels, measured on an image of `cropBasis` size (the size the picker reported). Preparation
 * scales `crop` to the size it actually decodes, so a picker that reports a scaled size still crops the
 * same part of the photo. With `fit` (D-152) the turned photo isn't cropped at all: it is placed whole inside
 * the 3:4 frame (`fitPixels`, with its position, size, border and corners from D-154) on `fit.frame`, and `crop`
 * is ignored. Rows queued before Fit have no `fit`.
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
  fit: fitSpecSchema.optional(),
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
