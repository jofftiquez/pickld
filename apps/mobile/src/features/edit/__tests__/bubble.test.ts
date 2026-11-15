import { bubbleColors } from '@/theme/tokens';

import {
  bubbleAspect,
  bubbleLines,
  bubbleTailGeometry,
  bubbleTailSide,
  charsPerLine,
  clampBubbleText,
  countLines,
  tailPathData,
} from '../bubble/bubbleLayout';
import { BUBBLE_TEXT_MAX, bubbleColorSchema, editsSchema, parseEdits, type Bubble, type Edits } from '../edits';

// Bubbles as data (FR-CAP-06, FR-CAP-08): what the Bubble tool stores reads back unchanged, the
// 60-character limit and the style lists are enforced by the schema, and bubbles saved before M2-16
// (transform only) still read.

const bubble: Bubble = {
  id: 'b1',
  type: 'bubble',
  x: 0.3,
  y: 0.2,
  scale: 0.6,
  rotation: -0.1,
  shape: 'shout',
  color: 'butter',
  text: 'Lunch break, finally!',
};
const sixty = 'a'.repeat(BUBBLE_TEXT_MAX);

describe('bubble schema', () => {
  it('round-trips a bubble through JSON unchanged', () => {
    const edits: Edits = { v: 1, filter: 'mono', overlays: [bubble] };
    const stored: unknown = JSON.parse(JSON.stringify(edits));
    expect(editsSchema.parse(stored)).toEqual(edits);
    expect(parseEdits(stored)).toEqual(edits);
  });

  it('reads a bubble saved before the Bubble tool (transform only) as an empty white speech bubble', () => {
    const old = { id: 'old', type: 'bubble', x: 0.5, y: 0.5, scale: 0.4, rotation: 0 };
    const expected = { ...old, shape: 'speech', color: 'white', text: '' };
    expect(parseEdits({ v: 1, filter: 'original', overlays: [old] }).overlays).toEqual([expected]);
    expect(editsSchema.parse({ v: 1, filter: 'original', overlays: [old] }).overlays).toEqual([expected]);
  });

  it('allows exactly 60 characters and refuses 61', () => {
    const at = { v: 1, filter: 'original', overlays: [{ ...bubble, text: sixty }] };
    const over = { v: 1, filter: 'original', overlays: [{ ...bubble, text: `${sixty}b` }] };
    expect(BUBBLE_TEXT_MAX).toBe(60);
    expect(editsSchema.safeParse(at).success).toBe(true);
    expect(editsSchema.safeParse(over).success).toBe(false);
    // Stored data over the limit is dropped, keeping the rest.
    expect(parseEdits({ ...over, overlays: [...over.overlays, { ...bubble, id: 'ok' }] }).overlays).toEqual([
      { ...bubble, id: 'ok' },
    ]);
  });

  it.each([
    ['an unknown shape', { shape: 'scream' }],
    ['an unknown color', { color: '#ff0000' }],
    ['text that is not a string', { text: 42 }],
  ])('drops a bubble with %s', (_name, patch) => {
    expect(parseEdits({ v: 1, filter: 'original', overlays: [{ ...bubble, ...patch }] }).overlays).toEqual([]);
  });
});

describe('bubble tail side', () => {
  const stored = (patch: Record<string, unknown>) =>
    parseEdits({ v: 1, filter: 'original', overlays: [{ ...bubble, ...patch }] }).overlays[0] as Bubble | undefined;

  it('reads a bubble saved before tails could flip unchanged, with no side, drawn on the left', () => {
    const old = stored({});
    expect(old).toEqual(bubble);
    expect(old && 'tail' in old).toBe(false); // nothing is added to old data
    expect(old && bubbleTailSide(old)).toBe('left');
  });

  it.each(['left', 'right'] as const)('keeps a saved tail on the %s through JSON', (tail) => {
    const edits: Edits = { v: 1, filter: 'original', overlays: [{ ...bubble, tail }] };
    const back = JSON.parse(JSON.stringify(edits)) as unknown;
    expect(editsSchema.parse(back)).toEqual(edits);
    expect(parseEdits(back).overlays[0]).toMatchObject({ tail });
    expect(bubbleTailSide({ tail })).toBe(tail);
  });

  it.each([['up'], [1], [null]])('drops a bubble whose tail is %j, keeping the others', (tail) => {
    const overlays = parseEdits({
      v: 1,
      filter: 'original',
      overlays: [
        { ...bubble, tail },
        { ...bubble, id: 'ok', tail: 'right' },
      ],
    }).overlays;
    expect(overlays.map((o) => o.id)).toEqual(['ok']);
  });
});

