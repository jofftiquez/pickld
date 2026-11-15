import { z } from 'zod';

import { textOverlayColors } from '@/theme/tokens';

import type { Overlay } from '../edits';
import { clampScale } from '../overlays/transform';

// The text tool's data (FR-CAP-07): what a text overlay says and how it looks, stored in `edits` beside
// its transform. Pure functions with no React Native imports, so the moment renderer (M2-18) and the
// web page can lay text out the same way.

/** Longest text, in characters (UTF-16 units, as the text field counts them). */
export const TEXT_MAX = 80;

/** Font size in points on a photo 390 points wide: new texts start at the default and grow with a pinch. */
export const TEXT_SIZE = { min: 12, max: 64, default: 30 } as const;

/** Photo width the stored `size` is measured against (the design's 390-point screen). */
export const TEXT_REF_WIDTH = 390;

export const textFontSchema = z.enum(['clean', 'bold', 'type', 'serif', 'script', 'strong', 'marker', 'hand']);
export type TextFont = z.infer<typeof textFontSchema>;

export const textColorSchema = z.enum([
  'white',
  'ink',
  'gray',
  'red',
  'orange',
  'yellow',
  'pickle',
  'teal',
  'blue',
  'purple',
  'pink',
  'sky',
  'butter',
  'blush',
]);
export type TextColor = z.infer<typeof textColorSchema>;
/** Each color's token; typed so every color has one. */
export const textColorValues: Record<TextColor, string> = textOverlayColors;
/** The colors the panel offers, in its order (the others are kept for texts saved with them). */
export const TEXT_PALETTE: readonly TextColor[] = [
  'white',
  'ink',
  'gray',
  'red',
  'orange',
  'yellow',
  'pickle',
  'teal',
  'blue',
  'purple',
  'pink',
  'sky',
];

export const textAlignSchema = z.enum(['left', 'center']);
export type TextAlign = z.infer<typeof textAlignSchema>;

/** Behind the words: nothing (a shadow instead), the color itself, or a see-through contrasting wash. */
export const textBackgroundSchema = z.enum(['none', 'solid', 'soft']);
export type TextBackground = z.infer<typeof textBackgroundSchema>;

// Outline and background, as fractions of the font size. The outline is the words drawn OUTLINE_STEPS
// times round a circle OUTLINE_WIDTH out, under the fill: the same in the app, on pickld.me and in the
// export, which have no common stroke for text.
export const OUTLINE_WIDTH = 0.07;
export const OUTLINE_STEPS = 16;
export const BACKGROUND_RADIUS = 0.25;
/** How opaque a soft background is. */
export const SOFT_BACKGROUND_ALPHA = 0.6;

/** Letter spacing as a fraction of the font size: Bold is tightened (-0.02em, as designed), Strong opened up. */
export const TEXT_TRACKING: Record<TextFont, number> = {
  clean: 0,
  bold: -0.02,
  type: 0,
  serif: 0,
  script: 0,
  strong: 0.02,
  marker: 0,
  hand: 0,
};

