import { kape } from './stickerFixture';
import { editsSchema, overlaySchema, parseEdits, type Edits } from '../edits';
import { MAX_SCALE } from '../overlays/transform';
import { textOverlayColors } from '@/theme/tokens';

import {
  applyTextChange,
  contrastColor,
  DEFAULT_TEXT_STYLE,
  layoutText,
  naturalScale,
  newTextOverlay,
  TEXT_MAX,
  TEXT_PALETTE,
  TEXT_REF_WIDTH,
  textAspect,
  type TextOverlay,
} from '../text/textOverlay';

// The text tool's data (FR-CAP-07, FR-CAP-08): text and style stored in `edits`, the 80-character limit,
// and the layout every display size shares.

const base = { id: 't1', type: 'text', x: 0.5, y: 0.4, scale: 0.5, rotation: 0.3 } as const;
const overlay: TextOverlay = { ...base, text: 'sinigang szn', font: 'serif', color: 'sky', size: 40, align: 'left' };

describe('text overlay schema', () => {
  it('round-trips text and every style field through stored JSON unchanged', () => {
    const edits: Edits = { v: 1, filter: 'mono', overlays: [overlay] };
    const stored: unknown = JSON.parse(JSON.stringify(edits));
    expect(editsSchema.parse(stored)).toEqual(edits);
    expect(parseEdits(stored)).toEqual(edits);
  });

  it('round-trips a background and an outline, and leaves them out of texts saved without them', () => {
    const styled: TextOverlay = { ...overlay, font: 'marker', color: 'red', background: 'soft', outline: 'white' };
    const edits: Edits = { v: 1, filter: 'mono', overlays: [styled] };
    expect(editsSchema.parse(JSON.parse(JSON.stringify(edits)))).toEqual(edits);
    expect(editsSchema.parse({ v: 1, filter: 'mono', overlays: [overlay] }).overlays[0]).not.toHaveProperty(
      'background',
    );
    expect(overlaySchema.safeParse({ ...overlay, background: 'glow' }).success).toBe(false);
    expect(overlaySchema.safeParse({ ...overlay, font: 'comic' }).success).toBe(false);
  });

  it('still reads the colors the panel no longer offers, and offers twelve', () => {
    expect(TEXT_PALETTE).toHaveLength(12);
    expect(TEXT_PALETTE).not.toContain('butter');
    expect(TEXT_PALETTE).not.toContain('blush');
    for (const color of ['butter', 'blush', 'sky'] as const) {
      expect(overlaySchema.safeParse({ ...overlay, color }).success).toBe(true);
    }
    expect(Object.keys(textOverlayColors).sort()).toEqual([...TEXT_PALETTE, 'butter', 'blush'].sort());
  });

  it('accepts exactly 80 characters and refuses 81', () => {
    expect(overlaySchema.safeParse({ ...overlay, text: 'a'.repeat(TEXT_MAX) }).success).toBe(true);
    expect(overlaySchema.safeParse({ ...overlay, text: 'a'.repeat(TEXT_MAX + 1) }).success).toBe(false);
    expect(TEXT_MAX).toBe(80);
  });

  it.each([
    ['no text', { ...base }],
    ['empty text', { ...overlay, text: '' }],
    ['blank text', { ...overlay, text: '   ' }],
    ['an unknown font', { ...overlay, font: 'comic' }],
    ['an unknown color', { ...overlay, color: '#ff0000' }],
    ['right alignment', { ...overlay, align: 'right' }],
    ['a size below the slider', { ...overlay, size: 11 }],
    ['a size above the slider', { ...overlay, size: 65 }],
    ['a fractional size', { ...overlay, size: 30.5 }],
  ])('refuses %s', (_name, value) => {
    expect(overlaySchema.safeParse(value).success).toBe(false);
  });

  it('fills missing style fields with the tool defaults (Bold, white, 30, center)', () => {
    expect(overlaySchema.parse({ ...base, text: 'hi' })).toEqual({ ...base, text: 'hi', ...DEFAULT_TEXT_STYLE });
    expect(DEFAULT_TEXT_STYLE).toEqual({ font: 'bold', color: 'white', size: 30, align: 'center' });
  });

  it('reading stored edits drops a text overlay over the limit and keeps the others', () => {
    const sticker = { id: 's1', type: 'sticker', ...kape, x: 0.2, y: 0.2, scale: 0.3, rotation: 0 } as const;
    const raw = {
      v: 1,
      filter: 'original',
      overlays: [sticker, { ...overlay, id: 'long', text: 'x'.repeat(81) }, overlay],
    };
    expect(parseEdits(raw).overlays).toEqual([sticker, overlay]);
  });

  it('old edits without any text overlays still read as before', () => {
    const old = {
      v: 1,
      filter: 'dusk',
      overlays: [{ id: 's1', type: 'sticker', ...kape, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }],
    };
    expect(parseEdits(old)).toEqual(old);
  });
});

