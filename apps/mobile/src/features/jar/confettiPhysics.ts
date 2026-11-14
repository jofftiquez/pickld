// Realistic confetti for the Publish burst (D-132, D-133): each piece is thrown up and out from the jar card,
// loses that speed within a few tenths of a second and then floats down like light paper, at its own slow speed.
// Its fall is tied to its tumble: it slows and slides sideways as it turns edge-on and drops faster flat-on, so it
// zigzags down like a leaf. Pure and worklet-safe; every piece's position is worked out on the UI thread from one
// clock, in closed form (no per-frame stepping).
//
// Scale: commercial paper confetti (about 5 × 2 cm) settles at roughly 0.25 m/s while tumbling (Münchenbach & Neff,
// arXiv 2208.03695). Drawn about 9 pt long, a 5 cm strip maps 1 cm ≈ 2 pt, so 25 cm/s ≈ 50 pt/s on screen; the
// slowest pieces here settle near that and the densest about three times faster.

import { lidColors, motion } from '@/theme/tokens';

/** Pulls every piece down, in points per second squared (screen y grows downward). */
export const BURST_GRAVITY = 600;
/** The longest any piece lives, in seconds; it has faded out by then. */
export const BURST_FLIGHT_S = motion.confettiBurst / 1000;
/** The last pieces leave this long after the first (a second, smaller puff). */
export const BURST_MAX_DELAY_S = 0.15;
export const BURST_PIECES = 36;
/** From the first launch until the last piece has faded. */
export const BURST_DURATION_MS = Math.round((BURST_FLIGHT_S + BURST_MAX_DELAY_S) * 1000);
/** Pieces fade over the last 22% of their own life… */
const FADE_SHARE = 0.22;
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
  /**
   * How fast the throw dies out, per second. Air resistance grows with the square of speed, so a fast throw is
   * spent within a few tenths of a second, much sooner than the fall settles (`drag`).
   */
  launchDrag: number;
  /**
   * Air drag per second for this piece's mass: its fall grows in at this rate and settles at BURST_GRAVITY / drag.
   * Light, wide pieces drag more and hang; denser ones drop sooner.
   */
  drag: number;
  /** Seconds after the burst starts that this piece leaves. */
  delay: number;
  /** Seconds this piece lives (≤ BURST_FLIGHT_S); it fades over the end of it. */
  life: number;
  /** Turn in degrees: a start angle, the extra turn from the launch (dies out with drag), then a slow steady turn. */
  rotate0: number;
  spinKick: number;
  spin: number;
  /** Tumble around the piece's own axis in turns: start phase and steady rate per second (the sign is its sense). */
  flip0: number;
  flipRate: number;
  /** 0…1: how much the tumble changes the fall: settled speed × (1 + lift·cos 2φ), so slowest edge-on. */
  lift: number;
  /** Sideways slide in points per second at edge-on (× sin φ, so it swings back each half turn). */
  glide: number;
  /** A steady sideways drift once settled, points per second. */
  drift: number;
  /** Degrees it rocks with the slide, like a leaf. */
  rock: number;
};

export type BurstFrame = {
  /** Center of the piece, in points from the screen's top left. */
  x: number;
  y: number;
  /** Turn in degrees, including the rock that goes with the slide. */
  rotate: number;
  /** -1…1: the visible height while tumbling (0 is edge-on, negative is the back). */
  flip: number;
  /** 0…GLINT_MAX: white over the piece as it turns into the light. */
  glint: number;
  opacity: number;
};

/**
 * ∫₀ˢ (1 − e^(−k·u))·cos(Ω·u + c) du: an oscillation that only grows in as the launch speed is spent. Ω ≠ 0.
 * Uses ∫ e^(−ku)·cos(Ωu + c) du = e^(−ku)·(Ω·sin(Ωu + c) − k·cos(Ωu + c)) / (k² + Ω²).
 */
function settledWave(s: number, k: number, omega: number, c: number): number {
  'worklet';
  const plain = (Math.sin(omega * s + c) - Math.sin(c)) / omega;
  const damped =
    (Math.exp(-k * s) * (omega * Math.sin(omega * s + c) - k * Math.cos(omega * s + c)) -
      (omega * Math.sin(c) - k * Math.cos(c))) /
    (k * k + omega * omega);
  return plain - damped;
}

/**
 * Where a piece is `t` seconds after the burst started, on a `width` × `height` screen. With s the time since its
 * launch, q its launch drag, k its drag, V = g/k its settled fall speed and φ = 2π·(flip0 + flipRate·s) its
 * tumble, its velocity is
 *   vx(s) = vx0·e^(−qs) + (1 − e^(−ks))·(drift + glide·sin φ)
 *   vy(s) = vy0·e^(−qs) + (1 − e^(−ks))·V·(1 + lift·cos 2φ)
 * (the throw dying out, the fall growing in to its settled speed, and the tumble's flutter on top), integrated
 * exactly.
 */
