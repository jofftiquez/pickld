import { z } from 'zod';

import { filters } from '@/theme/tokens';

// Color filters (FR-CAP-04). AGENTS rule 8: color filters only, never beauty or face-retouch filters.
// Each filter is a Skia color matrix: 4 rows (R, G, B, A) of 5 numbers, applied to unpremultiplied
// colors in 0..1; the 5th column is an offset in the same 0..1 range. Edits stay data (FR-CAP-08):
// the filter id is stored and the matrix is applied when drawing, never burned into the photo.

export const filterIdSchema = z.enum(filters);
export type FilterId = z.infer<typeof filterIdSchema>;

/** Row-major 4×5 color matrix (20 numbers), the shape Skia's <ColorMatrix> takes. */
export type ColorMatrix = readonly number[];

// The three looks are built as: saturation around Rec. 709 luminance, then a per-channel tint scaled by
// (1 - lift), plus a lift. That keeps black at the lift and white at tint × (1 - lift) + lift, so
// neither clips. Values rounded to 4 places.
// prettier-ignore
export const filterMatrices: Record<FilterId, ColorMatrix> = {
  // Identity: the photo as taken.
  original: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ],
  // Bright citrus: saturation 1.25, tint (0.98, 1, 0.84), lift (0.04, 0.05, 0): green-yellow and warm.
  kalamansi: [
    1.126, -0.1682, -0.017, 0, 0.04,
    -0.0505, 1.0176, -0.0171, 0, 0.05,
    -0.0446, -0.1502, 1.0348, 0, 0,
    0, 0, 0, 1, 0,
  ],
  // Warm golden afternoon snack: saturation 1.1, tint (1, 0.92, 0.76), lift (0.04, 0.025, 0).
  merienda: [
    1.0356, -0.0687, -0.0069, 0, 0.04,
    -0.0191, 0.9225, -0.0065, 0, 0.025,
    -0.0162, -0.0544, 0.8305, 0, 0,
    0, 0, 0, 1, 0,
  ],
  // Black and white: every channel is Rec. 709 luminance (0.2126 R + 0.7152 G + 0.0722 B).
  mono: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ],
  // Cool purple-blue evening: saturation 0.8, tint (0.9, 0.86, 1), lifted shadows (0.06, 0.05, 0.1).
  dusk: [
    0.7128, 0.121, 0.0122, 0, 0.06,
    0.0347, 0.7705, 0.0118, 0, 0.05,
    0.0383, 0.1287, 0.733, 0, 0.1,
    0, 0, 0, 1, 0,
  ],
};
