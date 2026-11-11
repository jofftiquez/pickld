import { z } from 'zod';

import { filterIdSchema } from './filters';

// The editor's edits (FR-CAP-08): stored as data in the queue item's and the moment's `edits` JSON and
// drawn over the photo at display time. They are never burned into the photo: the uploaded file stays
// the prepared photo. Version 1 holds the color filter and the overlays (stickers, bubbles, text).

export const EDITS_VERSION = 1;

/**
 * Where an overlay sits, relative to the photo so it survives any display size: x and y are its center
 * as fractions of the photo's width and height (0..1), scale is its width as a fraction of the photo's
 * width, rotation is in radians (clockwise).
 */
const overlayBase = {
  id: z.string().min(1).max(64),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().positive().max(4),
  rotation: z
    .number()
    .min(-2 * Math.PI)
    .max(2 * Math.PI),
};

// One member per overlay kind, discriminated on `type`. M2-13 (transforms) starts from this; the tools
// add their content fields: M2-15 the sticker id, M2-16 the bubble text and style, M2-17 the text.
export const overlaySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sticker'), ...overlayBase }),
  z.object({ type: z.literal('bubble'), ...overlayBase }),
  z.object({ type: z.literal('text'), ...overlayBase }),
]);
export type Overlay = z.infer<typeof overlaySchema>;

export const editsSchema = z.object({
  v: z.literal(EDITS_VERSION),
  filter: filterIdSchema,
  overlays: z.array(overlaySchema),
});
export type Edits = z.infer<typeof editsSchema>;

export const DEFAULT_EDITS: Edits = { v: EDITS_VERSION, filter: 'original', overlays: [] };

// Lenient reading of stored JSON: each field falls back on its own, and an overlay that doesn't parse
// (an unknown kind, a bad number) is dropped without losing the others.
const storedSchema = z.object({
  filter: filterIdSchema.catch(DEFAULT_EDITS.filter),
  overlays: z.array(z.unknown()).catch([]),
});

/**
 * Reads `edits` from storage (the queue row or the server). Never throws: missing, old (`{}` from before
 * version 1) or bad data gives the defaults, field by field.
 */
export function parseEdits(raw: unknown): Edits {
  const stored = storedSchema.safeParse(raw);
  if (!stored.success) return DEFAULT_EDITS;
  const seen = new Set<string>();
  const overlays = stored.data.overlays.flatMap((value) => {
    const overlay = overlaySchema.safeParse(value);
    if (!overlay.success || seen.has(overlay.data.id)) return [];
    seen.add(overlay.data.id);
    return [overlay.data];
  });
  return { v: EDITS_VERSION, filter: stored.data.filter, overlays };
}
