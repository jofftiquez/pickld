// Crop screen geometry (FR-CAP-03): photo size + rotation + flip + zoom + pan → the frame's rectangle in the
// turned photo's pixels, always exactly 3:4 and inside the photo. Asymmetric sizes catch swapped axes.
import type { CropRect, Rotation, Size } from '@/lib/image/crop';
import { crop } from '@/theme/tokens';

import {
  clampCrop,
  coverScale,
  CROP_HEADER_HEIGHT,
  CROP_SHEET_HEIGHT,
  cropFrame,
  cropRectFor,
  fitCrop,
  flipCrop,
  initialCrop,
  isThreeByFour,
  MAX_ZOOM,
  maxPan,
  MIN_ZOOM,
  panCrop,
  rotateCrop,
  zoomCrop,
  type CropState,
} from '../cropMath';

// A 2:1 landscape and a 300 × 400 frame: at zoom 1 the photo is shown 800 × 400 (0.2 points per pixel).
const wide: Size = { width: 4000, height: 2000 };
const frame: Size = { width: 300, height: 400 };
const at = (patch: Partial<CropState>): CropState => ({ ...initialCrop, ...patch });

function expectInside(rect: CropRect, image: Size) {
  expect(rect.originX).toBeGreaterThanOrEqual(0);
  expect(rect.originY).toBeGreaterThanOrEqual(0);
  expect(rect.originX + rect.width).toBeLessThanOrEqual(image.width);
  expect(rect.originY + rect.height).toBeLessThanOrEqual(image.height);
  expect([rect.originX, rect.originY, rect.width, rect.height].every(Number.isInteger)).toBe(true);
  // 3:4 within a pixel of rounding.
  expect(Math.abs(rect.width * 4 - rect.height * 3)).toBeLessThanOrEqual(4);
}

describe('isThreeByFour', () => {
  it.each([
    [{ width: 3024, height: 4032 }, true],
    [{ width: 480, height: 640 }, true],
    [{ width: 4032, height: 3024 }, false], // landscape 4:3
    [{ width: 1080, height: 1920 }, false],
    [{ width: 3000, height: 4001 }, false],
    [{ width: 0, height: 0 }, false],
  ])('%j → %s', (size, expected) => {
    expect(isThreeByFour(size)).toBe(expected);
  });
});

describe('cropFrame', () => {
  // D-65: the frame takes what's left after the safe areas, the header and the tool sheet, so the sheet
  // fits without scrolling.
  it('on an iPhone 17 Pro (402 × 874, safe areas 62 and 34) is the designed 300 × 400', () => {
    expect(CROP_HEADER_HEIGHT).toBe(68);
    expect(CROP_SHEET_HEIGHT).toBe(214);
    expect(cropFrame({ width: 402, height: 874 }, { top: 62, bottom: 34 })).toEqual({ width: 300, height: 400 });
  });

  it('leaves room for the header, the photo area and the sheet together', () => {
    for (const [window, insets] of [
      [
        { width: 375, height: 667 },
        { top: 20, bottom: 0 },
      ],
      [
        { width: 390, height: 844 },
        { top: 47, bottom: 34 },
      ],
      [
        { width: 440, height: 956 },
        { top: 62, bottom: 34 },
      ],
    ] as const) {
      const f = cropFrame(window, insets);
      expect(f.width * 4).toBeCloseTo(f.height * 3, 6);
      const used =
        insets.top + CROP_HEADER_HEIGHT + f.height + 2 * crop.frameInsetY + CROP_SHEET_HEIGHT + insets.bottom;
      expect(used).toBeLessThanOrEqual(window.height + 1e-6);
      expect(f.width).toBeLessThanOrEqual(window.width - 2 * crop.frameInsetX);
    }
  });

  it('keeps the side insets on a tall, narrow screen', () => {
    const f = cropFrame({ width: 320, height: 2000 }, { top: 0, bottom: 0 });
    expect(f.width).toBe(320 - 2 * crop.frameInsetX);
  });
});

