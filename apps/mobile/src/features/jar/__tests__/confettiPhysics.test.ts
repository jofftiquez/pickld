import {
  BURST_DURATION_MS,
  BURST_FLIGHT_S,
  BURST_GRAVITY,
  burstFrame,
  makeBurstPieces,
  type BurstPiece,
} from '../confettiPhysics';

// D-132: the Publish confetti moves like paper. Expected values are worked out by hand from projectile motion
// with linear drag (vy(t) = g/k + (vy0 − g/k)·e^(−kt)), not read back from the implementation.

const W = 390;
const H = 844;

const piece = (overrides: Partial<BurstPiece> = {}): BurstPiece => ({
  shape: 'strip',
  width: 5,
  height: 12,
  color: 'pickle',
  x0: 0.5,
  y0: 0.25,
  vx: 0,
  vy: -1000,
  drag: 3,
  delay: 0,
  rotate0: 0,
  spinKick: 0,
  spin: 0,
  flip0: 0,
  flipKick: 0,
  flipRate: 1,
  swayAmp: 0,
  swayHz: 1.5,
  swayPhase: 0,
  ...overrides,
});

// Downward speed from two nearby frames, points per second.
const fallSpeed = (p: BurstPiece, t: number) => (burstFrame(p, t + 0.005, W, H).y - burstFrame(p, t, W, H).y) / 0.005;

describe('burstFrame', () => {
  it('starts at the launch point', () => {
    const start = burstFrame(piece(), 0, W, H);
    expect(start.x).toBeCloseTo(195);
    expect(start.y).toBeCloseTo(211);
  });

  it('rises first, peaks when the launch speed is spent, then falls', () => {
    const p = piece();
    // g/k = 600; vy = 0 when e^(−3t) = 600 / 1600, so t = ln(8/3) / 3 ≈ 0.327 s.
    const apex = Math.log(8 / 3) / 3;
    expect(fallSpeed(p, 0.05)).toBeLessThan(0); // still going up
    expect(burstFrame(p, apex, W, H).y).toBeLessThan(burstFrame(p, apex - 0.1, W, H).y);
    expect(burstFrame(p, apex, W, H).y).toBeLessThan(burstFrame(p, apex + 0.1, W, H).y);
    expect(fallSpeed(p, 0.6)).toBeGreaterThan(0); // coming down
    // Rise: ∫ vy dt = (g/k)·t + (vy0 − g/k)(1 − e^(−kt))/k = 600·0.327 − 1600·(5/8)/3 ≈ −137 points.
    expect(burstFrame(p, apex, W, H).y - 211).toBeCloseTo(600 * apex - (1600 * (5 / 8)) / 3, 0);
  });

  it('its fall levels off at gravity / drag instead of speeding up', () => {
    const p = piece();
    const terminal = BURST_GRAVITY / 3;
    const late = fallSpeed(p, 1.5);
    expect(Math.abs(late - terminal) / terminal).toBeLessThan(0.05);
    // Without drag it would gain g·0.4 s = 720 pt/s between 1.1 s and 1.5 s; with drag it barely changes.
    expect(late - fallSpeed(p, 1.1)).toBeLessThan(80);
  });

  it('heavier, less draggy pieces fall faster', () => {
    expect(fallSpeed(piece({ drag: 2.4 }), 1.5)).toBeGreaterThan(fallSpeed(piece({ drag: 4 }), 1.5));
  });

  it('a sideways launch slows to a drift: it never passes vx / k', () => {
    const p = piece({ vx: 600 });
    expect(burstFrame(p, 0.1, W, H).x - 195).toBeGreaterThan(40);
    expect(burstFrame(p, 1.8, W, H).x - 195).toBeLessThanOrEqual(600 / 3);
    expect(burstFrame(p, 1.8, W, H).x - 195).toBeGreaterThan(190);
  });

  it('flutters side to side, more once it has slowed', () => {
    const p = piece({ swayAmp: 20 });
    const xs = Array.from({ length: 40 }, (_, i) => burstFrame(p, 0.4 + i * 0.03, W, H).x - 195);
    expect(Math.max(...xs)).toBeGreaterThan(10);
    expect(Math.min(...xs)).toBeLessThan(-10);
    // Right after launch the sway is still small.
    expect(Math.abs(burstFrame(p, 0.02, W, H).x - 195)).toBeLessThan(3);
  });

  it('flips (its visible height goes through edge-on and back) and glints as it turns', () => {
    const p = piece();
    const frames = Array.from({ length: 60 }, (_, i) => burstFrame(p, i * 0.02, W, H));
    expect(Math.min(...frames.map((f) => f.flip))).toBeLessThan(-0.9);
    expect(Math.max(...frames.map((f) => f.flip))).toBeGreaterThan(0.9);
    expect(Math.max(...frames.map((f) => f.glint))).toBeGreaterThan(0.3);
    expect(Math.min(...frames.map((f) => f.glint))).toBe(0);
  });

  it('is fully shown mid-flight and has faded out by the end', () => {
    // Launched sideways and up so it stays on screen; only the time fade applies.
    const p = piece({ vy: -1400, drag: 4 });
    expect(burstFrame(p, 0.5, W, H).opacity).toBe(1);
    expect(burstFrame(p, BURST_FLIGHT_S * 0.875, W, H).opacity).toBeCloseTo(0.5);
    expect(burstFrame(p, BURST_FLIGHT_S, W, H).opacity).toBe(0);
    expect(burstFrame(p, BURST_FLIGHT_S + 0.5, W, H).opacity).toBe(0);
  });

  it('fades as it reaches the bottom of the screen', () => {
    const p = piece({ y0: 0.9, vy: 0, drag: 2 });
    expect(burstFrame(p, 0.6, W, H).y).toBeGreaterThan(H);
    expect(burstFrame(p, 0.6, W, H).opacity).toBe(0);
  });

  it('waits, hidden, until its own launch', () => {
    const p = piece({ delay: 0.1 });
    expect(burstFrame(p, 0.05, W, H).opacity).toBe(0);
    expect(burstFrame(p, 0.05, W, H).y).toBeCloseTo(211);
  });
});

describe('makeBurstPieces', () => {
  it('is the same for the same seed and different for another', () => {
    expect(makeBurstPieces(36, 7)).toEqual(makeBurstPieces(36, 7));
    expect(makeBurstPieces(36, 7)).not.toEqual(makeBurstPieces(36, 8));
  });

  it('throws every piece upward from around the jar card, in varied shapes and sizes', () => {
    const pieces = makeBurstPieces(36, 3);
    expect(pieces).toHaveLength(36);
    for (const p of pieces) {
      expect(p.vy).toBeLessThan(0);
      expect(p.x0).toBeGreaterThanOrEqual(0.3);
      expect(p.x0).toBeLessThanOrEqual(0.7);
      expect(p.delay * 1000).toBeLessThanOrEqual(BURST_DURATION_MS - BURST_FLIGHT_S * 1000);
    }
    expect(new Set(pieces.map((p) => p.shape)).size).toBe(3);
    expect(new Set(pieces.map((p) => p.color)).size).toBe(5);
    expect(new Set(pieces.map((p) => Math.round(p.width * 10))).size).toBeGreaterThan(10);
    // Some go left, some go right.
    expect(pieces.some((p) => p.vx < -100)).toBe(true);
    expect(pieces.some((p) => p.vx > 100)).toBe(true);
  });
});
