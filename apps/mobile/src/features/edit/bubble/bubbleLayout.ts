// Bubble layout (FR-CAP-06): pure functions with no React Native imports, so the editor and the moment
// renderer (M2-18) agree on a bubble's shape from its data alone. A bubble is laid out at
// `bubble.referenceWidth` and scaled to its overlay box; its height (the overlay's aspect) follows from
// how many lines its text needs at that width.

import { bubble } from '@/theme/tokens';

import { DEFAULT_BUBBLE_TAIL, type BubbleShape, type BubbleTail } from '../edits';

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

/** The side a bubble's tail is drawn on: its saved side, else the left (bubbles saved before it could flip). */
export function bubbleTailSide(o: { tail?: BubbleTail }): BubbleTail {
  return o.tail ?? DEFAULT_BUBBLE_TAIL;
}

export type TailPoint = readonly [x: number, y: number];
export type TailDot = { readonly cx: number; readonly cy: number; readonly r: number };

/**
 * A bubble's tail in reference units (the box is `bubble.referenceWidth` wide and `height` tall, origin at
 * its top left). Speech, Shout and Whisper get a point: base start, tip, base end, the base sunk
 * `tailOverlap` into the body. Thought gets two dots under its pill. `extent` is how far below the box
 * the tail reaches. The right side mirrors the left across the box's middle.
 */
export type TailGeometry =
  | { kind: 'point'; points: readonly [TailPoint, TailPoint, TailPoint]; extent: number }
  | { kind: 'dots'; dots: readonly [TailDot, TailDot]; extent: number };

export function bubbleTailGeometry(shape: BubbleShape, side: BubbleTail, height: number): TailGeometry {
  const x = (at: number) => (side === 'left' ? at : bubble.referenceWidth - at);
  if (shape !== 'thought') {
    const base = height - bubble.tailOverlap;
    return {
      kind: 'point',
      points: [
        [x(bubble.tailStart), base],
        [x(bubble.tailTipX), height + bubble.tailLength],
        [x(bubble.tailEnd), base],
      ],
      extent: bubble.tailLength,
    };
  }
  // The pill's bottom edge under the large dot: on its round end it curves up from the box's bottom.
  const r = height / 2;
  const dx = Math.max(0, r - bubble.thoughtDotX);
  const edge = r + Math.sqrt(Math.max(0, r * r - dx * dx));
  const large = {
    cx: x(bubble.thoughtDotX),
    cy: edge + bubble.thoughtDotGap + bubble.thoughtDotR,
    r: bubble.thoughtDotR,
  };
  const small = {
    cx: x(bubble.thoughtDotX + bubble.thoughtDotStepX),
    cy: large.cy + bubble.thoughtDotStepY,
    r: bubble.thoughtDotSmallR,
  };
  return { kind: 'dots', dots: [large, small], extent: small.cy + small.r - height };
}

/** SVG path data for a pointed tail (`M … L … L … Z`). */
export function tailPathData(points: readonly TailPoint[]): string {
  return `${points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ')} Z`;
}
