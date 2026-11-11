import { bubbleColors } from '@/theme/tokens';

import { bubbleAspect, bubbleLines, charsPerLine, clampBubbleText, countLines } from '../bubble/bubbleLayout';
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
