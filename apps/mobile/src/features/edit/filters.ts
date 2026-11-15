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

// The other looks (all but Original, Mono and Abo) are built as: saturation around Rec. 709 luminance, then a
// per-channel tint scaled by (1 - lift), plus a lift. That keeps black at the lift and white at
// tint × (1 - lift) + lift, so neither clips. A matrix can't add contrast without clipping black, so the
// looks differ in saturation, tint and lift. Values rounded to 4 places.
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
  // Warm faded brown, like coffee with milk: saturation 0.7, tint (0.92, 0.78, 0.6), lift (0.08, 0.05, 0.03).
  kape: [
    0.6465, 0.1816, 0.0183, 0, 0.08,
    0.0473, 0.6777, 0.0161, 0, 0.05,
    0.0371, 0.1249, 0.42, 0, 0.03,
    0, 0, 0, 1, 0,
  ],
  // Soft lavender pastel, pinker and lighter than Dusk: saturation 0.75, tint (0.98, 0.86, 0.99), lift
  // (0.12, 0.08, 0.14).
  ube: [
    0.6926, 0.1542, 0.0156, 0, 0.12,
    0.0421, 0.7349, 0.0143, 0, 0.08,
    0.0453, 0.1522, 0.6539, 0, 0.14,
    0, 0, 0, 1, 0,
  ],
  // Bright and clean, slightly cool: saturation 1.15, tint (0.93, 0.99, 0.99), lift (0.08, 0.1, 0.11).
  sampaguita: [
    0.9567, -0.0918, -0.0093, 0, 0.08,
    -0.0284, 0.9291, -0.0096, 0, 0.1,
    -0.0281, -0.0945, 1.0037, 0, 0.11,
    0, 0, 0, 1, 0,
  ],
  // Cool night: saturation 1.1, tint (0.84, 0.92, 0.99), almost no lift (0, 0, 0.02), so blacks stay deep
  // and the photo reads as more contrasty than the faded looks.
  gabi: [
    0.9061, -0.0601, -0.0061, 0, 0,
    -0.0196, 0.9462, -0.0066, 0, 0,
    -0.0206, -0.0694, 1.0602, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  // Vintage, faded and a little sepia: saturation 0.4, tint (0.99, 0.92, 0.78), lift (0.12, 0.1, 0.07).
  luma: [
    0.4596, 0.3738, 0.0377, 0, 0.12,
    0.1056, 0.6865, 0.0359, 0, 0.1,
    0.0925, 0.3113, 0.3216, 0, 0.07,
    0, 0, 0, 1, 0,
  ],
  // Rainy, muted blue-green: saturation 0.6, tint (0.84, 0.95, 0.94), lift (0.04, 0.06, 0.07).
  ulan: [
    0.5524, 0.2307, 0.0233, 0, 0.04,
    0.0759, 0.7913, 0.0258, 0, 0.06,
    0.0743, 0.2501, 0.5498, 0, 0.07,
    0, 0, 0, 1, 0,
  ],
  // Ripe mango, golden-orange and punchy: saturation 1.3, tint (1, 0.9, 0.7), lift (0.03, 0.02, 0).
  mangga: [
    1.1991, -0.2081, -0.021, 0, 0.03,
    -0.0563, 0.9574, -0.0191, 0, 0.02,
    -0.0446, -0.1502, 0.8948, 0, 0,
    0, 0, 0, 1, 0,
  ],
  // Sea, cool and clear teal-blue: saturation 1.15, tint (0.82, 0.97, 1), lift (0, 0.03, 0.05).
  dagat: [
    0.9169, -0.088, -0.0089, 0, 0,
    -0.03, 0.9811, -0.0102, 0, 0.03,
    -0.0303, -0.1019, 1.0822, 0, 0.05,
    0, 0, 0, 1, 0,
  ],
  // Halo-halo, soft peachy-pink pastel: saturation 0.85, tint (1, 0.9, 0.92), lift (0.12, 0.09, 0.1).
  halo: [
    0.7761, 0.0944, 0.0095, 0, 0.12,
    0.0261, 0.784, 0.0089, 0, 0.09,
    0.0264, 0.0888, 0.7128, 0, 0.1,
    0, 0, 0, 1, 0,
  ],
  // Rice field, fresh and green: saturation 1.15, tint (0.86, 1, 0.84), lift (0.02, 0.05, 0.02).
  bukid: [
    0.9423, -0.0904, -0.0091, 0, 0.02,
    -0.0303, 0.9906, -0.0103, 0, 0.05,
    -0.0263, -0.0883, 0.9378, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  // Ash, a soft faded black and white, a little cool: saturation 0, tint (0.94, 0.95, 0.97), lift
  // (0.08, 0.08, 0.09).
  abo: [
    0.1839, 0.6185, 0.0624, 0, 0.08,
    0.1858, 0.6251, 0.0631, 0, 0.08,
    0.1877, 0.6313, 0.0637, 0, 0.09,
    0, 0, 0, 1, 0,
  ],
};
