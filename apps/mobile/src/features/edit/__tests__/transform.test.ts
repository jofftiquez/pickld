import {
  applyDelta,
  clampScale,
  clampTransform,
  fromLocal,
  fromPixels,
  handleDelta,
  hitsBox,
  hitsControl,
  MAX_SCALE,
  MIN_SCALE,
  NO_DELTA,
  normalizeRotation,
  stepTransform,
  toLocal,
  toPixels,
  type Transform,
} from '../overlays/transform';

// Overlay transform math (FR-CAP-05, FR-CAP-08). Expected values are worked out by hand; photo sizes are
// deliberately not square and differ between cases so a swapped width/height shows up.

const portrait = { width: 300, height: 400 };
const full = { width: 1440, height: 1920 };
const wide = { width: 200, height: 100 };

function expectTransform(actual: Transform, expected: Transform) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.scale).toBeCloseTo(expected.scale, 10);
  expect(actual.rotation).toBeCloseTo(expected.rotation, 10);
}

describe('normalized ↔ pixels', () => {
  const t: Transform = { x: 0.25, y: 0.75, scale: 0.5, rotation: 0.3 };

  it('places the centre by the photo width and height, and sizes by the width only', () => {
    expect(toPixels(t, portrait, 0.5)).toEqual({ cx: 75, cy: 300, width: 150, height: 75, rotation: 0.3 });
    expect(toPixels(t, full, 0.5)).toEqual({ cx: 360, cy: 1440, width: 720, height: 360, rotation: 0.3 });
    // On a wide photo the overlay is still half the width: 100 wide, 2 × as tall with aspect 2.
    expect(toPixels(t, wide, 2)).toEqual({ cx: 50, cy: 75, width: 100, height: 200, rotation: 0.3 });
  });

  it('round-trips normalized → pixels → normalized at any size', () => {
    for (const photo of [portrait, full, wide]) {
      expectTransform(fromPixels(toPixels(t, photo, 0.7), photo), t);
    }
  });

  it('reads pixels back relative to the photo they were measured on', () => {
    expect(fromPixels({ cx: 150, cy: 100, width: 60, rotation: -1 }, portrait)).toEqual({
      x: 0.5,
      y: 0.25,
      scale: 0.2,
      rotation: -1,
    });
  });
});