describe('coverScale and maxPan', () => {
  it('zoom 1 just covers the frame; only the long side can move', () => {
    expect(coverScale(wide, frame, 0)).toBeCloseTo(0.2, 10);
    expect(maxPan(wide, frame, 0, 1)).toEqual({ x: 250, y: 0 });
  });

  it('a quarter turn swaps the axes', () => {
    expect(coverScale(wide, frame, 90)).toBeCloseTo(0.15, 10);
    const limit = maxPan(wide, frame, 90, 1);
    expect(limit.x).toBeCloseTo(0, 10);
    expect(limit.y).toBeCloseTo(100, 10);
    expect(maxPan(wide, frame, 270, 1).y).toBeCloseTo(100, 10);
    expect(maxPan(wide, frame, 180, 1)).toEqual({ x: 250, y: 0 });
  });

  it('zooming in gives room on both axes', () => {
    const limit = maxPan(wide, frame, 0, 3);
    expect(limit.x).toBeCloseTo(1050, 10);
    expect(limit.y).toBeCloseTo(400, 10);
  });
});

describe('cropRectFor', () => {
  it('starts on the largest centred 3:4 area', () => {
    expect(cropRectFor(initialCrop, wide, frame)).toEqual({ originX: 1250, originY: 0, width: 1500, height: 2000 });
  });

  it('a tall photo starts centred vertically', () => {
    const tall = { width: 1000, height: 3000 };
    expect(cropRectFor(initialCrop, tall, frame)).toEqual({ originX: 0, originY: 834, width: 1000, height: 1333 });
  });

  it('moving the photo right shows its left edge, and left its right edge', () => {
    expect(cropRectFor(at({ pan: { x: 250, y: 0 } }), wide, frame).originX).toBe(0);
    expect(cropRectFor(at({ pan: { x: -250, y: 0 } }), wide, frame).originX).toBe(2500);
    expect(cropRectFor(at({ pan: { x: 100, y: 0 } }), wide, frame).originX).toBe(750);
  });

  it('clamps a pan past either edge so the frame is still filled', () => {
    expect(cropRectFor(at({ pan: { x: 9999, y: 50 } }), wide, frame)).toEqual(
      cropRectFor(at({ pan: { x: 250, y: 0 } }), wide, frame),
    );
    expect(cropRectFor(at({ pan: { x: -9999, y: -50 } }), wide, frame)).toEqual(
      cropRectFor(at({ pan: { x: -250, y: 0 } }), wide, frame),
    );
  });

  it('zoom 3 takes a third of the width, at the top-left corner when moved fully down and right', () => {
    expect(cropRectFor(at({ zoom: 3 }), wide, frame)).toEqual({ originX: 1750, originY: 667, width: 500, height: 666 });
    expect(cropRectFor(at({ zoom: 3, pan: { x: 1050, y: 400 } }), wide, frame)).toEqual({
      originX: 0,
      originY: 0,
      width: 500,
      height: 666,
    });
    expect(cropRectFor(at({ zoom: 3, pan: { x: -1050, y: -400 } }), wide, frame)).toEqual({
      originX: 3500,
      originY: 1334, // flush with the bottom edge: 1334 + 666 = 2000
      width: 500,
      height: 666,
    });
  });

  it('zoom outside 1–3 is clamped', () => {
    expect(cropRectFor(at({ zoom: 0.2 }), wide, frame)).toEqual(cropRectFor(initialCrop, wide, frame));
    expect(cropRectFor(at({ zoom: 10 }), wide, frame)).toEqual(cropRectFor(at({ zoom: MAX_ZOOM }), wide, frame));
    expect(cropRectFor(at({ zoom: Number.NaN }), wide, frame)).toEqual(cropRectFor(initialCrop, wide, frame));
  });

  it.each<Rotation>([0, 90, 180, 270])('rotation %i: measured in the turned photo, inside it', (rotation) => {
    const turned = rotation % 180 === 0 ? wide : { width: wide.height, height: wide.width };
    for (const pan of [
      { x: 0, y: 0 },
      { x: 9999, y: 9999 },
      { x: -9999, y: -9999 },
    ]) {
      for (const zoom of [1, 2, 3]) {
        expectInside(cropRectFor(at({ rotation, zoom, pan }), wide, frame), turned);
      }
    }
  });

  it('after a quarter turn the 2:1 photo is tall: full width, centred vertically', () => {
    expect(cropRectFor(at({ rotation: 90 }), wide, frame)).toEqual({
      originX: 0,
      originY: 667,
      width: 2000,
      height: 2666,
    });
    // Moved fully down: the turned photo's top.
    expect(cropRectFor(at({ rotation: 270, pan: { x: 0, y: 100 } }), wide, frame).originY).toBe(0);
  });

  it('flip mirrors the rectangle, so the same part of the photo stays in the frame', () => {
    const s = at({ zoom: 2, pan: { x: 300, y: -120 } });
    const plain = cropRectFor(s, wide, frame);
    const mirrored = cropRectFor(flipCrop(s), wide, frame);
    expect(mirrored).toEqual({ ...plain, originX: wide.width - plain.originX - plain.width });
    expect(mirrored.originX).not.toBe(plain.originX);
  });

  it('keeps a tiny photo inside itself', () => {
    expectInside(cropRectFor(at({ zoom: 3, pan: { x: 40, y: 40 } }), { width: 7, height: 5 }, frame), {
      width: 7,
      height: 5,
    });
  });
});

