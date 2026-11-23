import { z } from 'zod';

import { filterIdSchema } from './filters';
import { textFields } from './text/textOverlay';

// The editor's edits (FR-CAP-08): stored as data in the queue item's and the moment's `edits` JSON and
// drawn over the photo at display time. They are never burned into the photo: the uploaded file stays
// the prepared photo. Version 1 holds the color filter and the overlays (stickers, bubbles, text, places, mentions).

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

export const stickerStamps = ['time', 'date', 'weekday', 'jar_number'] as const;

/**
 * A sticker (M2-15): the catalog sticker's id plus what drawing it needs, so a moment's stickers render
 * offline and for viewers who don't own the pack (FR-STK-04) without a catalog lookup: the art's asset
 * path (0012 format), its name for screen readers, and for an auto stamp which live value it shows.
 */
const stickerFields = {
  // Catalog ids are md5-derived (0012), not RFC version 4, so any 8-4-4-4-12 hex id is accepted.
  stickerId: z.guid(),
  asset: z.string().regex(/^stickers\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}\.png$/),
  label: z.string().min(1).max(60),
  stamp: z.enum(stickerStamps).optional(),
};

/** Bubble text limit (FR-CAP-06). */
export const BUBBLE_TEXT_MAX = 60;
export const bubbleShapeSchema = z.enum(['speech', 'thought', 'shout', 'whisper']);
export type BubbleShape = z.infer<typeof bubbleShapeSchema>;
export const bubbleColorSchema = z.enum(['white', 'ink', 'pickle', 'butter', 'blush', 'sky']);
export type BubbleColor = z.infer<typeof bubbleColorSchema>;
/** Which side a bubble's tail (its pointed end, or a thought's dots) hangs on. */
export const bubbleTailSchema = z.enum(['left', 'right']);
export type BubbleTail = z.infer<typeof bubbleTailSchema>;
/** Bubbles saved before the tail could flip have no `tail`; they keep it on the left, where their sharp corner was. */
export const DEFAULT_BUBBLE_TAIL: BubbleTail = 'left';

// A bubble's content (M2-16). Each field has a default so bubbles saved before it existed (transform
// only) still read back, as an empty white speech bubble.
const bubbleContent = {
  shape: bubbleShapeSchema.default('speech'),
  color: bubbleColorSchema.default('white'),
  text: z.string().max(BUBBLE_TEXT_MAX).default(''),
  // Optional, not defaulted: stored bubbles without it read back unchanged; draw with `bubbleTailSide`.
  tail: bubbleTailSchema.optional(),
  // A thought drawn as a cloud (made since the cloud existed); thoughts without it stay a pill. Optional
  // for the same reason as `tail`; draw with `isCloud`.
  cloud: z.boolean().optional(),
};

/** Place sticker text limit. */
export const PLACE_TEXT_MAX = 40;

// A place sticker: only the words the user chose to show, in a bubble color. Never coordinates: a place
// read from the phone's location becomes text on the phone, and that text is all that is saved (unknown
// keys are stripped by the schema, so nothing else can ride along).
const placeFields = {
  text: z
    .string()
    .max(PLACE_TEXT_MAX)
    .refine((s) => s.trim().length > 0),
  color: bubbleColorSchema.default('white'),
};

/** Pickld usernames (0001): 3 to 20 letters, digits, dots and underscores. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,20}$/;

// A mention sticker (0172): the tagged person's id and the username it shows, in a bubble color. Only mutual
// readers can be tagged; the database drops any other mention and keeps the username current, and the tag
// leaves the moment when the person removes it or a block comes between them.
const mentionFields = {
  userId: z.guid(),
  username: z.string().regex(USERNAME_PATTERN),
  color: bubbleColorSchema.default('white'),
};

// One member per overlay kind, discriminated on `type`. M2-13 (transforms) starts from this; the tools
// add their content fields: M2-15 the sticker id, M2-16 the bubble text and style, M2-17 the text.
export const overlaySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sticker'), ...overlayBase, ...stickerFields }),
  z.object({ type: z.literal('bubble'), ...overlayBase, ...bubbleContent }),
  z.object({ type: z.literal('text'), ...overlayBase, ...textFields }),
  z.object({ type: z.literal('place'), ...overlayBase, ...placeFields }),
  z.object({ type: z.literal('mention'), ...overlayBase, ...mentionFields }),
]);
export type Overlay = z.infer<typeof overlaySchema>;
export type Bubble = Extract<Overlay, { type: 'bubble' }>;
export type Place = Extract<Overlay, { type: 'place' }>;
export type Mention = Extract<Overlay, { type: 'mention' }>;

/** Photo description limit (0174 refuses anything longer). */
export const PHOTO_DESCRIPTION_MAX = 250;

// The photo description screen readers read to everyone who can see the moment (0174). Not drawn: it rides in
// edits so it is checked and shown with them. Absent when there is none; the database refuses an empty one.
const descriptionSchema = z.string().trim().min(1).max(PHOTO_DESCRIPTION_MAX);

export const editsSchema = z.object({
  v: z.literal(EDITS_VERSION),
  filter: filterIdSchema,
  overlays: z.array(overlaySchema),
  alt: descriptionSchema.optional(),
});
export type Edits = z.infer<typeof editsSchema>;

export const DEFAULT_EDITS: Edits = { v: EDITS_VERSION, filter: 'original', overlays: [] };

// Lenient reading of stored JSON: each field falls back on its own, and an overlay that doesn't parse
// (an unknown kind, a bad number) is dropped without losing the others.
const storedSchema = z.object({
  filter: filterIdSchema.catch(DEFAULT_EDITS.filter),
  overlays: z.array(z.unknown()).catch([]),
  alt: descriptionSchema.optional().catch(undefined),
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
  const { alt } = stored.data;
  return { v: EDITS_VERSION, filter: stored.data.filter, overlays, ...(alt === undefined ? {} : { alt }) };
}

/** `edits` with the photo description set to `text`, or without one when it is blank. */
export function withDescription(edits: Edits, text: string): Edits {
  const alt = text.trim().slice(0, PHOTO_DESCRIPTION_MAX);
  const next: Edits = { ...edits, alt };
  if (alt === '') delete next.alt;
  return next;
}
