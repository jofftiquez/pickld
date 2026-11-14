// Realistic confetti for the Publish burst (D-132): each piece is launched up and out from the jar card, slows
// in the air, falls at its own terminal speed, sways and flips like paper, and fades as it settles. Pure and
// worklet-safe, so every piece's position is worked out on the UI thread from one clock.

import { lidColors, motion } from '@/theme/tokens';

/** Pulls every piece down, in points per second squared (screen y grows downward). */
export const BURST_GRAVITY = 1800;
/** How long each piece flies, in seconds; it has faded out by the end. */
export const BURST_FLIGHT_S = motion.confettiBurst / 1000;
/** The last pieces leave this long after the first (a second, smaller puff). */
export const BURST_MAX_DELAY_S = 0.12;
export const BURST_PIECES = 36;
/** From the first launch until the last piece has faded. */
export const BURST_DURATION_MS = Math.round((BURST_FLIGHT_S + BURST_MAX_DELAY_S) * 1000);
/** Pieces fade over the last quarter of their flight… */
const FADE_SHARE = 0.25;
/** …or over this many points as they reach the bottom edge. */
const EDGE_FADE = 60;
/** The brightest a glint gets, as the white layer's opacity. */
const GLINT_MAX = 0.5;

export type BurstShape = 'strip' | 'square' | 'dot';

export type BurstPiece = {
  shape: BurstShape;
  width: number;
  height: number;
  color: Exclude<keyof typeof lidColors, 'ink'>;
  /** Launch point as a share of the screen. */
  x0: number;
  y0: number;
  /** Launch velocity, points per second (negative vy is up). */
  vx: number;
  vy: number;
  /** Linear air drag per second; light, wide pieces drag more and fall slower (terminal speed gravity / drag). */
  drag: number;
  /** Seconds after the burst starts that this piece leaves. */
  delay: number;
  /** Turn in degrees: a start angle, the extra turn from the launch (dies out with drag), then a steady tumble. */
  rotate0: number;
  spinKick: number;
  spin: number;
  /** Flip around the piece's own axis in turns: start phase, kick and steady rate per second. */
  flip0: number;
  flipKick: number;
  flipRate: number;
  /** Side-to-side flutter in points and swings per second; it grows as the piece slows. */
  swayAmp: number;
  swayHz: number;
  swayPhase: number;
};

export type BurstFrame = {
  /** Center of the piece, in points from the screen's top left. */
  x: number;
  y: number;
  /** Turn in degrees, including the rock that goes with the flutter. */
  rotate: number;
  /** -1…1: the visible height while flipping (0 is edge-on, negative is the back). */
  flip: number;
  /** 0…GLINT_MAX: white over the piece as it turns into the light. */
  glint: number;
  opacity: number;
};

/**
 * Where a piece is `t` seconds after the burst started, on a `width` × `height` screen. Projectile motion with
 * linear drag k and gravity g: vx(t) = vx0·e^(−kt); vy(t) = g/k + (vy0 − g/k)·e^(−kt). So the launch is quick,
 * slows within a few tenths of a second, and the fall levels off at g/k.
 */
export function burstFrame(piece: BurstPiece, t: number, width: number, height: number): BurstFrame {
  'worklet';
  const x0 = piece.x0 * width;
  const y0 = piece.y0 * height;
  const s = t - piece.delay;
  if (s <= 0) {
    return { x: x0, y: y0, rotate: piece.rotate0, flip: Math.cos(piece.flip0 * 2 * Math.PI), glint: 0, opacity: 0 };
  }
  const k = piece.drag;
  const slowed = 1 - Math.exp(-k * s); // 0 at launch, → 1 once the launch speed is spent
  const terminal = BURST_GRAVITY / k;
  const swing = 2 * Math.PI * piece.swayHz * s + piece.swayPhase;
  const x = x0 + (piece.vx * slowed) / k + piece.swayAmp * slowed * Math.sin(swing);
  const y = y0 + terminal * s + ((piece.vy - terminal) * slowed) / k;
  // Fluttering paper rocks with its swing: tilted most as it changes direction.
  const rotate = piece.rotate0 + (piece.spinKick * slowed) / k + piece.spin * s + 25 * slowed * Math.cos(swing);
  const phase = 2 * Math.PI * (piece.flip0 + (piece.flipKick * slowed) / k + piece.flipRate * s);
  const turn = Math.sin(2 * phase);
  const glint = turn > 0 ? GLINT_MAX * turn * turn * turn * turn : 0;
  const life = Math.min(1, Math.max(0, (1 - s / BURST_FLIGHT_S) / FADE_SHARE));
  const edge = Math.min(1, Math.max(0, (height - y) / EDGE_FADE));
  return { x, y, rotate, flip: Math.cos(phase), glint, opacity: Math.min(life, edge) };
}

// mulberry32: a tiny seeded generator, so a burst is the same for the same seed (tests, re-renders).
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS: readonly BurstPiece['color'][] = ['pickle', 'mango', 'ube', 'sunset', 'sky'];

/**
 * `count` pieces fanned up and out from the jar card near the top of the screen: mostly strips, some squares, a
 * few dots, in the lid colors, each with its own size, speed, drag, spin and flutter.
 */
export function makeBurstPieces(count: number, seed: number): BurstPiece[] {
  const rand = seeded(seed);
  const between = (low: number, high: number) => low + (high - low) * rand();
  const sign = () => (rand() < 0.5 ? -1 : 1);
  const pieces: BurstPiece[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    const shape: BurstShape = roll < 0.55 ? 'strip' : roll < 0.85 ? 'square' : 'dot';
    const side = shape === 'square' ? between(7, 10) : between(6, 8);
    const size =
      shape === 'strip'
        ? { width: between(4, 6), height: between(10, 15), drag: between(4.2, 5.4), swayAmp: between(14, 28) }
        : shape === 'square'
          ? { width: side, height: side, drag: between(3.4, 4.2), swayAmp: between(8, 18) }
          : { width: side, height: side, drag: between(2.8, 3.4), swayAmp: between(3, 8) };
    // Across the card; pieces from the left lean left and from the right lean right, with some scatter.
    const x0 = between(0.3, 0.7);
    const angle = 1.4 * (x0 - 0.5) + between(-0.7, 0.7);
    const speed = between(950, 1500);
    pieces.push({
      shape,
      width: size.width,
      height: size.height,
      color: COLORS[i % COLORS.length] ?? 'pickle',
      x0,
      y0: between(0.24, 0.28),
      vx: speed * Math.sin(angle),
      vy: -speed * Math.cos(angle),
      drag: size.drag,
      delay: rand() < 0.7 ? between(0, 0.04) : between(0.08, BURST_MAX_DELAY_S),
      rotate0: between(0, 360),
      spinKick: sign() * between(400, 900),
      spin: sign() * between(90, 360),
      flip0: rand(),
      flipKick: sign() * between(1, 3),
      flipRate: sign() * between(0.8, 2),
      swayAmp: size.swayAmp,
      swayHz: between(1, 2),
      swayPhase: between(0, 2 * Math.PI),
    });
  }
  return pieces;
}