export function burstFrame(piece: BurstPiece, t: number, width: number, height: number): BurstFrame {
  'worklet';
  const x0 = piece.x0 * width;
  const y0 = piece.y0 * height;
  const s = t - piece.delay;
  const turns = 2 * Math.PI * piece.flipRate;
  const start = 2 * Math.PI * piece.flip0;
  if (s <= 0) {
    return { x: x0, y: y0, rotate: piece.rotate0, flip: Math.cos(start), glint: 0, opacity: 0 };
  }
  const q = piece.launchDrag;
  const k = piece.drag;
  const thrown = (1 - Math.exp(-q * s)) / q; // ∫₀ˢ e^(−qu) du: the throw's share of the way
  const settled = s - (1 - Math.exp(-k * s)) / k; // ∫₀ˢ (1 − e^(−ku)) du: the fall's
  const terminal = BURST_GRAVITY / k;
  const phase = start + turns * s;
  // sin φ = cos(φ − π/2); cos 2φ runs at twice the rate.
  const slide = settledWave(s, k, turns, start - Math.PI / 2);
  const flutter = settledWave(s, k, 2 * turns, 2 * start);
  const x = x0 + piece.vx * thrown + piece.drift * settled + piece.glide * slide;
  const y = y0 + piece.vy * thrown + terminal * settled + terminal * piece.lift * flutter;
  const rock = piece.rock * (1 - Math.exp(-k * s)) * Math.sin(phase);
  const rotate = piece.rotate0 + piece.spinKick * thrown + piece.spin * s + rock;
  const turn = Math.sin(2 * phase);
  const glint = turn > 0 ? GLINT_MAX * turn * turn * turn * turn : 0;
  const life = Math.min(1, Math.max(0, (1 - s / piece.life) / FADE_SHARE));
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
 * `count` pieces fanned up and out from the jar card near the top of the screen: mostly thin strips, small squares
 * and a rare dot, in the lid colors. Each gets its own drag (so its own settled speed, 40–150 pt/s), size,
 * throw, tumble and slide, so no two fall in step.
 */
export function makeBurstPieces(count: number, seed: number): BurstPiece[] {
  const rand = seeded(seed);
  const between = (low: number, high: number) => low + (high - low) * rand();
  const sign = () => (rand() < 0.5 ? -1 : 1);
  // Each piece's own settled fall speed: the range is split into `count` steps, shuffled, so speeds spread evenly
  // from 40 to 150 pt/s and no two pieces settle at the same pace.
  const ranks = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j] ?? j, ranks[i] ?? i];
  }
  const pieces: BurstPiece[] = [];
  for (let i = 0; i < count; i++) {
    const settle = 40 + (110 * ((ranks[i] ?? i) + between(0.35, 0.65))) / count;
    // The slowest are thin strips that hang; denser squares and a rare dot drop sooner.
    const roll = rand();
    const shape: BurstShape =
      settle < 75 || (settle < 125 && roll < 0.55) ? 'strip' : settle >= 125 && roll < 0.25 ? 'dot' : 'square';
    const side = shape === 'square' ? between(4, 6) : between(3, 4);
    const size = shape === 'strip' ? { width: between(2, 3), height: between(7, 11) } : { width: side, height: side };
    const q = between(5, 7);
    // Across the card; pieces from the left lean left and from the right lean right, with some scatter. The throw
    // is scaled so every piece clears the card: it would travel `rise` up and `spread` across if it did not fall.
    const x0 = between(0.3, 0.7);
    const spread = (x0 - 0.5) * 360 + between(-110, 110);
    const rise = between(130, 230);
    pieces.push({
      shape,
      width: size.width,
      height: size.height,
      color: COLORS[i % COLORS.length] ?? 'pickle',
      x0,
      y0: between(0.24, 0.28),
      vx: q * spread,
      vy: -q * rise,
      launchDrag: q,
      drag: BURST_GRAVITY / settle,
      delay: rand() < 0.7 ? between(0, 0.05) : between(0.08, BURST_MAX_DELAY_S),
      life: between(0.8, 1) * BURST_FLIGHT_S,
      rotate0: between(0, 360),
      spinKick: sign() * between(200, 500),
      spin: sign() * between(20, 110),
      flip0: rand(),
      flipRate: sign() * between(0.5, 1.3),
      lift: between(0.5, 0.8),
      glide: between(50, 110),
      drift: between(-14, 14),
      rock: between(12, 28),
    });
  }
  return pieces;
}
