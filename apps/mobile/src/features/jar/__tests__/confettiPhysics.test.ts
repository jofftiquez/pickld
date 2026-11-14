import {
  BURST_DURATION_MS,
  BURST_FLIGHT_S,
  BURST_GRAVITY,
  BURST_MAX_DELAY_S,
  burstFrame,
  makeBurstPieces,
  type BurstPiece,
} from '../confettiPhysics';

// D-132, D-133: the Publish confetti floats down like light paper. Expected values are worked out by hand from the
// model's velocities (vy(s) = vy0·e^(−qs) + (1 − e^(−ks))·(g/k)·(1 + lift·cos 2φ), vx(s) = vx0·e^(−qs) +
// (1 − e^(−ks))·(drift + glide·sin φ)), not read back from the implementation.

const W = 390;
const H = 844;

// Settles at g/k = 600 / 6 = 100 pt/s; one full tumble per second, flat-on at s = 0.
const piece = (overrides: Partial<BurstPiece> = {}): BurstPiece => ({
  shape: 'strip',
  width: 2.5,
  height: 9,
  color: 'pickle',
  x0: 0.5,
  y0: 0.25,
  vx: 0,
  vy: -1000,
  launchDrag: 5,
  drag: BURST_GRAVITY / 100,
  delay: 0,
  life: BURST_FLIGHT_S,
  rotate0: 0,
  spinKick: 0,
  spin: 0,
  flip0: 0,
  flipRate: 1,
  lift: 0,
  glide: 0,
  drift: 0,
  rock: 0,
  ...overrides,
});

// Speeds from two nearby frames, points per second (down and right are positive).
const fallSpeed = (p: BurstPiece, t: number) =>
  (burstFrame(p, t + 0.001, W, H).y - burstFrame(p, t - 0.001, W, H).y) / 0.002;
const sideSpeed = (p: BurstPiece, t: number) =>
  (burstFrame(p, t + 0.001, W, H).x - burstFrame(p, t - 0.001, W, H).x) / 0.002;

