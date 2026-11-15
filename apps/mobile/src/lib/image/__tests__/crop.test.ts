import {
  clampFitLayout,
  cropRect34,
  cropRectRatio,
  cropSpecSchema,
  DEFAULT_FIT_LAYOUT,
  fitLayoutOf,
  fitPixels,
  fitPlacement,
  fitRect34,
  FULL_SIZE,
  MEDIUM_SIZE,
  THUMB_SIZE,
} from '../crop';

describe('fitRect34 (Fit, D-152)', () => {
  it('a 16:9 landscape gets the full width, centred, with equal bars top and bottom', () => {
    // 3840 × 2160 at 1440 / 3840 = 0.375: 1440 × 810; (1920 − 810) ÷ 2 = 555 above and below.
    expect(fitRect34({ width: 3840, height: 2160 })).toEqual({ originX: 0, originY: 555, width: 1440, height: 810 });
  });

  it('a very tall 9:21 gets the full height, with equal bars left and right', () => {
    // 900 × 2100 at 1920 / 2100: 822.86 × 1920; the bars round to 309 each, so the photo is 822 wide.
    expect(fitRect34({ width: 900, height: 2100 })).toEqual({ originX: 309, originY: 0, width: 822, height: 1920 });
  });

  it('a 3:4 photo fills the frame: no bars', () => {
    expect(fitRect34({ width: 3024, height: 4032 })).toEqual({ originX: 0, originY: 0, ...FULL_SIZE });
  });

  it('the same framing at every output size: full, medium and thumbnail', () => {
    const source = { width: 3840, height: 2160 };
    expect(fitRect34(source, FULL_SIZE)).toEqual({ originX: 0, originY: 555, width: 1440, height: 810 });
    // Medium is made from full (1440 → 1080, × 0.75): bars of 416.25 resampled; worked here at its own size.
    expect(fitRect34(source, MEDIUM_SIZE)).toEqual({ originX: 0, originY: 416, width: 1080, height: 608 });
    expect(fitRect34(source, THUMB_SIZE)).toEqual({ originX: 0, originY: 185, width: 480, height: 270 });
  });

  it('refuses an image with no pixels', () => {
    expect(() => fitRect34({ width: 0, height: 10 })).toThrow(RangeError);
  });
});