/** Offsets, in font sizes, the outline's copies of the words are drawn at. */
export function outlineOffsets(): { dx: number; dy: number }[] {
  return Array.from({ length: OUTLINE_STEPS }, (_, i) => {
    const a = (2 * Math.PI * i) / OUTLINE_STEPS;
    return { dx: OUTLINE_WIDTH * Math.cos(a), dy: OUTLINE_WIDTH * Math.sin(a) };
  });
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * The words' color and the box's fill for a style: a solid background is the color with the words in white
 * or ink on it; a soft one a see-through wash of the contrasting color under the colored words.
 */
export function textBoxColors({ color, background }: Pick<TextStyle, 'color' | 'background'>): {
  words: string;
  box?: string;
} {
  const contrast = textColorValues[contrastColor(color)];
  if (background === 'solid') return { words: contrast, box: textColorValues[color] };
  if (background === 'soft') return { words: textColorValues[color], box: withAlpha(contrast, SOFT_BACKGROUND_ALPHA) };
  return { words: textColorValues[color] };
}

function withAlpha(hex: string, alpha: number): string {
  const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${channel(1)},${channel(3)},${channel(5)},${alpha})`;
}

/** White or ink, whichever reads better on the color: the words on a solid background, a soft one's wash. */
export function contrastColor(color: TextColor): 'white' | 'ink' {
  const l = luminance(textColorValues[color]);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(textColorValues.ink) + 0.05);
  return onInk >= onWhite ? 'ink' : 'white';
}

/**
 * The text overlay's own fields, spread into its member of the overlay schema. The text is required;
 * the style fields fall back to the tool's defaults when missing, so a text overlay saved without them
 * still reads.
 */
export const textFields = {
  text: z
    .string()
    .max(TEXT_MAX)
    .refine((s) => s.trim().length > 0, 'Text is empty'),
  font: textFontSchema.default('bold'),
  color: textColorSchema.default('white'),
  size: z.number().int().min(TEXT_SIZE.min).max(TEXT_SIZE.max).default(TEXT_SIZE.default),
  align: textAlignSchema.default('center'),
  // Saved only when set, so texts from before read and save as they were.
  background: textBackgroundSchema.optional(),
  outline: textColorSchema.optional(),
};

export type TextOverlay = Extract<Overlay, { type: 'text' }>;
export type TextStyle = Pick<TextOverlay, 'font' | 'color' | 'size' | 'align' | 'background' | 'outline'>;
// `outline: undefined` in a patch takes the outline off.
export type TextPatch = Partial<Pick<TextOverlay, 'text'> & TextStyle>;

/** The panel's settings before anything is changed (design: Text). */
export const DEFAULT_TEXT_STYLE: TextStyle = { font: 'bold', color: 'white', size: TEXT_SIZE.default, align: 'center' };

/** The style an overlay is drawn with, unset fields filled in. */
export function textStyleOf(overlay: TextOverlay): Required<Omit<TextStyle, 'outline'>> & Pick<TextStyle, 'outline'> {
  const { font, color, size, align, background = 'none', outline } = overlay;
  return { font, color, size, align, background, outline };
}

// Layout, in points on the reference photo. Text can't be measured synchronously in React Native, so the
// box is estimated from average glyph widths (a little generous, so the real glyphs fit) and the lines
// are broken here, not by the text engine, so every display size shows the same lines.
const LINE_HEIGHT = 1.25;
const PAD_X = 0.3;
const PAD_Y = 0.15;
// A background gets more room round the words.
const BACKGROUND_PAD_X = 0.4;
const BACKGROUND_PAD_Y = 0.25;
const MAX_LINE_WIDTH = 0.8 * TEXT_REF_WIDTH;
// Average letter widths in em, a little over each face's own (so the real glyphs fit).
const GLYPH: Record<TextFont, number> = {
  clean: 0.6,
  bold: 0.64,
  type: 0.62,
  serif: 0.54,
  script: 0.57,
  strong: 0.5,
  marker: 0.6,
  hand: 0.45,
};

function glyphWidth(ch: string, font: TextFont): number {
  if (font === 'type') return GLYPH.type;
  if (ch === ' ') return 0.3;
  // Emoji and CJK are about a square each.
  return (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1.15 : GLYPH[font];
}

function measure(s: string, font: TextFont): number {
  let em = 0;
  for (const ch of s) em += glyphWidth(ch, font);
  return em;
}

export type TextLayout = {
  lines: string[];
  /** The overlay's natural box (text plus padding), in points on the reference photo. */
  width: number;
  height: number;
  /** The same font size, line height and padding, in those points. */
  fontSize: number;
  lineHeight: number;
  padX: number;
  padY: number;
};

type LayoutInput = Pick<TextOverlay, 'text' | 'font' | 'size'> & Partial<Pick<TextOverlay, 'background'>>;

/** Breaks the text into lines no wider than 80% of the photo and sizes the box around them. */
export function layoutText({ text, font, size, background }: LayoutInput): TextLayout {
  const maxEm = MAX_LINE_WIDTH / size;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate, font) <= maxEm || line === '') {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      // A word longer than a line is broken where it runs out of room.
      while (measure(line, font) > maxEm && Array.from(line).length > 1) {
        const chars = Array.from(line);
        let fit = 1;
        while (fit < chars.length && measure(chars.slice(0, fit + 1).join(''), font) <= maxEm) fit += 1;
        lines.push(chars.slice(0, fit).join(''));
        line = chars.slice(fit).join('');
      }
    }
    lines.push(line);
  }
  const widest = Math.max(...lines.map((l) => measure(l, font)));
  const boxed = background !== undefined && background !== 'none';
  const padX = (boxed ? BACKGROUND_PAD_X : PAD_X) * size;
  const padY = (boxed ? BACKGROUND_PAD_Y : PAD_Y) * size;
  return {
    lines,
    width: widest * size + 2 * padX,
    height: lines.length * LINE_HEIGHT * size + 2 * padY,
    fontSize: size,
    lineHeight: LINE_HEIGHT * size,
    padX,
    padY,
  };
}

/** The overlay's width as a fraction of the photo's when it is not zoomed by a pinch. */
export function naturalScale(overlay: LayoutInput): number {
  return layoutText(overlay).width / TEXT_REF_WIDTH;
}

/** Height ÷ width of the text's box. */
export function textAspect(overlay: LayoutInput): number {
  const { width, height } = layoutText(overlay);
  return height / width;
}

/**
 * A new text overlay at its natural size, centred a little above the middle (design: Text). Each text
 * already on the photo moves the next one down a step, so a new one doesn't land on the last.
 */
export function newTextOverlay(id: string, text: string, style: TextStyle, existing = 0): TextOverlay {
  const content = { text, ...withoutUnset(style) };
  const y = 0.4 + NEW_TEXT_STEP * (existing % NEW_TEXT_PLACES);
  return { id, type: 'text', x: 0.5, y, rotation: 0, scale: clampScale(naturalScale(content)), ...content };
}

/** How far down, as a fraction of the photo, each text already on it moves the next one. */
const NEW_TEXT_STEP = 0.1;
const NEW_TEXT_PLACES = 4;

/** The style without fields left at "none", which are not saved. */
function withoutUnset<T extends Partial<TextStyle>>(style: T): T {
  const out = { ...style };
  if (out.background === 'none' || out.background === undefined) delete out.background;
  if (out.outline === undefined) delete out.outline;
  return out;
}

const patchKeys = ['text', 'font', 'color', 'size', 'align', 'background', 'outline'] as const;

/**
 * The overlay with its text or style changed. Its box follows the new text's natural size, keeping any
 * zoom from a pinch, so the letters stay the same size on the photo as words are added. Returns the
 * same object when nothing changes.
 */
export function applyTextChange(overlay: TextOverlay, patch: TextPatch): TextOverlay {
  const next = withoutUnset({ ...overlay, ...patch });
  if (patchKeys.every((key) => next[key] === overlay[key])) return overlay;
  const zoom = overlay.scale / naturalScale(overlay);
  return { ...next, scale: clampScale(naturalScale(next) * zoom) };
}

/** An id for a new overlay: unique enough within one moment's edits, and short. */
export function newOverlayId(): string {
  return `t${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
}
