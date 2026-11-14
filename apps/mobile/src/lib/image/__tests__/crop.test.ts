import { cropRect34, cropRectRatio } from '../crop';

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