// D-154: a 3840 × 2160 (16:9) photo laid out in the 3:4 frame. Every expected value is worked by hand in the
// comments; the thumbnail's numbers are the full photo's divided by 3, so both show the same picture.
describe('Fit layout: placement, border and corners (D-154)', () => {
  const source = { width: 3840, height: 2160 };
  const none = { ...DEFAULT_FIT_LAYOUT };

  it('defaults: whole, centred, as large as it fits, no border, square corners', () => {
    expect(fitPixels(source, FULL_SIZE, none)).toEqual({
      box: { originX: 0, originY: 555, width: 1440, height: 810 },
      photo: { originX: 0, originY: 555, width: 1440, height: 810 },
      border: 0,
      radius: 0,
    });
  });

  it('smaller and moved toward the bottom right, with a medium black border and small corners (full)', () => {
    // Border 12/480 × 1440 = 36. Room 1368 × 1848; fits min(1368/3840, 1848/2160) = 0.35625, × 0.6 = 0.21375:
    // photo 820.8 × 461.7, box 892.8 × 533.7. Free 547.2 × 1386.3; left 273.6 + 0.1 × 1440 = 417.6, top
    // 693.15 + 0.2 × 1920 = 1077.15. Corners 12/480 × 1440 = 36 on the photo, 36 + 36 = 72 outside.
    const layout = { ...none, scale: 0.6, x: 0.1, y: 0.2, border: 'medium', corners: 'small' } as const;
    const place = fitPlacement(source, FULL_SIZE, layout);
    expect(place.border).toBeCloseTo(36, 9);
    expect(place.radius).toBeCloseTo(72, 9);
    expect(place.box.x).toBeCloseTo(417.6, 9);
    expect(place.box.y).toBeCloseTo(1077.15, 9);
    expect(place.photo.width).toBeCloseTo(820.8, 9);
    expect(place.photo.height).toBeCloseTo(461.7, 9);
    // Whole pixels, each edge rounded: left 418, right round(1310.4) = 1310, top 1077, bottom round(1610.85) = 1611.
    expect(fitPixels(source, FULL_SIZE, layout)).toEqual({
      box: { originX: 418, originY: 1077, width: 892, height: 534 },
      photo: { originX: 454, originY: 1113, width: 820, height: 462 },
      border: 36,
      radius: 72,
    });
  });

  it('the same layout on the 480 × 640 thumbnail: a third of everything', () => {
    // Border 12; photo 273.6 × 153.9; box at (139.2, 359.05), 297.6 × 177.9; corners 12 + 12 = 24.
    const layout = { ...none, scale: 0.6, x: 0.1, y: 0.2, border: 'medium', corners: 'small' } as const;
    const full = fitPlacement(source, FULL_SIZE, layout);
    const thumb = fitPlacement(source, THUMB_SIZE, layout);
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(thumb.box[key]).toBeCloseTo(full.box[key] / 3, 9);
      expect(thumb.photo[key]).toBeCloseTo(full.photo[key] / 3, 9);
    }
    expect(fitPixels(source, THUMB_SIZE, layout)).toEqual({
      box: { originX: 139, originY: 359, width: 298, height: 178 },
      photo: { originX: 151, originY: 371, width: 274, height: 154 },
      border: 12,
      radius: 24,
    });
  });

  it('moved past the top-left corner: the box stops at the frame edge, never cropped', () => {
    // Thin border 18; photo half of 0.365625 → 702 × 394.875, box 738 × 430.875; asked for (−0.5, −0.5) → (0, 0).
    const layout = { ...none, scale: 0.5, x: -0.5, y: -0.5, border: 'thin', corners: 'medium' } as const;
    expect(fitPixels(source, FULL_SIZE, layout)).toEqual({
      box: { originX: 0, originY: 0, width: 738, height: 431 },
      photo: { originX: 18, originY: 18, width: 702, height: 395 },
      border: 18,
      radius: 108, // 90 on the photo + 18
    });
    // Thumbnail: border 6, photo 234 × 131.625, corners 30 + 6.
    expect(fitPixels(source, THUMB_SIZE, layout)).toEqual({
      box: { originX: 0, originY: 0, width: 246, height: 144 },
      photo: { originX: 6, originY: 6, width: 234, height: 132 },
      border: 6,
      radius: 36,
    });
  });

  it('each border width and corner radius in output pixels at both sizes', () => {
    const at = (border: 'thin' | 'medium' | 'thick', corners: 'small' | 'medium' | 'large') => [
      fitPixels(source, FULL_SIZE, { ...none, border, corners }),
      fitPixels(source, THUMB_SIZE, { ...none, border, corners }),
    ];
    // Borders 6, 12, 24 / 480 of the width; photo corners 12, 30, 60 / 480 plus the border outside.
    expect(at('thin', 'small').map((p) => [p.border, p.radius])).toEqual([
      [18, 54],
      [6, 18],
    ]);
    expect(at('medium', 'medium').map((p) => [p.border, p.radius])).toEqual([
      [36, 126],
      [12, 42],
    ]);
    expect(at('thick', 'large').map((p) => [p.border, p.radius])).toEqual([
      [72, 252],
      [24, 84],
    ]);
  });

  it('a radius never passes half the box: large corners on a small photo make round ends', () => {
    // Thick 72; room 1296 wide; 0.3375 × 0.3 = 0.10125 → photo 388.8 × 218.7, box 532.8 × 362.7; 252 → 181.35.
    const place = fitPlacement(source, FULL_SIZE, { ...none, scale: 0.3, border: 'thick', corners: 'large' });
    expect(place.radius).toBeCloseTo(181.35, 9);
  });

  it('clampFitLayout keeps the size in range and the box whole inside the frame', () => {
    // Box 738 × 430.875 at half size with a thin border: it may move (1440 − 738) / 2 / 1440 = 0.24375 across
    // and (1920 − 430.875) / 2 / 1920 = 0.3877930… down.
    const moved = clampFitLayout(source, { ...none, scale: 0.5, x: -0.9, y: 0.9, border: 'thin' });
    expect(moved.x).toBeCloseTo(-0.24375, 9);
    expect(moved.y).toBeCloseTo(744.5625 / 1920, 9);
    // At full size the 16:9 photo spans the width: it can only move up and down (555 / 1920).
    const full = clampFitLayout(source, { ...none, x: 0.3, y: -0.4 });
    expect(full.x).toBe(0);
    expect(full.y).toBeCloseTo(-555 / 1920, 9);
    expect(clampFitLayout(source, { ...none, scale: 0.1 }).scale).toBe(0.3);
    expect(clampFitLayout(source, { ...none, scale: 2 }).scale).toBe(1);
    expect(clampFitLayout(source, { ...none, x: Number.NaN }).x).toBe(0);
    // The same shares on the screen's frame (here 300 × 400 points).
    const screen = clampFitLayout(
      source,
      { ...none, scale: 0.5, x: -0.9, y: 0.9, border: 'thin' },
      { width: 300, height: 400 },
    );
    expect(screen.x).toBeCloseTo(moved.x, 9);
    expect(screen.y).toBeCloseTo(moved.y, 9);
  });

  it('rows queued before D-154 (only a frame) read as whole, centred, no border, square corners', () => {
    expect(fitLayoutOf({ frame: 'cream' })).toEqual({ frame: 'cream', ...DEFAULT_FIT_LAYOUT });
  });
});