describe('state changes', () => {
  it('panCrop clamps on both sides of both axes', () => {
    expect(panCrop(initialCrop, { x: 400, y: 30 }, wide, frame).pan).toEqual({ x: 250, y: 0 });
    expect(panCrop(initialCrop, { x: -400, y: -30 }, wide, frame).pan).toEqual({ x: -250, y: 0 });
    const zoomed = at({ zoom: 3 });
    const far = panCrop(zoomed, { x: 2000, y: 2000 }, wide, frame).pan;
    expect(far.x).toBeCloseTo(1050, 9);
    expect(far.y).toBeCloseTo(400, 9);
    const back = panCrop(zoomed, { x: -2000, y: -2000 }, wide, frame).pan;
    expect(back.x).toBeCloseTo(-1050, 9);
    expect(back.y).toBeCloseTo(-400, 9);
  });

  it('zoomCrop keeps the point under the frame centre in place', () => {
    const s = at({ zoom: 2, pan: { x: 200, y: 100 } });
    const before = cropRectFor(s, wide, frame);
    const after = cropRectFor(zoomCrop(s, 3, wide, frame), wide, frame);
    const centre = (r: CropRect) => ({ x: r.originX + r.width / 2, y: r.originY + r.height / 2 });
    expect(Math.abs(centre(after).x - centre(before).x)).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(after).y - centre(before).y)).toBeLessThanOrEqual(1);
  });

  it('zooming out pulls the pan back inside the smaller limits', () => {
    const s = at({ zoom: 3, pan: { x: 1050, y: 400 } });
    expect(zoomCrop(s, 1, wide, frame)).toEqual(at({ zoom: 1, pan: { x: 250, y: 0 } }));
    expect(zoomCrop(s, 0.5, wide, frame).zoom).toBe(MIN_ZOOM);
    expect(zoomCrop(initialCrop, 7, wide, frame).zoom).toBe(MAX_ZOOM);
  });

  it('rotateCrop turns a quarter clockwise, back to 0 after four, and fits the photo again', () => {
    let s = at({ zoom: 2, pan: { x: 50, y: 10 }, flip: true });
    const seen: Rotation[] = [];
    for (let i = 0; i < 4; i += 1) {
      s = rotateCrop(s);
      seen.push(s.rotation);
      expect(s).toMatchObject({ zoom: 1, pan: { x: 0, y: 0 }, flip: true });
    }
    expect(seen).toEqual([90, 180, 270, 0]);
  });

  it('flipCrop toggles the mirror and mirrors the horizontal pan only', () => {
    const s = flipCrop(at({ pan: { x: 120, y: -40 }, zoom: 2 }));
    expect(s).toEqual(at({ flip: true, pan: { x: -120, y: -40 }, zoom: 2 }));
    expect(flipCrop(s).flip).toBe(false);
    expect(flipCrop(initialCrop).pan).toEqual({ x: 0, y: 0 });
  });

  it('fitCrop recentres at zoom 1 and keeps rotation and flip', () => {
    expect(fitCrop(at({ rotation: 270, flip: true, zoom: 2.5, pan: { x: 9, y: 9 } }))).toEqual(
      at({ rotation: 270, flip: true }),
    );
  });

  it('clampCrop leaves a valid state alone', () => {
    const s = at({ rotation: 180, flip: true, zoom: 1.5, pan: { x: -100, y: 50 } });
    expect(clampCrop(s, wide, frame)).toEqual(s);
  });
});
