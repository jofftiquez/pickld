import { cropRect34, cropRectRatio, cropSpecSchema, fitRect34, FULL_SIZE, MEDIUM_SIZE, THUMB_SIZE } from '../crop';

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
