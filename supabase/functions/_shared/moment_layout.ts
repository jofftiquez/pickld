// What the server needs to draw a moment the way the app's moment renderer does (M2-18), for the finished
// photos in the data export (T-508): the color filter matrices, the overlay styles and the bubble and
// text layout, copied from the app (apps/mobile/src/features/edit and src/theme/tokens.ts). No imports, so
// the app's Jest suite can import this file too: exportRenderSpec.test.ts fails when a copy here drifts
// from the app.

/** Row-major 4×5 Skia color matrices (filters.ts), offsets in 0..1. */
// deno-fmt-ignore
export const FILTER_MATRICES: Record<string, readonly number[]> = {
  original: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  kalamansi: [
    1.126, -0.1682, -0.017, 0, 0.04,
    -0.0505, 1.0176, -0.0171, 0, 0.05,
    -0.0446, -0.1502, 1.0348, 0, 0,
    0, 0, 0, 1, 0,
  ],
  merienda: [
    1.0356, -0.0687, -0.0069, 0, 0.04,
    -0.0191, 0.9225, -0.0065, 0, 0.025,
    -0.0162, -0.0544, 0.8305, 0, 0,
    0, 0, 0, 1, 0,
  ],
  mono: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ],
  dusk: [
    0.7128, 0.121, 0.0122, 0, 0.06,
    0.0347, 0.7705, 0.0118, 0, 0.05,
    0.0383, 0.1287, 0.733, 0, 0.1,
    0, 0, 0, 1, 0,
  ],
  kape: [
    0.6465, 0.1816, 0.0183, 0, 0.08,
    0.0473, 0.6777, 0.0161, 0, 0.05,
    0.0371, 0.1249, 0.42, 0, 0.03,
    0, 0, 0, 1, 0,
  ],
  ube: [
    0.6926, 0.1542, 0.0156, 0, 0.12,
    0.0421, 0.7349, 0.0143, 0, 0.08,
    0.0453, 0.1522, 0.6539, 0, 0.14,
    0, 0, 0, 1, 0,
  ],
  sampaguita: [
    0.9567, -0.0918, -0.0093, 0, 0.08,
    -0.0284, 0.9291, -0.0096, 0, 0.1,
    -0.0281, -0.0945, 1.0037, 0, 0.11,
    0, 0, 0, 1, 0,
  ],
  gabi: [
    0.9061, -0.0601, -0.0061, 0, 0,
    -0.0196, 0.9462, -0.0066, 0, 0,
    -0.0206, -0.0694, 1.0602, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  luma: [
    0.4596, 0.3738, 0.0377, 0, 0.12,
    0.1056, 0.6865, 0.0359, 0, 0.1,
    0.0925, 0.3113, 0.3216, 0, 0.07,
    0, 0, 0, 1, 0,
  ],
  ulan: [
    0.5524, 0.2307, 0.0233, 0, 0.04,
    0.0759, 0.7913, 0.0258, 0, 0.06,
    0.0743, 0.2501, 0.5498, 0, 0.07,
    0, 0, 0, 1, 0,
  ],
  mangga: [
    1.1991, -0.2081, -0.021, 0, 0.03,
    -0.0563, 0.9574, -0.0191, 0, 0.02,
    -0.0446, -0.1502, 0.8948, 0, 0,
    0, 0, 0, 1, 0,
  ],
  dagat: [
    0.9169, -0.088, -0.0089, 0, 0,
    -0.03, 0.9811, -0.0102, 0, 0.03,
    -0.0303, -0.1019, 1.0822, 0, 0.05,
    0, 0, 0, 1, 0,
  ],
  halo: [
    0.7761, 0.0944, 0.0095, 0, 0.12,
    0.0261, 0.784, 0.0089, 0, 0.09,
    0.0264, 0.0888, 0.7128, 0, 0.1,
    0, 0, 0, 1, 0,
  ],
  bukid: [
    0.9423, -0.0904, -0.0091, 0, 0.02,
    -0.0303, 0.9906, -0.0103, 0, 0.05,
    -0.0263, -0.0883, 0.9378, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  abo: [
    0.1839, 0.6185, 0.0624, 0, 0.08,
    0.1858, 0.6251, 0.0631, 0, 0.08,
    0.1877, 0.6313, 0.0637, 0, 0.09,
    0, 0, 0, 1, 0,
  ],
};

/** The app's photo is 3:4 (tokens.photo.aspect = width ÷ height). */
export const PHOTO_ASPECT = 3 / 4;

/**
 * The photo width, in points, the design is measured on (TEXT_REF_WIDTH). Sizes the app gives in fixed
 * points (the bubble's shadow, the 1-point minimum stamp border) scale from it, so the finished photo looks
 * like the moment detail on a 390-point screen.
 */
export const REF_WIDTH = 390;

export const INK = '#11140d'; // colors.ink
export const SURFACE = '#ffffff'; // colors.surface

/** tokens.bubble (layout and look; the panel's sizes are left out). */
export const BUBBLE = {
  referenceWidth: 200,
  fontSize: 17,
  lineHeight: 22,
  paddingX: 16,
  paddingY: 10,
  thoughtPaddingX: 24,
  charWidth: 0.62,
  radius: 20,
  tailRadius: 6,
  tailStart: 16,
  tailEnd: 40,
  tailTipX: 6,
  tailLength: 16,
  tailOverlap: 2,
  thoughtDotX: 40,
  thoughtDotR: 6,
  thoughtDotSmallR: 3.5,
  thoughtDotGap: 2,
  thoughtDotStepX: -14,
  thoughtDotStepY: 11,
  cloudPuffR: 18,
  cloudPuffStep: 1.6,
  cloudPuffSizes: [0.78, 1, 0.86, 0.96],
  shoutRadius: 4,
  shoutSkewDeg: -8,
  whisperRadius: 14,
  whisperBorder: 1.5,
  shadow: { color: '#000000', opacity: 0.22, radius: 24, offsetY: 8 },
} as const;

/** tokens.bubbleColors. */
export const BUBBLE_COLORS: Record<string, { fill: string; text: string }> = {
  white: { fill: '#ffffff', text: '#11140d' },
  ink: { fill: '#11140d', text: '#ffffff' },
  pickle: { fill: '#7fad33', text: '#11140d' },
  butter: { fill: '#ffe08a', text: '#11140d' },
  blush: { fill: '#fdeceb', text: '#11140d' },
  sky: { fill: '#dbe8f3', text: '#11140d' },
};

/** tokens.textOverlayColors. */
export const TEXT_COLORS: Record<string, string> = {
  white: '#ffffff',
  ink: '#11140d',
  gray: '#8e8e93',
  red: '#ed4956',
  orange: '#fd8d32',
  yellow: '#fdcb5c',
  pickle: '#7fad33',
  teal: '#2ec4b6',
  blue: '#3897f0',
  purple: '#a307ba',
  pink: '#e1306c',
  sky: '#dbe8f3',
  butter: '#ffe08a',
  blush: '#fdeceb',
};

/** colors.textOverlayShadow and colors.textOverlayShadowOnDark (under ink text). */
export const TEXT_SHADOW = { light: 'rgba(0,0,0,0.45)', onDark: 'rgba(255,255,255,0.6)' } as const;

/** TextOverlayView: the design's shadow at 30-point text is 0 2px 10px. */
export const TEXT_SHADOW_AT_30 = { offset: 2, radius: 10 } as const;

/** textFonts.ts: Bold is tightened by 0.02 em, Strong opened up by as much. */
export const TEXT_TRACKING: Record<string, number> = {
  clean: 0,
  bold: -0.02,
  type: 0,
  serif: 0,
  script: 0,
  strong: 0.02,
  marker: 0,
  hand: 0,
};

/**
 * textOverlay.ts: the outline is the words drawn STEPS times round a circle WIDTH em out, under the fill;
 * a background's corners are RADIUS em; a soft background is the contrasting color at SOFT_ALPHA.
 */
export const TEXT_STYLE = { outlineWidth: 0.07, outlineSteps: 16, backgroundRadius: 0.25, softAlpha: 0.6 } as const;

/** textOverlay.ts outlineOffsets: where the outline's copies of the words go, in font sizes. */
export function outlineOffsets(): { dx: number; dy: number }[] {
  return Array.from({ length: TEXT_STYLE.outlineSteps }, (_, i) => {
    const a = (2 * Math.PI * i) / TEXT_STYLE.outlineSteps;
    return { dx: TEXT_STYLE.outlineWidth * Math.cos(a), dy: TEXT_STYLE.outlineWidth * Math.sin(a) };
  });
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** textOverlay.ts contrastColor: white or ink, whichever has the higher contrast ratio on the color. */
export function contrastColor(color: string): 'white' | 'ink' {
  const l = luminance(TEXT_COLORS[color] ?? SURFACE);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(INK) + 0.05);
  return onInk >= onWhite ? 'ink' : 'white';
}

/** tokens.stickerTool.stamp: fractions of the stamp's height. */
export const STAMP = { ring: 0.025, inset: 0.07, border: 0.05, radius: 0.16, text: 0.3, padding: 0.2 } as const;

/** stickerRenderer.ts: a sticker whose art is missing keeps this height ÷ width. */
export const STICKER_FALLBACK_ASPECT = 0.4;

// ---------------------------------------------------------------- bubble layout (bubbleLayout.ts)

export function bubblePaddingX(shape: string): number {
  return shape === 'thought' ? BUBBLE.thoughtPaddingX : BUBBLE.paddingX;
}

function charsPerLine(shape: string): number {
  const inner = BUBBLE.referenceWidth - 2 * bubblePaddingX(shape);
  return Math.max(1, Math.floor(inner / (BUBBLE.fontSize * BUBBLE.charWidth)));
}

function countLines(text: string, perLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    let length = Array.from(word).length;
    const needed = used === 0 ? length : used + 1 + length;
    if (needed <= perLine) {
      used = needed;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    while (length > perLine) {
      lines += 1;
      length -= perLine;
    }
    used = length;
  }
  return lines;
}

export function bubbleLines(text: string, shape: string): number {
  return countLines(text, charsPerLine(shape));
}

/** Height ÷ width of a bubble's box. */
export function bubbleAspect(text: string, shape: string): number {
  return (bubbleLines(text, shape) * BUBBLE.lineHeight + 2 * BUBBLE.paddingY) / BUBBLE.referenceWidth;
}

/** Which side a bubble's tail hangs on: its saved side, else the left (bubbles saved before it could flip). */
export function bubbleTailSide(o: { tail?: string }): 'left' | 'right' {
  return o.tail === 'right' ? 'right' : 'left';
}

export type TailPoint = readonly [number, number];
export type TailDot = { readonly cx: number; readonly cy: number; readonly r: number };
export type TailGeometry =
  | { kind: 'point'; points: readonly [TailPoint, TailPoint, TailPoint]; extent: number }
  | { kind: 'dots'; dots: readonly [TailDot, TailDot]; extent: number };

/** Whether a bubble is drawn as a cloud (isCloud): thoughts saved with `cloud`, others stay as they were. */
export function isCloud(o: { shape: string; cloud?: boolean }): boolean {
  return o.shape === 'thought' && o.cloud === true;
}

export type CloudGeometry = {
  core: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  puffs: readonly TailDot[];
};

/** A cloud thought's body in reference units: its middle and the puffs round its edge (cloudGeometry). */
export function cloudGeometry(height: number): CloudGeometry {
  const w = BUBBLE.referenceWidth;
  const big = Math.min(BUBBLE.cloudPuffR, height / 2);
  const sizes = BUBBLE.cloudPuffSizes;
  const between = (length: number, stagger: boolean, place: (t: number, r: number) => TailDot) => {
    const n = Math.max(1, Math.round(length / (BUBBLE.cloudPuffStep * big)));
    const count = stagger ? n : n - 1;
    return Array.from(
      { length: count },
      (_, i) => place((i + (stagger ? 0.5 : 1)) / n, big * (sizes[(i + (stagger ? 2 : 0)) % sizes.length] ?? 1)),
    );
  };
  const across = w - 2 * big;
  const down = height - 2 * big;
  const corner = (cx: number, cy: number): TailDot => ({ cx, cy, r: big });
  const puffs: TailDot[] = [
    corner(big, big),
    ...between(across, false, (t, r) => ({ cx: big + across * t, cy: r, r })),
    corner(w - big, big),
    ...between(down, false, (t, r) => ({ cx: w - r, cy: big + down * t, r })),
    corner(w - big, height - big),
    ...between(across, true, (t, r) => ({ cx: w - big - across * t, cy: height - r, r })),
    corner(big, height - big),
    ...between(down, true, (t, r) => ({ cx: r, cy: height - big - down * t, r })),
  ];
  return { core: { x: big, y: big, width: across, height: down }, puffs };
}

function cloudBottom(height: number, x: number): number {
  let bottom = height - Math.min(BUBBLE.cloudPuffR, height / 2);
  for (const p of cloudGeometry(height).puffs) {
    const dx = x - p.cx;
    if (Math.abs(dx) < p.r) bottom = Math.max(bottom, p.cy + Math.sqrt(p.r * p.r - dx * dx));
  }
  return bottom;
}

/** A bubble's tail in reference units below a box `height` tall (bubbleTailGeometry). */
export function bubbleTailGeometry(
  shape: string,
  side: 'left' | 'right',
  height: number,
  cloud = false,
): TailGeometry {
  const x = (at: number) => (side === 'left' ? at : BUBBLE.referenceWidth - at);
  if (shape !== 'thought') {
    const base = height - BUBBLE.tailOverlap;
    return {
      kind: 'point',
      points: [
        [x(BUBBLE.tailStart), base],
        [x(BUBBLE.tailTipX), height + BUBBLE.tailLength],
        [x(BUBBLE.tailEnd), base],
      ],
      extent: BUBBLE.tailLength,
    };
  }
  const r = height / 2;
  const dx = Math.max(0, r - BUBBLE.thoughtDotX);
  const edge = cloud ? cloudBottom(height, BUBBLE.thoughtDotX) : r + Math.sqrt(Math.max(0, r * r - dx * dx));
  const large = {
    cx: x(BUBBLE.thoughtDotX),
    cy: edge + BUBBLE.thoughtDotGap + BUBBLE.thoughtDotR,
    r: BUBBLE.thoughtDotR,
  };
  const small = {
    cx: x(BUBBLE.thoughtDotX + BUBBLE.thoughtDotStepX),
    cy: large.cy + BUBBLE.thoughtDotStepY,
    r: BUBBLE.thoughtDotSmallR,
  };
  return { kind: 'dots', dots: [large, small], extent: small.cy + small.r - height };
}

// ---------------------------------------------------------------- text layout (textOverlay.ts)

const LINE_HEIGHT = 1.25;
const PAD_X = 0.3;
const PAD_Y = 0.15;
const BACKGROUND_PAD_X = 0.4;
const BACKGROUND_PAD_Y = 0.25;
const MAX_LINE_WIDTH = 0.8 * REF_WIDTH;
const GLYPH = {
  clean: 0.6,
  bold: 0.64,
  type: 0.62,
  serif: 0.54,
  script: 0.57,
  strong: 0.5,
  marker: 0.6,
  hand: 0.45,
} as const;

function glyphWidth(ch: string, font: string): number {
  if (font === 'type') return GLYPH.type;
  if (ch === ' ') return 0.3;
  return (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1.15 : (GLYPH as Record<string, number | undefined>)[font] ?? GLYPH.bold;
}

function measure(s: string, font: string): number {
  let em = 0;
  for (const ch of s) em += glyphWidth(ch, font);
  return em;
}

export interface TextLayout {
  lines: string[];
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  padX: number;
  padY: number;
}

/** The app's line breaks and box for a text overlay, in points on the 390-point photo. */
export function layoutText({
  text,
  font,
  size,
  background,
}: {
  text: string;
  font: string;
  size: number;
  background?: string;
}): TextLayout {
  const maxEm = MAX_LINE_WIDTH / size;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate, font) <= maxEm || line === '') {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      while (measure(line, font) > maxEm && Array.from(line).length > 1) {
        const chars = Array.from(line);
        let fit = 1;
        while (fit < chars.length && measure(chars.slice(0, fit + 1).join(''), font) <= maxEm) fit += 1;
        lines.push(chars.slice(0, fit).join(''));
        line = chars.slice(fit).join('');
      }
    }
    lines.push(line);
  }
  const widest = Math.max(...lines.map((l) => measure(l, font)));
  const boxed = background !== undefined && background !== 'none';
  const padX = (boxed ? BACKGROUND_PAD_X : PAD_X) * size;
  const padY = (boxed ? BACKGROUND_PAD_Y : PAD_Y) * size;
  return {
    lines,
    width: widest * size + 2 * padX,
    height: lines.length * LINE_HEIGHT * size + 2 * padY,
    fontSize: size,
    lineHeight: LINE_HEIGHT * size,
    padX,
    padY,
  };
}

// ---------------------------------------------------------------- auto stamps (stamps.ts)

/**
 * The live text of a time, date or weekday stamp: the capture time in the jar's IANA zone, as the moment
 * detail shows it (it gives no jar number, so a jar-number stamp shows its art). Null for other kinds.
 */
export function stampText(kind: string, capturedAt: Date, tz: string, locale = 'en-US'): string | null {
  switch (kind) {
    case 'time':
      return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: tz })
        .format(capturedAt).toUpperCase();
    case 'date':
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: tz })
        .format(capturedAt).replace('.', '').toUpperCase();
    case 'weekday':
      return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz }).format(capturedAt).toUpperCase();
    default:
      return null;
  }
}
