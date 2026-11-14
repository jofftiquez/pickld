// Share to Stories (T-509; FR-SOC-10): what the shared image looks like. Sizes are in pixels of the
// exported image (1080 wide); the view multiplies them by `unit` so the same picture is drawn at any size.
import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors, slots } from '@/theme/tokens';

import { onCard, type ShareCard } from './shareCard';

export const storyFormats = ['story', 'feed'] as const;
export type StoryFormat = (typeof storyFormats)[number];

/** Blurred photo is the default; the order is the order of the swatches. */
export const storyBackgrounds = ['blur', 'lid', 'paper', 'ink', 'print'] as const;
export type StoryBackground = (typeof storyBackgrounds)[number];

/** Width of every exported image, in pixels (Instagram's Story and feed width). */
export const EXPORT_WIDTH = 1080;

export function canvasSize(format: StoryFormat): { width: number; height: number } {
  // Story 9:16 (1080×1920), feed post 4:5 (1080×1350).
  return { width: EXPORT_WIDTH, height: format === 'story' ? 1920 : 1350 };
}

/**
 * Where names and captions may go. On a Story, Instagram and Facebook draw the profile bar over the top 13%
 * and the reply bar over the bottom 18%; text stays out of both. A feed post only needs a margin. Photos are
 * not held to this: they fill the card (D-82).
 */
export function safeInsets(format: StoryFormat): { top: number; bottom: number; side: number } {
  return format === 'story' ? { top: 250, bottom: 346, side: 48 } : { top: 48, bottom: 48, side: 48 };
}

/**
 * Fixed sizes of what the card prints, in exported pixels. Text on the card never follows the system text
 * size, so these heights are known before anything is drawn. Names and captions are compact overlays on
 * the photos (D-82), each on its own pill so it reads on any photo.
 */
export const storyMetrics = {
  /** Around the photos, at the card's edge. */
  margin: 24,
  /** Between photos. */
  tileGap: 12,
  /** Between the Print background's paper card and the photos. */
  printPad: 24,
  /** Author pill: avatar beside the name (34 px) over the date (26 px). */
  avatar: 64,
  nameSize: 34,
  dateSize: 26,
  pillPad: 12,
  pillPadX: 24,
  /** Footer row: the link or slot pill and the wordmark pill. */
  footerHeight: 72,
  footerSize: 28,
  logoWidth: 120,
  logoAspect: 1200 / 496,
  /** Caption band over the footer: up to 3 lines of 32 px. */
  captionSize: 32,
  captionLines: 3,
  captionPad: 16,
  /** Between the caption band and the footer row. */
  overlayGap: 12,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** The card's safe area: inside `safeInsets`, the only place names and captions are drawn. */
export function safeArea(format: StoryFormat): Rect {
  const size = canvasSize(format);
  const safe = safeInsets(format);
  return { x: safe.side, y: safe.top, width: size.width - 2 * safe.side, height: size.height - safe.top - safe.bottom };
}

/** The card less its outer margin; the Print background's paper card fills it. */
export function frameArea(format: StoryFormat): Rect {
  const size = canvasSize(format);
  const m = storyMetrics.margin;
  return { x: m, y: m, width: size.width - 2 * m, height: size.height - 2 * m };
}

/** Where the photos may go: the whole card less a small margin (and the Print card's padding). */
export function photoArea(format: StoryFormat, options: { framed: boolean }): Rect {
  const frame = frameArea(format);
  const pad = options.framed ? storyMetrics.printPad : 0;
  return { x: frame.x + pad, y: frame.y + pad, width: frame.width - 2 * pad, height: frame.height - 2 * pad };
}

/** The most room each overlay can take; each hugs its text inside its box, anchored to the box's left. */
export type StoryOverlays = { author: Rect; caption: Rect; footer: Rect };

/** The author pill at the top of the safe area; the footer row, and the caption band over it, at the bottom. */
export function overlayRects(format: StoryFormat): StoryOverlays {
  const m = storyMetrics;
  const safe = safeArea(format);
  const authorHeight = Math.max(m.avatar, (m.nameSize + m.dateSize) * 1.3) + 2 * m.pillPad;
  const captionHeight = m.captionLines * m.captionSize * 1.3 + 2 * m.captionPad;
  const footerY = safe.y + safe.height - m.footerHeight;
  return {
    author: { x: safe.x, y: safe.y, width: safe.width, height: authorHeight },
    caption: { x: safe.x, y: footerY - m.overlayGap - captionHeight, width: safe.width, height: captionHeight },
    footer: { x: safe.x, y: footerY, width: safe.width, height: m.footerHeight },
  };
}

export const storyLayoutIds = [
  'full',
  'sideBySide',
  'stacked',
  'oneLargeTwo',
  'threeStacked',
  'threeRow',
  'grid2x2',
  'oneLargeThree',
  'grid2x3',
  'oneLargeStrip',
  'grid2x4',
  'grid4x2',
  'filmStrip',
] as const;
export type StoryLayoutId = (typeof storyLayoutIds)[number];

export type StoryLayout = {
  id: StoryLayoutId;
  /** Its name, e.g. "2 by 2 grid". */
  labelKey: `share.layout.${StoryLayoutId}`;
  /** One rectangle per photo, in the card's order (the cover first), in exported pixels of the whole card. */
  cells: Rect[];
};

/**
 * A grid of `cols` × `rows` cells, each `unit` times as tall as it is wide; a cell spans whole cells.
 * `stretch` is the range a cell's height-to-width ratio may grow or shrink to, so the grid fills the card.
 */
type Grid = {
  cols: number;
  rows: number;
  unit: number;
  stretch: readonly [min: number, max: number];
  cells: [col: number, row: number, cols: number, rows: number][];
};

const PORTRAIT = 4 / 3; // 3:4 cells, the photo's own shape
const LANDSCAPE = 3 / 4; // 4:3 cells for stacked layouts, so they stay wide enough
/** Cells may become anything from 16:9 to 9:16 to fill the card; photos are cropped, centred, to fit. */
const STRETCH = [9 / 16, 16 / 9] as const;
/** A single moment stays whole at 3:4. */
const WHOLE = [PORTRAIT, PORTRAIT] as const;

/** `count` cells filled row by row, `cols` to a row; a short last row is centred. */
function rowsOf(count: number, cols: number, unit: number, stretch: Grid['stretch'] = STRETCH): Grid {
  const rows = Math.ceil(count / cols);
  const cells: Grid['cells'] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    cells.push([(cols - inRow) / 2 + (i % cols), row, 1, 1]);
  }
  return { cols, rows, unit, stretch, cells };
}