describe('bubble tail geometry', () => {
  // Reference units: the box is 200 wide. A one-line bubble is 22 + 2 × 10 = 42 tall.
  it('hangs a point 16 below the box on the left, its base sunk 2 into the body', () => {
    expect(bubbleTailGeometry('speech', 'left', 42)).toEqual({
      kind: 'point',
      points: [
        [16, 40],
        [6, 58],
        [40, 40],
      ],
      extent: 16,
    });
  });

  it('mirrors the point across the middle for the right', () => {
    expect(bubbleTailGeometry('speech', 'right', 42)).toEqual({
      kind: 'point',
      points: [
        [184, 40],
        [194, 58],
        [160, 40],
      ],
      extent: 16,
    });
  });

  it.each(['shout', 'whisper'] as const)('%s hangs the same point as speech', (shape) => {
    expect(bubbleTailGeometry(shape, 'right', 64)).toEqual(bubbleTailGeometry('speech', 'right', 64));
  });

  it('gives a thought two dots under its flat bottom', () => {
    // Pill radius 21 < 40, so the bottom under x = 40 is flat at 42: large dot centre 42 + 2 + 6 = 50,
    // small dot (40 − 14, 50 + 11) = (26, 61) with radius 3.5, reaching 64.5, 22.5 below the box.
    expect(bubbleTailGeometry('thought', 'left', 42)).toEqual({
      kind: 'dots',
      dots: [
        { cx: 40, cy: 50, r: 6 },
        { cx: 26, cy: 61, r: 3.5 },
      ],
      extent: 22.5,
    });
    const right = bubbleTailGeometry('thought', 'right', 42);
    expect(right.kind === 'dots' && right.dots.map((d) => d.cx)).toEqual([160, 174]);
  });

  it('keeps a tall thought’s dots 2 below its round end, where the pill curves up', () => {
    // Five lines: 5 × 22 + 20 = 130 tall, radius 65. Under x = 40: 65 + √(65² − 25²) = 65 + 60 = 125.
    const tall = bubbleTailGeometry('thought', 'left', 130);
    expect(tall.kind === 'dots' && tall.dots[0]).toEqual({ cx: 40, cy: 133, r: 6 });
  });

  it('writes a point as closed SVG path data', () => {
    expect(
      tailPathData([
        [16, 40],
        [6, 58],
        [40, 40],
      ]),
    ).toBe('M16 40 L6 58 L40 40 Z');
  });
});

describe('clampBubbleText', () => {
  it('keeps text within the limit as typed', () => {
    expect(clampBubbleText('Hi there', 60)).toBe('Hi there');
    expect(clampBubbleText(sixty, 60)).toBe(sixty);
  });

  it('cuts pasted text at the limit', () => {
    expect(clampBubbleText(`${sixty}overflow`, 60)).toBe(sixty);
  });

  it('turns line breaks into spaces', () => {
    expect(clampBubbleText('one\ntwo\r\nthree', 60)).toBe('one two three');
  });

  it('never splits an emoji at the limit', () => {
    const text = `${'a'.repeat(59)}😀`; // the emoji is two UTF-16 units: 61 in all
    const cut = clampBubbleText(text, 60);
    expect(cut).toBe('a'.repeat(59));
    expect(editsSchema.safeParse({ v: 1, filter: 'original', overlays: [{ ...bubble, text: cut }] }).success).toBe(
      true,
    );
  });
});

describe('bubble layout', () => {
  it('wraps at word breaks', () => {
    expect(countLines('', 10)).toBe(1);
    expect(countLines('   ', 10)).toBe(1);
    expect(countLines('abc def', 10)).toBe(1);
    expect(countLines('abcde fghij', 10)).toBe(2); // 11 with the space
    expect(countLines('abcd fghij', 10)).toBe(1); // exactly 10
    expect(countLines('a b c d e f g h i j k', 10)).toBe(3);
  });

  it('breaks a word longer than a line across lines', () => {
    expect(countLines('a'.repeat(25), 10)).toBe(3);
    expect(countLines(`hi ${'a'.repeat(20)}`, 10)).toBe(3);
    expect(countLines(`${'a'.repeat(15)} b`, 10)).toBe(2);
  });

  it('counts an emoji as one character', () => {
    expect(countLines('😀'.repeat(10), 10)).toBe(1);
  });

  it('gives the thought pill fewer characters a line than the other shapes', () => {
    expect(charsPerLine('thought')).toBeLessThan(charsPerLine('speech'));
    expect(charsPerLine('speech')).toBe(charsPerLine('shout'));
  });

  it('grows taller (larger aspect) as the text needs more lines, up to the 60-character limit', () => {
    const one = bubbleAspect({ text: 'Hi', shape: 'speech' });
    const full = bubbleAspect({ text: 'word '.repeat(12).trim(), shape: 'speech' });
    expect(bubbleAspect({ text: '', shape: 'speech' })).toBe(one);
    expect(full).toBeGreaterThan(one);
    expect(bubbleLines('word '.repeat(12).trim(), 'speech')).toBeGreaterThanOrEqual(4);
    // A full bubble stays wider than tall.
    expect(bubbleAspect({ text: sixty, shape: 'thought' })).toBeLessThan(1);
  });
});

// WCAG relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('bubble colors', () => {
  it('has the six designed colors, one per stored color id', () => {
    expect(Object.keys(bubbleColors)).toEqual(bubbleColorSchema.options);
    expect(Object.values(bubbleColors).map((c) => c.fill)).toEqual([
      '#ffffff',
      '#11140d',
      '#7fad33',
      '#ffe08a',
      '#fdeceb',
      '#dbe8f3',
    ]);
  });

  it.each(Object.entries(bubbleColors))('%s keeps its text at WCAG AA contrast (4.5:1)', (_id, { fill, text }) => {
    expect(contrast(fill, text)).toBeGreaterThanOrEqual(4.5);
  });
});
