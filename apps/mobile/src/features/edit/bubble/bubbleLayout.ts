// Bubble layout (FR-CAP-06): pure functions with no React Native imports, so the editor and the moment
// renderer (M2-18) agree on a bubble's shape from its data alone. A bubble is laid out at
// `bubble.referenceWidth` and scaled to its overlay box; its height (the overlay's aspect) follows from
// how many lines its text needs at that width.

import { bubble } from '@/theme/tokens';

import type { BubbleShape } from '../edits';

export function paddingXFor(shape: BubbleShape): number {
  return shape === 'thought' ? bubble.thoughtPaddingX : bubble.paddingX;
}

/** How many characters fit on one line of a bubble of this shape (an estimate that errs short). */
export function charsPerLine(shape: BubbleShape): number {
  const inner = bubble.referenceWidth - 2 * paddingXFor(shape);
  return Math.max(1, Math.floor(inner / (bubble.fontSize * bubble.charWidth)));
}

/**
 * Lines the text takes when wrapped greedily at word breaks, `perLine` characters a line; a word longer
 * than a line is broken across lines. Empty text still takes one line, so an empty bubble has a body.
 */
export function countLines(text: string, perLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    // Characters by code point, so an emoji counts once.
    let length = Array.from(word).length;
    const needed = used === 0 ? length : used + 1 + length;
    if (needed <= perLine) {
      used = needed;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    while (length > perLine) {
      lines += 1;
      length -= perLine;
    }
    used = length;
  }
  return lines;
}

export function bubbleLines(text: string, shape: BubbleShape): number {
  return countLines(text, charsPerLine(shape));
}

/** Height ÷ width of a bubble's overlay box. */
export function bubbleAspect({ text, shape }: { text: string; shape: BubbleShape }): number {
  const height = bubbleLines(text, shape) * bubble.lineHeight + 2 * bubble.paddingY;
  return height / bubble.referenceWidth;
}

/**
 * Text as typed or pasted, made fit for a bubble: line breaks become spaces and anything past the limit
 * is cut, never in the middle of an emoji's surrogate pair.
 */
export function clampBubbleText(text: string, max: number): string {
  const flat = text.replace(/[\r\n]+/g, ' ');
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}