describe('clamps', () => {
  it('keeps the centre on the photo, on both sides of each edge', () => {
    const at = (x: number, y: number) => clampTransform({ x, y, scale: 0.5, rotation: 0 });
    expect(at(-0.01, 0.5)).toMatchObject({ x: 0, y: 0.5 });
    expect(at(0, 0.5)).toMatchObject({ x: 0 });
    expect(at(0.01, 0.5)).toMatchObject({ x: 0.01 });
    expect(at(0.99, 0.5)).toMatchObject({ x: 0.99 });
    expect(at(1, 0.5)).toMatchObject({ x: 1 });
    expect(at(1.01, 0.5)).toMatchObject({ x: 1 });
    expect(at(0.5, -0.2)).toMatchObject({ x: 0.5, y: 0 });
    expect(at(0.5, 0.01)).toMatchObject({ y: 0.01 });
    expect(at(0.5, 0.99)).toMatchObject({ y: 0.99 });
    expect(at(0.5, 1.3)).toMatchObject({ y: 1 });
  });

  it('keeps the size between a tenth and twice the photo width', () => {
    expect(MIN_SCALE).toBe(0.1);
    expect(MAX_SCALE).toBe(2);
    expect(clampScale(0.09)).toBe(0.1);
    expect(clampScale(0.1)).toBe(0.1);
    expect(clampScale(0.11)).toBe(0.11);
    expect(clampScale(1.99)).toBe(1.99);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(2.01)).toBe(2);
  });

  it('keeps the angle in (-π, π]', () => {
    expect(normalizeRotation(0)).toBeCloseTo(0, 10);
    expect(normalizeRotation(1)).toBeCloseTo(1, 10);
    expect(normalizeRotation(-1)).toBeCloseTo(-1, 10);
    expect(normalizeRotation(Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normalizeRotation(-Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normalizeRotation((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 10);
    expect(normalizeRotation((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 10);
    expect(normalizeRotation(2 * Math.PI)).toBeCloseTo(0, 10);
    expect(normalizeRotation(5 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 10);
  });
});

describe('applyDelta', () => {
  const start: Transform = { x: 0.5, y: 0.5, scale: 0.4, rotation: 0.2 };

  it('moves by pixels over the photo size, multiplies the size and adds the angle', () => {
    // 30 px right on a 300-wide photo is 0.1; 40 px up on a 400-tall photo is 0.1.
    expectTransform(applyDelta(start, { dx: 30, dy: -40, scale: 1.5, rotation: Math.PI / 2 }, portrait), {
      x: 0.6,
      y: 0.4,
      scale: 0.6,
      rotation: 0.2 + Math.PI / 2,
    });
    // The same drag on the full-size photo moves much less.
    expectTransform(applyDelta(start, { dx: 144, dy: 192, scale: 1, rotation: 0 }, full), {
      x: 0.6,
      y: 0.6,
      scale: 0.4,
      rotation: 0.2,
    });
  });

  it('changes nothing with no delta', () => {
    expectTransform(applyDelta(start, NO_DELTA, portrait), start);
  });

  it('clamps the result', () => {
    expectTransform(applyDelta(start, { dx: -1000, dy: 1000, scale: 10, rotation: 2 * Math.PI }, portrait), {
      x: 0,
      y: 1,
      scale: MAX_SCALE,
      rotation: 0.2,
    });
    expect(applyDelta(start, { dx: 0, dy: 0, scale: 0.01, rotation: 0 }, portrait).scale).toBe(MIN_SCALE);
  });
});

describe('handleDelta (one finger on the corner handle)', () => {
  const center = { x: 100, y: 100 };

  it('scales by the change in distance from the centre and rotates by the change in angle', () => {
    // 50 px right of centre → 100 px below it: twice as far, a quarter turn clockwise.
    const d = handleDelta(center, { x: 150, y: 100 }, { x: 100, y: 200 });
    expect(d.dx).toBe(0);
    expect(d.dy).toBe(0);
    expect(d.scale).toBeCloseTo(2, 10);
    expect(d.rotation).toBeCloseTo(Math.PI / 2, 10);
  });

  it('turns the short way round and shrinks when the finger moves in', () => {
    // From just below the left edge to just above it: a small clockwise turn, not almost a full one.
    const d = handleDelta(center, { x: 60, y: 101 }, { x: 80, y: 99 });
    expect(d.rotation).toBeCloseTo(Math.atan2(-1, -20) - Math.atan2(1, -40) + 2 * Math.PI, 10);
    expect(d.rotation).toBeGreaterThan(0);
    expect(d.rotation).toBeLessThan(0.1);
    expect(d.scale).toBeCloseTo(Math.hypot(20, 1) / Math.hypot(40, 1), 10);
  });

  it('does nothing when a finger is on the centre', () => {
    expect(handleDelta(center, center, { x: 150, y: 150 })).toEqual(NO_DELTA);
    expect(handleDelta(center, { x: 150, y: 150 }, center)).toEqual(NO_DELTA);
  });
});

describe('local frame and hit testing', () => {
  const turned = { cx: 100, cy: 50, width: 100, height: 20, rotation: Math.PI / 2 };

  it('undoes the rotation (clockwise, screen y down)', () => {
    // A quarter turn clockwise points the overlay's +x axis down the screen.
    const local = toLocal(turned, { x: 100, y: 80 });
    expect(local.x).toBeCloseTo(30, 10);
    expect(local.y).toBeCloseTo(0, 10);
    const back = fromLocal(turned, { x: 30, y: -10 });
    expect(back.x).toBeCloseTo(110, 10);
    expect(back.y).toBeCloseTo(80, 10);
  });

  it('round-trips local ↔ photo pixels', () => {
    const box = { cx: 37, cy: 211, width: 80, height: 40, rotation: -0.7 };
    const p = { x: 12, y: 250 };
    const back = fromLocal(box, toLocal(box, p));
    expect(back.x).toBeCloseTo(12, 10);
    expect(back.y).toBeCloseTo(250, 10);
  });

  it('hits the rotated box, grown to at least 44 × 44', () => {
    const flat = { cx: 100, cy: 100, width: 100, height: 20, rotation: 0 };
    expect(hitsBox(flat, { x: 149, y: 100 }, 44)).toBe(true);
    expect(hitsBox(flat, { x: 151, y: 100 }, 44)).toBe(false);
    // 20 tall, but the touch area is 44 tall: 22 either side of the centre.
    expect(hitsBox(flat, { x: 100, y: 121 }, 44)).toBe(true);
    expect(hitsBox(flat, { x: 100, y: 123 }, 44)).toBe(false);
    expect(hitsBox(turned, { x: 100, y: 99 }, 44)).toBe(true);
    expect(hitsBox(turned, { x: 100, y: 101 }, 44)).toBe(false);
    expect(hitsBox(turned, { x: 149, y: 50 }, 44)).toBe(false);
  });

  it('hits a control within its radius, wherever rotation has carried it', () => {
    // The top-right corner (50, -10) of the turned box is at (110, 100) on the photo.
    expect(hitsControl(turned, { x: 50, y: -10 }, { x: 110, y: 121 }, 22)).toBe(true);
    expect(hitsControl(turned, { x: 50, y: -10 }, { x: 110, y: 123 }, 22)).toBe(false);
    expect(hitsControl(turned, { x: 50, y: -10 }, { x: 150, y: 40 }, 22)).toBe(false);
  });
});

describe('stepTransform (accessibility actions)', () => {
  const t: Transform = { x: 0.5, y: 0.5, scale: 0.4, rotation: 0 };

  it('moves a twentieth of the photo, resizes by 1.25 and turns 15°', () => {
    expectTransform(stepTransform(t, 'left'), { ...t, x: 0.45 });
    expectTransform(stepTransform(t, 'right'), { ...t, x: 0.55 });
    expectTransform(stepTransform(t, 'up'), { ...t, y: 0.45 });
    expectTransform(stepTransform(t, 'down'), { ...t, y: 0.55 });
    expectTransform(stepTransform(t, 'bigger'), { ...t, scale: 0.5 });
    expectTransform(stepTransform(t, 'smaller'), { ...t, scale: 0.32 });
    expectTransform(stepTransform(t, 'rotateRight'), { ...t, rotation: Math.PI / 12 });
    expectTransform(stepTransform(t, 'rotateLeft'), { ...t, rotation: -Math.PI / 12 });
  });

  it('stops at the edges and size limits', () => {
    expect(stepTransform({ ...t, x: 0.98 }, 'right').x).toBe(1);
    expect(stepTransform({ ...t, y: 0.02 }, 'up').y).toBe(0);
    expect(stepTransform({ ...t, scale: 1.9 }, 'bigger').scale).toBe(MAX_SCALE);
    expect(stepTransform({ ...t, scale: 0.11 }, 'smaller').scale).toBe(MIN_SCALE);
  });
});
