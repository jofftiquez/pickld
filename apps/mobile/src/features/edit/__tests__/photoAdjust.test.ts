import type { Transform } from '../overlays/transform';
import { flipped, moveWithPhoto, NO_ADJUST, rotatedClockwise, type PhotoAdjust } from '../photoAdjust';

// The editor's Rotate and Flip (FR-CAP-04): the adjust the preparation pipeline applies, and where overlays go.

type Grid = string[][];
// The pipeline's own steps on a tiny picture: a quarter turn clockwise, and a left-right mirror.
const turnClockwise = (g: Grid): Grid => g[0]!.map((_, x) => g.map((row) => row[x]!).reverse());
const mirror = (g: Grid): Grid => g.map((row) => [...row].reverse());
const pipeline = (g: Grid, a: PhotoAdjust): Grid => {
  let out = g;
  for (let r = 0; r < a.rotate; r += 90) out = turnClockwise(out);
  return a.flip ? mirror(out) : out;
};
const picture: Grid = [
  ['a', 'b', 'c'],
  ['d', 'e', 'f'],
];

describe('photo adjust', () => {
  it('matches what the user sees after any run of Rotate and Flip taps', () => {
    const taps = ['rotate', 'flip', 'rotate', 'rotate', 'flip', 'rotate', 'flip', 'rotate'] as const;
    let adjust = NO_ADJUST;
    let seen = picture;
    for (const tap of taps) {
      adjust = tap === 'rotate' ? rotatedClockwise(adjust) : flipped(adjust);
      seen = tap === 'rotate' ? turnClockwise(seen) : mirror(seen);
      expect(pipeline(picture, adjust)).toEqual(seen);
    }
  });

  it('comes back to the opened photo after four turns or two flips', () => {
    const four = [1, 2, 3, 4].reduce((a) => rotatedClockwise(a), NO_ADJUST);
    expect(four).toEqual(NO_ADJUST);
    expect(flipped(flipped({ rotate: 90, flip: false }))).toEqual({ rotate: 90, flip: false });
  });

  const sticker: Transform = { x: 0.2, y: 0.3, scale: 0.25, rotation: 0.4 };

  it('Flip mirrors an overlay’s place and tilt and keeps its size', () => {
    const moved = moveWithPhoto(sticker, NO_ADJUST, { rotate: 0, flip: true });
    expect(moved.x).toBeCloseTo(0.8);
    expect(moved.y).toBeCloseTo(0.3);
    expect(moved.scale).toBe(0.25);
    expect(moved.rotation).toBeCloseTo(-0.4);
  });

  it('Rotate keeps an overlay on the same spot of the turned, centre-cropped photo, level', () => {
    // 240 px above the middle of the 1440 × 1920 photo; turned clockwise it is 240 px right of the middle of
    // the 1920 × 1440 photo, whose middle 1080 × 1440 is scaled by 4/3 back to 1440 × 1920: 320 px right.
    const above = { ...sticker, x: 0.5, y: 0.375 };
    const moved = moveWithPhoto(above, NO_ADJUST, { rotate: 90, flip: false });
    expect(moved.x).toBeCloseTo(0.5 + 320 / 1440);
    expect(moved.y).toBeCloseTo(0.5);
    expect(moved.scale).toBe(0.25);
    expect(moved.rotation).toBeCloseTo(0.4);
  });

  it('two quarter turns put an overlay where a half turn does, with no crop', () => {
    const near = { ...sticker, x: 0.45, y: 0.48 };
    const half = moveWithPhoto(near, NO_ADJUST, { rotate: 180, flip: false });
    expect(half.x).toBeCloseTo(0.55);
    expect(half.y).toBeCloseTo(0.52);
    const quarter = moveWithPhoto(near, NO_ADJUST, { rotate: 90, flip: false });
    const twice = moveWithPhoto(quarter, { rotate: 90, flip: false }, { rotate: 180, flip: false });
    expect(twice.x).toBeCloseTo(half.x);
    expect(twice.y).toBeCloseTo(half.y);
  });

  it('keeps an overlay on the photo when a turn crops its spot away', () => {
    const top = { ...sticker, x: 0.5, y: 0.05 };
    const moved = moveWithPhoto(top, NO_ADJUST, { rotate: 90, flip: false });
    expect(moved.x).toBe(1);
    expect(moved.y).toBeCloseTo(0.5);
  });
});