/** One large photo with the other `count - 1` in a row below it. */
function largeAndStrip(count: number): Grid {
  const n = count - 1;
  const cells: Grid['cells'] = [[0, 0, n, n]];
  for (let i = 0; i < n; i++) cells.push([i, n, 1, 1]);
  return { cols: n, rows: n + 1, unit: PORTRAIT, stretch: STRETCH, cells };
}

/**
 * The grid as large as it fits in `area` (D-82): first at its own cell shape, then stretched within its
 * range along the side that still has room, so it fills the card's width or height and usually both.
 * Gaps stay `tileGap`. Centred across; up and down it is centred on `focusY` (the middle of what a Story
 * leaves uncovered) as far as the area allows.
 */
function place(grid: Grid, area: Rect, focusY: number): Rect[] {
  const g = storyMetrics.tileGap;
  const byWidth = (area.width - (grid.cols - 1) * g) / grid.cols;
  const byHeight = (area.height - (grid.rows - 1) * g) / grid.rows;
  const [lo, hi] = grid.stretch;
  let w: number;
  let h: number;
  if (byWidth * grid.unit <= byHeight) {
    w = byWidth;
    h = Math.min(byHeight, w * hi);
  } else {
    h = byHeight;
    w = Math.min(byWidth, h / lo);
  }
  w = Math.max(0, w);
  h = Math.max(0, h);
  const total = { width: grid.cols * w + (grid.cols - 1) * g, height: grid.rows * h + (grid.rows - 1) * g };
  const left = area.x + (area.width - total.width) / 2;
  const top = Math.min(Math.max(focusY - total.height / 2, area.y), area.y + area.height - total.height);
  return grid.cells.map(([col, row, cols, rows]) => ({
    x: left + col * (w + g),
    y: top + row * (h + g),
    width: cols * w + (cols - 1) * g,
    height: rows * h + (rows - 1) * g,
  }));
}