describe('burstFrame', () => {
  it('starts at the launch point', () => {
    const start = burstFrame(piece(), 0, W, H);
    expect(start.x).toBeCloseTo(195);
    expect(start.y).toBeCloseTo(211);
  });

  it('is thrown up, spends the throw within a few tenths of a second, then floats down', () => {
    const p = piece();
    expect(fallSpeed(p, 0.05)).toBeLessThan(-500); // vy ≈ −1000·e^(−0.25) + 100·(1 − e^(−0.3)) ≈ −753
    expect(fallSpeed(p, 1)).toBeGreaterThan(0);
    // At 2 s: −1000·(1 − e^(−10))/5 + 100·(2 − (1 − e^(−12))/6) ≈ −200 + 183.3 points from the launch.
    expect(burstFrame(p, 2, W, H).y - 211).toBeCloseTo(-200 + 100 * (2 - 1 / 6), 0);
  });

  it('settles at a slow fall speed of gravity / drag', () => {
    const p = piece();
    expect(Math.abs(fallSpeed(p, 2) - 100) / 100).toBeLessThan(0.02);
    expect(Math.abs(fallSpeed(p, 3) - 100) / 100).toBeLessThan(0.02);
  });

  it('a sideways throw slows to a stop near vx / launch drag', () => {
    const p = piece({ vx: 600 });
    expect(burstFrame(p, 0.1, W, H).x - 195).toBeGreaterThan(40);
    expect(burstFrame(p, 2, W, H).x - 195).toBeLessThanOrEqual(600 / 5);
    expect(burstFrame(p, 2, W, H).x - 195).toBeGreaterThan(119);
  });

  it('falls slower edge-on than flat-on', () => {
    // lift 0.6: settled vy = 100·(1 + 0.6·cos 2φ). At s = 2, φ = 4π (flat-on): 160. At s = 2.25, φ = 4.5π
    // (edge-on): 40.
    const p = piece({ lift: 0.6 });
    expect(Math.abs(burstFrame(p, 2, W, H).flip)).toBeGreaterThan(0.99);
    expect(fallSpeed(p, 2)).toBeCloseTo(160, -1);
    expect(Math.abs(burstFrame(p, 2.25, W, H).flip)).toBeLessThan(0.01);
    expect(fallSpeed(p, 2.25)).toBeCloseTo(40, -1);
    // Still always falling: the slowest is 100·(1 − 0.6) = 40 pt/s.
    for (let t = 1.5; t < 3; t += 0.05) expect(fallSpeed(p, t)).toBeGreaterThan(30);
  });

  it('slides sideways as it turns edge-on, back the other way on the next half turn', () => {
    // glide 60: settled vx = 60·sin φ. Flat-on at φ = 4π: 0; edge-on at φ = 4.5π: +60; at φ = 5.5π: −60.
    const p = piece({ glide: 60 });
    expect(sideSpeed(p, 2)).toBeCloseTo(0, -1);
    expect(sideSpeed(p, 2.25)).toBeCloseTo(60, -1);
    expect(sideSpeed(p, 2.75)).toBeCloseTo(-60, -1);
    const xs = Array.from({ length: 40 }, (_, i) => burstFrame(p, 2 + i * 0.025, W, H).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(15); // ≈ 2·60 / 2π ≈ 19 points
  });

  it('tumbles (its visible height goes through edge-on and back) and glints as it turns', () => {
    const frames = Array.from({ length: 60 }, (_, i) => burstFrame(piece(), i * 0.02, W, H));
    expect(Math.min(...frames.map((f) => f.flip))).toBeLessThan(-0.9);
    expect(Math.max(...frames.map((f) => f.flip))).toBeGreaterThan(0.9);
    expect(Math.max(...frames.map((f) => f.glint))).toBeGreaterThan(0.3);
    expect(Math.min(...frames.map((f) => f.glint))).toBe(0);
  });

  it('is fully shown mid-flight and fades over the last 22% of its own life', () => {
    const p = piece({ life: 4 });
    expect(burstFrame(p, 1, W, H).opacity).toBe(1);
    expect(burstFrame(p, 4 * 0.78, W, H).opacity).toBeCloseTo(1);
    expect(burstFrame(p, 4 * 0.89, W, H).opacity).toBeCloseTo(0.5);
    expect(burstFrame(p, 4, W, H).opacity).toBe(0);
    expect(burstFrame(p, 4.5, W, H).opacity).toBe(0);
  });

  it('fades as it reaches the bottom of the screen', () => {
    // Settles at 600 pt/s from y = 802: by 0.6 s it has fallen 600·(0.6 − (1 − e^(−0.6))) ≈ 89 points.
    const p = piece({ y0: 0.95, vy: 0, drag: 1 });
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
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  it('is the same for the same seed and different for another', () => {
    expect(makeBurstPieces(36, 7)).toEqual(makeBurstPieces(36, 7));
    expect(makeBurstPieces(36, 7)).not.toEqual(makeBurstPieces(36, 8));
  });

  it('settles every piece slowly, with the fastest at least twice as fast as the slowest', () => {
    for (const seed of seeds) {
      const speeds = makeBurstPieces(36, seed).map((p) => BURST_GRAVITY / p.drag);
      expect(Math.min(...speeds)).toBeGreaterThanOrEqual(40);
      expect(Math.max(...speeds)).toBeLessThanOrEqual(150);
      expect(Math.max(...speeds) / Math.min(...speeds)).toBeGreaterThanOrEqual(2);
    }
  });

  it('no two pieces of a shape fall in step', () => {
    for (const seed of seeds) {
      const pieces = makeBurstPieces(36, seed);
      for (const shape of ['strip', 'square', 'dot'] as const) {
        // The way down once settled: how far each has fallen, every 0.1 s from 1 s to 4 s after its launch.
        const paths = pieces
          .filter((p) => p.shape === shape)
          .map((p) => {
            const from = burstFrame(p, p.delay + 1, W, H).y;
            return Array.from({ length: 31 }, (_, i) => burstFrame(p, p.delay + 1 + i * 0.1, W, H).y - from);
          });
        paths.forEach((a, i) =>
          paths.slice(i + 1).forEach((b) => {
            expect(Math.max(...a.map((y, j) => Math.abs(y - (b[j] ?? 0))))).toBeGreaterThan(5);
          }),
        );
      }
    }
  });

  it('throws every piece up from around the jar card, in small thin strips and squares and a rare dot', () => {
    const pieces = makeBurstPieces(36, 3);
    expect(pieces).toHaveLength(36);
    for (const p of pieces) {
      expect(p.vy).toBeLessThan(0);
      expect(p.x0).toBeGreaterThanOrEqual(0.3);
      expect(p.x0).toBeLessThanOrEqual(0.7);
      expect(p.delay).toBeLessThanOrEqual(BURST_MAX_DELAY_S);
      expect(p.life).toBeLessThanOrEqual(BURST_FLIGHT_S);
      expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(11);
      if (p.shape === 'strip') expect(p.width).toBeLessThanOrEqual(3);
    }
    expect(pieces.filter((p) => p.shape === 'strip').length).toBeGreaterThan(15);
    expect(pieces.some((p) => p.shape === 'square')).toBe(true);
    expect(pieces.filter((p) => p.shape === 'dot').length).toBeLessThanOrEqual(5);
    expect(new Set(pieces.map((p) => p.color)).size).toBe(5);
    expect(pieces.some((p) => p.vx < -100)).toBe(true);
    expect(pieces.some((p) => p.vx > 100)).toBe(true);
  });

  it('every piece clears the card upward, then is gone by the end of the burst', () => {
    for (const seed of seeds) {
      for (const p of makeBurstPieces(36, seed)) {
        const ys = Array.from({ length: 50 }, (_, i) => burstFrame(p, i * 0.02, W, H).y);
        expect(p.y0 * H - Math.min(...ys)).toBeGreaterThan(40);
        expect(burstFrame(p, BURST_DURATION_MS / 1000, W, H).opacity).toBe(0);
      }
    }
  });
});