describe('cropSpecSchema', () => {
  const spec = {
    crop: { originX: 0, originY: 0, width: 3, height: 4 },
    cropBasis: { width: 3, height: 4 },
    rotate: 0,
    flip: false,
  };

  it('keeps Fit and its frame style; rows queued before Fit (no `fit`) still read as Fill', () => {
    expect(cropSpecSchema.parse({ ...spec, fit: { frame: 'cream' } }).fit).toEqual({ frame: 'cream' });
    expect(cropSpecSchema.parse(spec)).not.toHaveProperty('fit');
    expect(() => cropSpecSchema.parse({ ...spec, fit: { frame: 'polka' } })).toThrow();
  });

  it('keeps Fit’s layout (D-154) and refuses values out of range', () => {
    const fit = { frame: 'cream', scale: 0.6, x: 0.1, y: -0.2, border: 'thin', borderColor: 'black', corners: 'large' };
    expect(cropSpecSchema.parse({ ...spec, fit }).fit).toEqual(fit);
    for (const bad of [
      { scale: 0.1 },
      { scale: 1.5 },
      { x: 0.8 },
      { border: 'huge' },
      { borderColor: 'pink' },
      { corners: 'round' },
    ]) {
      expect(() => cropSpecSchema.parse({ ...spec, fit: { ...fit, ...bad } })).toThrow();
    }
  });
});

describe('cropRect34', () => {
  it.each([
    ['3:4 portrait keeps everything', 3024, 4032, { originX: 0, originY: 0, width: 3024, height: 4032 }],
    ['4:3 landscape keeps the centre', 4032, 3024, { originX: 882, originY: 0, width: 2268, height: 3024 }],
    ['9:16 portrait trims top and bottom', 1080, 1920, { originX: 0, originY: 240, width: 1080, height: 1440 }],
    ['square trims the sides', 1000, 1000, { originX: 125, originY: 0, width: 750, height: 1000 }],
    ['tiny image still gets a rect', 3, 4, { originX: 0, originY: 0, width: 3, height: 4 }],
  ])('%s', (_label, w, h, expected) => {
    expect(cropRect34(w, h)).toEqual(expected);
  });

  it('uses the Crop screen frame, trimmed to 3:4', () => {
    expect(cropRect34(4032, 3024, { originX: 100, originY: 200, width: 1500, height: 2001 })).toEqual({
      originX: 100,
      originY: 201,
      width: 1500,
      height: 2000,
    });
  });

  it('clamps a frame that runs past the image', () => {
    expect(cropRect34(1000, 1000, { originX: 700, originY: -100, width: 600, height: 800 })).toEqual({
      originX: 700,
      originY: 150,
      width: 300,
      height: 400,
    });
  });

  it.each([
    [0, 100, undefined],
    [100, 100, { originX: 200, originY: 0, width: 10, height: 10 }],
    [100, 100, { originX: Number.NaN, originY: 0, width: 10, height: 10 }],
  ])('refuses empty or invalid input (%p×%p)', (w, h, area) => {
    expect(() => cropRect34(w, h, area)).toThrow(RangeError);
  });
});

describe('cropRectRatio (profile photos, D-79)', () => {
  it('trims a nearly square frame to an exact square', () => {
    expect(
      cropRectRatio(3000, 4000, { width: 1, height: 1 }, { originX: 10, originY: 500, width: 2001, height: 2000 }),
    ).toEqual({ originX: 11, originY: 500, width: 2000, height: 2000 });
  });

  it('takes the largest centred 5:2 band without a frame', () => {
    expect(cropRectRatio(3000, 4000, { width: 5, height: 2 })).toEqual({
      originX: 0,
      originY: 1400,
      width: 3000,
      height: 1200,
    });
  });

  it('keeps a band that runs past the edge inside the photo', () => {
    expect(
      cropRectRatio(3000, 4000, { width: 5, height: 2 }, { originX: 0, originY: 3500, width: 3000, height: 1200 }),
    ).toEqual({ originX: 875, originY: 3500, width: 1250, height: 500 });
  });
});
