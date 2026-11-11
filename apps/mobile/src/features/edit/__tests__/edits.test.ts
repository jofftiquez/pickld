import { DEFAULT_EDITS, editsSchema, overlaySchema, parseEdits, type Edits } from '../edits';
import { kape } from './stickerFixture';

// The `edits` JSON (FR-CAP-08): what the editor stores is what it reads back, and anything else stored
// (old rows, bad data, a newer app's extras) gives safe defaults instead of a crash.

const sticker = { id: 's1', type: 'sticker', ...kape, x: 0.25, y: 0.75, scale: 0.3, rotation: -0.4 } as const;
const text = {
  id: 't1',
  type: 'text',
  x: 0.5,
  y: 0.1,
  scale: 1.2,
  rotation: Math.PI,
  text: 'sinigang szn',
  font: 'serif',
  color: 'butter',
  size: 40,
  align: 'left',
} as const;

describe('edits schema', () => {
  it('round-trips through JSON (the queue column and moments.edits) unchanged', () => {
    const edits: Edits = { v: 1, filter: 'dusk', overlays: [sticker, text] };
    const stored: unknown = JSON.parse(JSON.stringify(edits));
    expect(editsSchema.parse(stored)).toEqual(edits);
    expect(parseEdits(stored)).toEqual(edits);
  });

  it('defaults to version 1, Original and no overlays', () => {
    expect(DEFAULT_EDITS).toEqual({ v: 1, filter: 'original', overlays: [] });
    expect(editsSchema.safeParse(DEFAULT_EDITS).success).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'mono'],
    ['a number', 3],
    ['an array', [{ filter: 'mono' }]],
    ['an empty object (rows queued before the editor)', {}],
  ])('reads %s as the defaults', (_name, raw) => {
    expect(parseEdits(raw)).toEqual(DEFAULT_EDITS);
  });

  it('keeps a good filter when the overlays are broken, and the reverse', () => {
    expect(parseEdits({ v: 1, filter: 'mono', overlays: 'nope' })).toEqual({ v: 1, filter: 'mono', overlays: [] });
    expect(parseEdits({ v: 1, filter: 'sepia', overlays: [sticker] })).toEqual({
      v: 1,
      filter: 'original',
      overlays: [sticker],
    });
    // The old placeholder shape from before the schema: unknown filter name.
    expect(parseEdits({ filter: 'warm' })).toEqual(DEFAULT_EDITS);
  });

  it('drops only the overlays that do not parse, keeping the rest in order', () => {
    const raw = {
      v: 1,
      filter: 'kalamansi',
      overlays: [
        sticker,
        { ...sticker, id: 'off-photo', x: 1.5 },
        { ...sticker, id: 'flat', scale: 0 },
        { ...sticker, id: 'spun', rotation: 100 },
        { ...sticker, id: 'nan', y: Number.NaN },
        { ...sticker, id: '' },
        { ...sticker, id: 'future', type: 'drawing' },
        { id: 'no-transform', type: 'bubble' },
        { ...sticker }, // same id twice: the first wins
        text,
      ],
    };
    expect(parseEdits(raw)).toEqual({ v: 1, filter: 'kalamansi', overlays: [sticker, text] });
  });

  it('the strict schema refuses what parseEdits repairs, so bad data is never written', () => {
    expect(editsSchema.safeParse({ filter: 'mono', overlays: [] }).success).toBe(false); // no version
    expect(editsSchema.safeParse({ v: 2, filter: 'mono', overlays: [] }).success).toBe(false);
    expect(editsSchema.safeParse({ v: 1, filter: 'beauty', overlays: [] }).success).toBe(false);
    expect(editsSchema.safeParse({ v: 1, filter: 'mono', overlays: [{ ...sticker, x: -0.1 }] }).success).toBe(false);
  });

  it('reads a newer version best-effort instead of throwing it away', () => {
    expect(parseEdits({ v: 2, filter: 'mono', overlays: [sticker], frames: ['x'] })).toEqual({
      v: 1,
      filter: 'mono',
      overlays: [sticker],
    });
  });
});

describe('sticker overlays (M2-15)', () => {
  const stamp = {
    id: 'st1',
    type: 'sticker',
    stickerId: '7c9e2d1a-0b3f-4e5d-8a6b-1c2d3e4f5a6b',
    asset: 'stickers/stamps/time.png',
    label: 'Time',
    stamp: 'time',
    x: 0.7,
    y: 0.2,
    scale: 0.4,
    rotation: 0.1,
  } as const;

  it('round-trip with the sticker id, art path, name and stamp kind', () => {
    const edits: Edits = { v: 1, filter: 'mono', overlays: [sticker, stamp] };
    const stored: unknown = JSON.parse(JSON.stringify(edits));
    expect(editsSchema.parse(stored)).toEqual(edits);
    expect(parseEdits(stored)).toEqual(edits);
  });

  it('still reads edits saved before stickers had content, keeping the filter and the other overlays', () => {
    // M2-13 development builds saved content-less placeholder stickers; they have nothing to draw.
    const old = {
      v: 1,
      filter: 'dusk',
      overlays: [{ id: 'p1', type: 'sticker', x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }, text],
    };
    expect(parseEdits(old)).toEqual({ v: 1, filter: 'dusk', overlays: [text] });
  });

  it.each([
    ['no sticker id', { stickerId: undefined }],
    ['a sticker id that is not a uuid', { stickerId: 'kape' }],
    ['art outside the sticker folder', { asset: 'moments/u1/photo.webp' }],
    ['a path that climbs out', { asset: 'stickers/../moments/x.png' }],
    ['an empty name', { label: '' }],
    ['an unknown stamp', { stamp: 'weather' }],
  ])('refuses a sticker with %s', (_name, change) => {
    expect(overlaySchema.safeParse({ ...stamp, ...change }).success).toBe(false);
  });
});