describe('layoutText', () => {
  it('keeps short text on one line and sizes the box from the font size', () => {
    const small = layoutText({ text: 'hi', font: 'bold', size: 20 });
    const big = layoutText({ text: 'hi', font: 'bold', size: 40 });
    expect(small.lines).toEqual(['hi']);
    expect(big.width).toBeCloseTo(2 * small.width, 6);
    expect(big.height).toBeCloseTo(2 * small.height, 6);
    expect(big.lineHeight).toBe(50);
  });

  it('breaks long text between words into lines no wider than 80% of the photo', () => {
    const text = 'we finally found the best sinigang in the whole city tonight';
    const layout = layoutText({ text, font: 'bold', size: 40 });
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(' ')).toBe(text);
    expect(layout.width - 2 * layout.padX).toBeLessThanOrEqual(0.8 * TEXT_REF_WIDTH);
    expect(layout.height).toBeCloseTo(layout.lines.length * layout.lineHeight + 2 * layout.padY, 6);
  });

  it('breaks a word longer than a line where it runs out of room, losing no characters', () => {
    const word = 'a'.repeat(TEXT_MAX);
    const layout = layoutText({ text: word, font: 'type', size: 64 });
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join('')).toBe(word);
    expect(layout.width - 2 * layout.padX).toBeLessThanOrEqual(0.8 * TEXT_REF_WIDTH);
  });

  it('starts a new line at each Return, even in short text', () => {
    expect(layoutText({ ...overlay, text: 'sinigang\nszn' }).lines).toEqual(['sinigang', 'szn']);
    expect(layoutText({ ...overlay, text: 'a\n\nb' }).lines).toEqual(['a', '', 'b']);
  });

  it('gives a text on a background more room round the words', () => {
    const plain = layoutText(overlay);
    const boxed = layoutText({ ...overlay, background: 'solid' });
    expect(boxed.lines).toEqual(plain.lines);
    expect(boxed.width).toBeGreaterThan(plain.width);
    expect(boxed.height).toBeGreaterThan(plain.height);
    expect(layoutText({ ...overlay, background: 'none' })).toEqual(plain);
  });

  it('measures Type (monospace) wider than Serif for the same words', () => {
    const type = layoutText({ text: 'sinigang', font: 'type', size: 30 });
    const serif = layoutText({ text: 'sinigang', font: 'serif', size: 30 });
    expect(type.width).toBeGreaterThan(serif.width);
  });

  it('gives the aspect of its box', () => {
    const layout = layoutText(overlay);
    expect(textAspect(overlay)).toBeCloseTo(layout.height / layout.width, 10);
  });
});

describe('newTextOverlay and applyTextChange', () => {
  it('a new overlay is the text with the chosen style at its natural size, a little above the middle', () => {
    const created = newTextOverlay('n1', 'sinigang szn', { font: 'clean', color: 'pickle', size: 24, align: 'left' });
    expect(created).toMatchObject({ id: 'n1', type: 'text', x: 0.5, y: 0.4, rotation: 0, text: 'sinigang szn' });
    expect(created).toMatchObject({ font: 'clean', color: 'pickle', size: 24, align: 'left' });
    expect(created.scale).toBeCloseTo(naturalScale(created), 10);
    expect(overlaySchema.safeParse(created).success).toBe(true);
  });

  it('each text already on the photo moves the next one down, cycling after four', () => {
    const at = (n: number) => newTextOverlay('n', 'hi', DEFAULT_TEXT_STYLE, n).y;
    expect([0, 1, 2, 3, 4].map(at).map((y) => Math.round(y * 10) / 10)).toEqual([0.4, 0.5, 0.6, 0.7, 0.4]);
  });

  it('saves a background or outline only when set, and taking either off removes the field', () => {
    expect(newTextOverlay('n', 'hi', { ...DEFAULT_TEXT_STYLE, background: 'none' })).not.toHaveProperty('background');
    const outlined = applyTextChange(overlay, { outline: 'ink', background: 'solid' });
    expect(outlined).toMatchObject({ outline: 'ink', background: 'solid' });
    expect(outlined.scale).toBeGreaterThan(overlay.scale); // the background's room
    const plain = applyTextChange(outlined, { outline: undefined, background: 'none' });
    expect(plain).not.toHaveProperty('outline');
    expect(plain).not.toHaveProperty('background');
    expect(plain.scale).toBeCloseTo(overlay.scale, 10);
  });

  it('picks whichever of white and black has the higher contrast ratio on the color', () => {
    expect(contrastColor('white')).toBe('ink');
    expect(contrastColor('yellow')).toBe('ink');
    expect(contrastColor('ink')).toBe('white');
    expect(contrastColor('purple')).toBe('white');
    // Blue is mid-bright: black is 6:1 on it, white only 3:1.
    expect(contrastColor('blue')).toBe('ink');
  });

  it('returns the same overlay when nothing changes', () => {
    expect(applyTextChange(overlay, {})).toBe(overlay);
    expect(applyTextChange(overlay, { font: 'serif', size: 40 })).toBe(overlay);
  });

  it('a bigger size or longer text grows the box, keeping a pinch zoom and the transform', () => {
    const zoom = overlay.scale / naturalScale(overlay);
    const bigger = applyTextChange(overlay, { size: 50 });
    expect(bigger.size).toBe(50);
    expect(bigger.scale / naturalScale(bigger)).toBeCloseTo(zoom, 10);
    expect(bigger.scale).toBeGreaterThan(overlay.scale);
    expect(bigger).toMatchObject({ x: overlay.x, y: overlay.y, rotation: overlay.rotation, id: overlay.id });

    const longer = applyTextChange(overlay, { text: 'sinigang szn at lola’s' });
    expect(longer.scale).toBeGreaterThan(overlay.scale);
  });

  it('color and alignment change only those fields', () => {
    expect(applyTextChange(overlay, { color: 'ink', align: 'center' })).toEqual({
      ...overlay,
      color: 'ink',
      align: 'center',
      scale: expect.closeTo(overlay.scale, 10),
    });
  });

  it('never grows the box past the largest overlay size', () => {
    const huge = { ...overlay, scale: MAX_SCALE };
    expect(applyTextChange(huge, { size: 64 }).scale).toBeLessThanOrEqual(MAX_SCALE);
  });
});