function gridsFor(count: number): [StoryLayoutId, Grid][] {
  switch (count) {
    case 1:
      return [['full', rowsOf(1, 1, PORTRAIT, WHOLE)]];
    case 2:
      return [
        ['sideBySide', rowsOf(2, 2, PORTRAIT)],
        ['stacked', rowsOf(2, 1, LANDSCAPE)],
      ];
    case 3:
      return [
        ['oneLargeTwo', largeAndStrip(3)],
        ['threeStacked', rowsOf(3, 1, LANDSCAPE)],
        ['threeRow', rowsOf(3, 3, PORTRAIT)],
      ];
    case 4:
      return [
        ['grid2x2', rowsOf(4, 2, PORTRAIT)],
        ['oneLargeThree', largeAndStrip(4)],
      ];
    case 5:
    case 6:
      return [
        ['grid2x3', rowsOf(count, 3, PORTRAIT)],
        ['oneLargeStrip', largeAndStrip(count)],
      ];
    default:
      return [
        // The 4 by 2 grid leads: it fills about 90% of the card where the 2 by 4 grid fills 42% (D-88).
        ['grid4x2', rowsOf(count, 2, PORTRAIT)],
        ['grid2x4', rowsOf(count, 4, PORTRAIT)],
        ['filmStrip', rowsOf(count, 1, LANDSCAPE)],
      ];
  }
}

/**
 * The layouts a card with `count` photos can use, the default first (D-62). Each gives every photo's
 * rectangle on the card; the card draws the photos there and the exported image is that same view, so the
 * preview and the file match. Photos fill the card less a thin margin (D-82) and are cropped, centred, into
 * their cells; one moment alone stays whole at 3:4.
 */
export function layoutsFor(
  count: number,
  format: StoryFormat,
  options: { framed: boolean } = { framed: false },
): StoryLayout[] {
  const n = Math.min(slots.length, Math.max(1, Math.round(count)));
  const area = photoArea(format, options);
  const safe = safeArea(format);
  const focusY = safe.y + safe.height / 2;
  return gridsFor(n).map(([id, grid]) => ({ id, labelKey: `share.layout.${id}`, cells: place(grid, area, focusY) }));
}

/** Points per exported pixel: draws the image at 1080 pixels wide on a screen with this pixel ratio. */
export function exportUnit(pixelRatio: number): number {
  return 1 / pixelRatio;
}

export type StoryPalette = {
  /** Solid fill behind everything (under the blurred photo for `blur` and `print`). */
  fill: string;
  /** A blurred copy of the photo fills the background. */
  blurred: boolean;
  /** Darkens the blurred photo so white text reads on it. */
  scrim: string | null;
  /** A paper card holds the content (`print`). */
  card: string | null;
  /** The pill under names, the caption and the wordmark, so they read on any photo (D-82). */
  pill: string;
  /** Text on the pills. */
  text: string;
  /** Wordmark tint; null keeps its own brand green (on a white pill). */
  logoTint: string | null;
};

/** The profile's lid color, or the default lid when it isn't one of the lid colors. */
export function lidOf(value: string | null | undefined): string {
  const lids: readonly string[] = Object.values(lidColors);
  const lower = value?.toLowerCase() ?? '';
  return lids.includes(lower) ? lower : lidColors.pickle;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Ink or white, whichever has more contrast on a solid hex color. */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(colors.ink) + 0.05);
  return onInk >= onWhite ? colors.ink : colors.surface;
}

export function paletteFor(background: StoryBackground, lidColor: string | null | undefined): StoryPalette {
  switch (background) {
    case 'blur':
      return {
        fill: colors.camera,
        blurred: true,
        scrim: colors.glass,
        card: null,
        pill: colors.glassStrong,
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'lid': {
      const lid = lidOf(lidColor);
      const text = readableOn(lid);
      return { fill: lid, blurred: false, scrim: null, card: null, pill: lid, text, logoTint: text };
    }
    case 'paper':
      return {
        fill: colors.background,
        blurred: false,
        scrim: null,
        card: null,
        pill: colors.surface,
        text: colors.ink,
        logoTint: null,
      };
    case 'ink':
      return {
        fill: colors.ink,
        blurred: false,
        scrim: null,
        card: null,
        pill: colors.glassStrong,
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'print':
      return {
        fill: colors.camera,
        blurred: true,
        scrim: colors.glass,
        card: colors.surface,
        pill: colors.surface,
        text: colors.ink,
        logoTint: null,
      };
  }
}

/** The caption the card prints: the moment's own when sharing one and captions are on, else the jar's. */
export function cardCaption(card: ShareCard, moment: JarMoment | null, includeCaption: boolean): string | null {
  if (!moment) return card.caption;
  return includeCaption ? moment.caption?.trim() || null : null;
}

/** The moment to share on its own, or null when it can't leave its owner (private, checking or removed). */
export function shareableMoment(moments: readonly JarMoment[], id: string | undefined): JarMoment | null {
  const moment = moments.find((m) => m.id === id);
  return moment && onCard(moment) ? moment : null;
}
