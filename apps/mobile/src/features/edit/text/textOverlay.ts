import { z } from 'zod';

import { textOverlayColors } from '@/theme/tokens';

import type { Overlay } from '../edits';
import { clampScale } from '../overlays/transform';

// The text tool's data (FR-CAP-07): what a text overlay says and how it looks, stored in `edits` beside
// its transform. Pure functions with no React Native imports, so the moment renderer (M2-18) and the
// web page can lay text out the same way.

/** Longest text, in characters (UTF-16 units, as the text field counts them). */
export const TEXT_MAX = 80;

/** The size slider's range and starting point: font size in points on a photo 390 points wide. */
export const TEXT_SIZE = { min: 12, max: 64, default: 30 } as const;

/** Photo width the stored `size` is measured against (the design's 390-point screen). */
export const TEXT_REF_WIDTH = 390;

export const textFontSchema = z.enum(['clean', 'bold', 'type', 'serif']);
export type TextFont = z.infer<typeof textFontSchema>;

export const textColorSchema = z.enum(['white', 'ink', 'pickle', 'butter', 'blush', 'sky']);
export type TextColor = z.infer<typeof textColorSchema>;
/** Each color's token; typed so every color has one. */
export const textColorValues: Record<TextColor, string> = textOverlayColors;

export const textAlignSchema = z.enum(['left', 'center']);
export type TextAlign = z.infer<typeof textAlignSchema>;

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
};

export type TextOverlay = Extract<Overlay, { type: 'text' }>;
export type TextStyle = Pick<TextOverlay, 'font' | 'color' | 'size' | 'align'>;
export type TextPatch = Partial<Pick<TextOverlay, 'text'> & TextStyle>;

/** The panel's settings before anything is changed (design: Text). */
export const DEFAULT_TEXT_STYLE: TextStyle = { font: 'bold', color: 'white', size: TEXT_SIZE.default, align: 'center' };

// Layout, in points on the reference photo. Text can't be measured synchronously in React Native, so the
// box is estimated from average glyph widths (a little generous, so the real glyphs fit) and the lines
// are broken here, not by the text engine, so every display size shows the same lines.
const LINE_HEIGHT = 1.25;
const PAD_X = 0.3;
const PAD_Y = 0.15;
const MAX_LINE_WIDTH = 0.8 * TEXT_REF_WIDTH;
const GLYPH: Record<TextFont, number> = { clean: 0.6, bold: 0.64, type: 0.62, serif: 0.54 };

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

/** Breaks the text into lines no wider than 80% of the photo and sizes the box around them. */
export function layoutText({ text, font, size }: Pick<TextOverlay, 'text' | 'font' | 'size'>): TextLayout {
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
  const padX = PAD_X * size;
  const padY = PAD_Y * size;
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
export function naturalScale(overlay: Pick<TextOverlay, 'text' | 'font' | 'size'>): number {
  return layoutText(overlay).width / TEXT_REF_WIDTH;
}

/** Height ÷ width of the text's box. */
export function textAspect(overlay: Pick<TextOverlay, 'text' | 'font' | 'size'>): number {
  const { width, height } = layoutText(overlay);
  return height / width;
}

/** A new text overlay at its natural size, centred a little above the middle (design: Text). */
export function newTextOverlay(id: string, text: string, style: TextStyle): TextOverlay {
  const content = { text, ...style };
  return { id, type: 'text', x: 0.5, y: 0.4, rotation: 0, scale: clampScale(naturalScale(content)), ...content };
}

const patchKeys = ['text', 'font', 'color', 'size', 'align'] as const;

/**
 * The overlay with its text or style changed. Its box follows the new text's natural size, keeping any
 * zoom from a pinch, so the letters stay the same size on the photo as words are added. Returns the
 * same object when nothing changes.
 */
export function applyTextChange(overlay: TextOverlay, patch: TextPatch): TextOverlay {
  const next = { ...overlay, ...patch };
  if (patchKeys.every((key) => next[key] === overlay[key])) return overlay;
  const zoom = overlay.scale / naturalScale(overlay);
  return { ...next, scale: clampScale(naturalScale(next) * zoom) };
}

/** An id for a new overlay: unique enough within one moment's edits, and short. */
export function newOverlayId(): string {
  return `t${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
}
