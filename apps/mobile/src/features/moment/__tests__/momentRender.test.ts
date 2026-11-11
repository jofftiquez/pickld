import i18n from '@/i18n';
import { DEFAULT_EDITS, type Edits, type Overlay } from '@/features/edit/edits';

import { coverBox, hasVisibleEdits, momentLabel } from '../momentRender';

// The moment renderer's pure parts (M2-18): the one spoken label, whether edits change the photo, and
// the cover crop for frames that aren't 3:4.

const t = i18n.t.bind(i18n);
const at = { x: 0.5, y: 0.5, scale: 0.4, rotation: 0 };
const sticker = (id: string): Overlay => ({
  id,
  type: 'sticker',
  stickerId: '4fec3a86-8a82-4601-fe12-fdbf36bead43',
  asset: 'stickers/everyday/kape-muna.png',
  label: 'Kape muna',
  ...at,
});
const bubble = (id: string): Overlay => ({
  id,
  type: 'bubble',
  shape: 'speech',
  color: 'white',
  text: 'secret words',
  ...at,
});
const text = (id: string): Overlay => ({
  id,
  type: 'text',
  text: 'private note',
  font: 'bold',
  color: 'white',
  size: 30,
  align: 'center',
  ...at,
});
const withOverlays = (...overlays: Overlay[]): Edits => ({ ...DEFAULT_EDITS, overlays });

describe('momentLabel', () => {
  it.each([
    [[], 'Photo'],
    [[sticker('a')], 'Photo with a sticker'],
    [[sticker('a'), sticker('b')], 'Photo with 2 stickers'],
    [[sticker('a'), sticker('b'), text('c')], 'Photo with 2 stickers and text'],
    [[bubble('a'), text('b'), text('c')], 'Photo with a speech bubble and 2 texts'],
    [[text('c'), bubble('b'), sticker('a')], 'Photo with a sticker, a speech bubble and text'],
    [[bubble('a'), bubble('b'), bubble('c')], 'Photo with 3 speech bubbles'],
  ])('%j → %s', (overlays, label) => {
    expect(momentLabel(withOverlays(...overlays), t)).toBe(label);
  });

  it('never speaks what a bubble or text says, nor a sticker’s own name', () => {
    expect(momentLabel(withOverlays(sticker('a'), bubble('b'), text('c')), t)).not.toMatch(/secret|private|Kape/);
  });

  it('a filter alone is still just "Photo"', () => {
    expect(momentLabel({ ...DEFAULT_EDITS, filter: 'mono' }, t)).toBe('Photo');
  });
});

describe('hasVisibleEdits', () => {
  it('is false for the plain photo and true for a filter or any overlay', () => {
    expect(hasVisibleEdits(DEFAULT_EDITS)).toBe(false);
    expect(hasVisibleEdits({ ...DEFAULT_EDITS, filter: 'kalamansi' })).toBe(true);
    expect(hasVisibleEdits(withOverlays(text('a')))).toBe(true);
  });
});

describe('coverBox', () => {
  it('a wide Today tile shows the middle band of the 3:4 picture at the tile’s width', () => {
    const box = coverBox({ width: 171, height: 116 });
    expect(box.width).toBe(171);
    expect(box.left).toBe(0);
    expect(box.top).toBeCloseTo((116 - 228) / 2, 9);
  });

  it('a tall frame shows the middle of the picture at the frame’s height', () => {
    const box = coverBox({ width: 100, height: 200 });
    expect(box.width).toBe(150);
    expect(box.left).toBe(-25);
    expect(box.top).toBeCloseTo(0, 9);
  });

  it('a 3:4 frame is filled exactly', () => {
    expect(coverBox({ width: 390, height: 520 })).toEqual({ width: 390, left: 0, top: 0 });
  });
});
