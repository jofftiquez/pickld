import {
  clamp,
  displayFactor,
  focusMark,
  formatFactor,
  lensInfo,
  pinchZoom,
  selectedStop,
  zoomPlan,
  type LensInfo,
} from '../cameraZoom';

// Zoom buttons, pinch and tap to focus (D-144). Lens sets and switch factors are what iOS reports for each
// virtual camera (virtualDeviceSwitchOverVideoZoomFactors): zoom 1 is the widest lens of the set.

const lens = (overrides: Partial<LensInfo>): LensInfo => ({
  lenses: ['wide-angle'],
  minZoom: 1,
  maxZoom: 16,
  switchFactors: [],
  supportsFocus: true,
  ...overrides,
});

// iPhone 14 Pro: ultra-wide (zoom 1), wide (zoom 2), 3× telephoto (zoom 6).
const iphone14Pro = lens({
  lenses: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
  maxZoom: 123,
  switchFactors: [2, 6],
});
// iPhone 15 Pro Max: the telephoto is 5× (zoom 10).
const iphone15ProMax = lens({
  lenses: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
  maxZoom: 123,
  switchFactors: [2, 10],
});
// iPhone 13 / 14: ultra-wide and wide only (dual-wide camera).
const dualWide = lens({ lenses: ['ultra-wide-angle', 'wide-angle'], maxZoom: 95, switchFactors: [2] });
// iPhone 8 Plus / XS: wide and a 2× telephoto, no ultra-wide (dual camera); zoom 1 is the wide lens.
const dualTele = lens({ lenses: ['wide-angle', 'telephoto'], maxZoom: 16, switchFactors: [2] });
// iPhone SE / XR or a front camera: one wide lens.
const single = lens({ lenses: ['wide-angle'], maxZoom: 16 });

const factors = (info: LensInfo) => zoomPlan(info).stops.map((s) => s.factor);

describe('zoomPlan', () => {
  it('iPhone 14 Pro: 0.5×, 1×, 2×, 3× at zoom 1, 2, 4, 6; 1× is the wide lens; pinch up to 10×', () => {
    expect(zoomPlan(iphone14Pro)).toEqual({
      neutral: 2,
      min: 1,
      max: 20,
      stops: [
        { factor: 0.5, zoom: 1 },
        { factor: 1, zoom: 2 },
        { factor: 2, zoom: 4 },
        { factor: 3, zoom: 6 },
      ],
    });
  });

  it('iPhone 15 Pro Max: 0.5×, 1×, 2×, 5×', () => {
    expect(zoomPlan(iphone15ProMax).stops).toEqual([
      { factor: 0.5, zoom: 1 },
      { factor: 1, zoom: 2 },
      { factor: 2, zoom: 4 },
      { factor: 5, zoom: 10 },
    ]);
  });

  it('ultra-wide and wide only: 0.5×, 1×, 2× (a crop of the wide lens)', () => {
    expect(factors(dualWide)).toEqual([0.5, 1, 2]);
    expect(zoomPlan(dualWide).stops[2]?.zoom).toBe(4);
  });

  it('wide and a 2× telephoto: 1× and 2× (the telephoto), no 0.5×', () => {
    expect(zoomPlan(dualTele)).toEqual({
      neutral: 1,
      min: 1,
      max: 10,
      stops: [
        { factor: 1, zoom: 1 },
        { factor: 2, zoom: 2 },
      ],
    });
  });

  it('one lens: no buttons; pinch from 1× to 10× or the lens limit, whichever is lower', () => {
    expect(zoomPlan(single)).toEqual({ neutral: 1, min: 1, max: 10, stops: [] });
    expect(zoomPlan(lens({ maxZoom: 4 })).max).toBe(4);
  });

  it('drops a stop past the lens limit', () => {
    expect(factors({ ...iphone14Pro, maxZoom: 5 })).toEqual([0.5, 1, 2]);
  });

  it('an ultra-wide camera that reports no switch factor uses its minimum as 1×', () => {
    expect(zoomPlan({ ...dualWide, switchFactors: [] }).neutral).toBe(1);
  });
});

describe('lensInfo', () => {
  const device = {
    type: 'triple',
    physicalDevices: [{ type: 'ultra-wide-angle' }, { type: 'wide-angle' }, { type: 'telephoto' }],
    minZoom: 1,
    maxZoom: 123,
    zoomLensSwitchFactors: [2, 6],
    supportsFocusMetering: true,
  } as unknown as Parameters<typeof lensInfo>[0];

  it('a virtual camera lists its physical lenses', () => {
    expect(lensInfo(device)).toEqual(iphone14Pro);
  });

  it('a physical camera is its own lens; a front camera that can’t focus says so', () => {
    const front = { ...device, type: 'wide-angle' as const, physicalDevices: [], zoomLensSwitchFactors: [] };
    expect(lensInfo({ ...front, supportsFocusMetering: false, maxZoom: 16 })).toEqual(lens({ supportsFocus: false }));
  });
});

describe('pinch', () => {
  it('multiplies the starting zoom by the pinch scale', () => {
    expect(pinchZoom(2, 1.5, 1, 20)).toBe(3);
    expect(pinchZoom(4, 0.75, 1, 20)).toBe(3);
  });

  it('stays within min and max', () => {
    expect(pinchZoom(2, 100, 1, 20)).toBe(20);
    expect(pinchZoom(2, 0.1, 1, 20)).toBe(1);
    expect(clamp(-3, 0, 5)).toBe(0);
  });
});

describe('display', () => {
  it('reads zoom as a factor of the wide lens, to one decimal', () => {
    expect(displayFactor(1, 2)).toBe(0.5);
    expect(displayFactor(2, 2)).toBe(1);
    expect(displayFactor(4.83, 2)).toBe(2.4);
    expect(displayFactor(20, 2)).toBe(10);
  });

  it('formats factors without trailing zeros', () => {
    expect(formatFactor(0.5)).toBe('0.5');
    expect(formatFactor(3)).toBe('3');
    expect(formatFactor(2.44)).toBe('2.4');
  });

  it('highlights the largest button at or below the zoom', () => {
    const stops = zoomPlan(iphone14Pro).stops;
    expect(selectedStop(stops, 0.5)).toBe(0);
    expect(selectedStop(stops, 0.8)).toBe(0);
    expect(selectedStop(stops, 1)).toBe(1);
    expect(selectedStop(stops, 2.9)).toBe(2);
    expect(selectedStop(stops, 3)).toBe(3);
    expect(selectedStop(stops, 10)).toBe(3);
    expect(selectedStop([], 1)).toBe(-1);
  });
});

describe('focusMark', () => {
  const view = { width: 390, height: 520 };

  it('focuses on the tap, with the square centred on it', () => {
    expect(focusMark({ x: 100, y: 200 }, view, 72)).toEqual({ point: { x: 100, y: 200 }, left: 64, top: 164 });
  });

  it('keeps the square inside the preview near an edge, but still focuses on the tap', () => {
    expect(focusMark({ x: 5, y: 510 }, view, 72)).toEqual({ point: { x: 5, y: 510 }, left: 0, top: 448 });
    expect(focusMark({ x: 389, y: 2 }, view, 72)).toEqual({ point: { x: 389, y: 2 }, left: 318, top: 0 });
  });

  it('a tap reported just outside the preview focuses on its edge', () => {
    expect(focusMark({ x: -4, y: 530 }, view, 72).point).toEqual({ x: 0, y: 520 });
  });
});
