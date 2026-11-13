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
 * Space kept clear of names and captions. On a Story, Instagram and Facebook draw the profile bar over
 * the top ~13% and the reply bar over the bottom ~18%; a feed post only needs a margin.
 */
export function safeInsets(format: StoryFormat): { top: number; bottom: number; side: number } {
  return format === 'story' ? { top: 250, bottom: 340, side: 72 } : { top: 72, bottom: 72, side: 72 };
}

/**
 * Fixed sizes of what the card prints around the photos, in exported pixels. Text on the card never
 * follows the system text size, so these heights are known before anything is drawn.
 */
export const storyMetrics = {
  /** Author row: the name (40 px, 1.3 line height) over the date (30 px). */
  authorBand: 40 * 1.3 + 30 * 1.3,
  avatar: 88,
  /** Wordmark at the bottom; its height sets the footer row. */
  logoWidth: 160,
  logoAspect: 1200 / 496,
  /** Room kept for the caption under the footer row: up to 3 lines of 34 px. */
  captionSize: 34,
  captionLines: 3,
  captionGap: 16,
  /** Between the author row, the photos and the footer. */
  bandGap: 32,
  /** Between photos. */
  tileGap: 16,
  /** Inside the paper card of the Print background. */
  printPad: 40,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** The card's safe area: inside `safeInsets`, where names, captions and photos are drawn. */
export function safeArea(format: StoryFormat): Rect {
  const size = canvasSize(format);
  const safe = safeInsets(format);
  return { x: safe.side, y: safe.top, width: size.width - 2 * safe.side, height: size.height - safe.top - safe.bottom };
}

/**
 * Where the photos may go: the safe area less the Print card's padding, the author row at the top and the
 * footer (link or slot, wordmark, and room for 3 caption lines when there is a caption) at the bottom.
 */
export function photoArea(format: StoryFormat, options: { framed: boolean; caption: boolean }): Rect {
  const m = storyMetrics;
  const safe = safeArea(format);
  const pad = options.framed ? m.printPad : 0;
  const footer =
    m.logoWidth / m.logoAspect + (options.caption ? m.captionGap + m.captionLines * m.captionSize * 1.3 : 0);
  const top = safe.y + pad + m.authorBand + m.bandGap;
  const bottom = safe.y + safe.height - pad - footer - m.bandGap;
  return { x: safe.x + pad, y: top, width: safe.width - 2 * pad, height: bottom - top };
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

/** A grid of `cols` × `rows` cells, each `unit` times as tall as it is wide; a cell spans whole cells. */
type Grid = {
  cols: number;
  rows: number;
  unit: number;
  cells: [col: number, row: number, cols: number, rows: number][];
};

const PORTRAIT = 4 / 3; // 3:4 cells, the photo's own shape
const LANDSCAPE = 3 / 4; // 4:3 cells for stacked layouts, so they stay wide enough

/** `count` cells filled row by row, `cols` to a row; a short last row is centred. */
function rowsOf(count: number, cols: number, unit: number): Grid {
  const rows = Math.ceil(count / cols);
  const cells: Grid['cells'] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    cells.push([(cols - inRow) / 2 + (i % cols), row, 1, 1]);
  }
  return { cols, rows, unit, cells };
}

/** One large 3:4 photo with the other `count - 1` in a row below it. */
function largeAndStrip(count: number): Grid {
  const n = count - 1;
  const cells: Grid['cells'] = [[0, 0, n, n]];
  for (let i = 0; i < n; i++) cells.push([i, n, 1, 1]);
  return { cols: n, rows: n + 1, unit: PORTRAIT, cells };
}

/** The grid at the largest size that fits `area`, centred in it. Gaps stay `tileGap` at any size. */
function place(grid: Grid, area: Rect): Rect[] {
  const g = storyMetrics.tileGap;
  const byWidth = (area.width - (grid.cols - 1) * g) / grid.cols;
  const byHeight = (area.height - (grid.rows - 1) * g) / grid.rows / grid.unit;
  const w = Math.max(0, Math.min(byWidth, byHeight));
  const h = w * grid.unit;
  const left = area.x + (area.width - (grid.cols * w + (grid.cols - 1) * g)) / 2;
  const top = area.y + (area.height - (grid.rows * h + (grid.rows - 1) * g)) / 2;
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
      return [['full', rowsOf(1, 1, PORTRAIT)]];
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
        ['grid2x4', rowsOf(count, 4, PORTRAIT)],
        ['grid4x2', rowsOf(count, 2, PORTRAIT)],
        ['filmStrip', rowsOf(count, 1, LANDSCAPE)],
      ];
  }
}

/**
 * The layouts a card with `count` photos can use, the default first (D-62). Each gives every photo's
 * rectangle inside the safe area; the card draws the photos there and the exported image is that same
 * view, so the preview and the file match. Photos are 3:4 and are cropped, centred, into other shapes.
 */
export function layoutsFor(
  count: number,
  format: StoryFormat,
  options: { framed: boolean; caption: boolean } = { framed: false, caption: false },
): StoryLayout[] {
  const n = Math.min(slots.length, Math.max(1, Math.round(count)));
  const area = photoArea(format, options);
  return gridsFor(n).map(([id, grid]) => ({ id, labelKey: `share.layout.${id}`, cells: place(grid, area) }));
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
  text: string;
  /** Wordmark tint; null keeps its own brand green (on light paper). */
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
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'lid': {
      const lid = lidOf(lidColor);
      const text = readableOn(lid);
      return { fill: lid, blurred: false, scrim: null, card: null, text, logoTint: text };
    }
    case 'paper':
      return { fill: colors.background, blurred: false, scrim: null, card: null, text: colors.ink, logoTint: null };
    case 'ink':
      return {
        fill: colors.ink,
        blurred: false,
        scrim: null,
        card: null,
        text: colors.surface,
        logoTint: colors.surface,
      };
    case 'print':
      return {
        fill: colors.camera,
        blurred: true,
        scrim: colors.glass,
        card: colors.surface,
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
