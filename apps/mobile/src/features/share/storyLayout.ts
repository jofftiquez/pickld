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
 * What a Story's bars leave uncovered: Instagram and Facebook draw the profile bar over about the top 250 px
 * and the reply bar over about the bottom 250 px of 1080×1920. Everything on the card, photos and words, stays
 * inside (D-90); a post only needs a margin.
 */
export function safeInsets(format: StoryFormat): { top: number; bottom: number; side: number } {
  return format === 'story' ? { top: 250, bottom: 250, side: 48 } : { top: 48, bottom: 48, side: 48 };
}

/**
 * Fixed sizes of what the card prints, in exported pixels. Text on the card never follows the system text
 * size, so these heights are known before anything is drawn. The words sit under the photos, never on them
 * (D-90): the caption over a row with the title and date on the left and the wordmark and link on the right.
 */
export const storyMetrics = {
  /** Between photos, across and down. */
  tileGap: 12,
  /** Between the photos and the words under them. */
  textGap: 36,
  /** The Print background's paper card around the photos and words. */
  printPad: 40,
  /** Title (the jar's name, or the author's on a moment) and the date line under it. */
  titleSize: 52,
  titleLineHeight: 1.2,
  subSize: 32,
  /** Up to two lines of caption over the title row. */
  captionSize: 38,
  captionLines: 2,
  captionGap: 16,
  /** Body text line height. */
  lineHeight: 1.3,
  /** Wordmark over the link, at the right of the title row. */
  logoWidth: 140,
  logoAspect: 1200 / 496,
  linkSize: 28,
  /** The words never get narrower than this, even under a narrow block of photos. */
  textMinWidth: 720,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** The card's safe area: inside `safeInsets`, where everything on the card goes. */
export function safeArea(format: StoryFormat): Rect {
  const size = canvasSize(format);
  const safe = safeInsets(format);
  return { x: safe.side, y: safe.top, width: size.width - 2 * safe.side, height: size.height - safe.top - safe.bottom };
}

/** Height of the title row: the title over the date line. */
export function titleRowHeight(): number {
  const m = storyMetrics;
  return m.titleSize * m.titleLineHeight + m.subSize * m.lineHeight;
}

/**
 * How many lines the caption takes at `width` (0 without one, at most 2). Counted generously, at 0.6 of the
 * font size a character, so the text never needs more room than the layout kept for it; the card cuts it off
 * at this many lines.
 */
export function captionLinesFor(caption: string | null | undefined, width: number): number {
  const text = caption?.trim() ?? '';
  if (!text) return 0;
  const m = storyMetrics;
  const perLine = Math.max(1, Math.floor(width / (m.captionSize * 0.6)));
  return Math.min(m.captionLines, Math.ceil((text.length + 2) / perLine));
}

/** Height of the words under the photos: the caption's lines (if any) over the title row. */
export function textHeight(captionLines: number): number {
  const m = storyMetrics;
  const caption = captionLines > 0 ? captionLines * m.captionSize * m.lineHeight + m.captionGap : 0;
  return caption + titleRowHeight();
}

export const storyLayoutIds = [
  'full',
  'sideBySide',
  'stacked',
  'oneLargeTwo',
  'twoAndOne',
  'threeRow',
  'grid2x2',
  'oneLargeThree',
  'oneLargeStrip',
  'grid2x3',
  'grid3x3',
  'oneLargeGrid',
  'grid2x4',
] as const;
export type StoryLayoutId = (typeof storyLayoutIds)[number];

export type StoryLayout = {
  id: StoryLayoutId;
  /** Its name, e.g. "2 by 2 grid". */
  labelKey: `share.layout.${StoryLayoutId}`;
  /** One rectangle per photo, in the card's order (the cover first), in exported pixels of the whole card. */
  cells: Rect[];
  /** The words under the photos: the caption, then the title row. */
  text: Rect;
  /** Lines kept for the caption (0 when there is none). */
  captionLines: number;
  /** The Print background's paper card around the photos and words, or null on the other backgrounds. */
  card: Rect | null;
};

/**
 * A layout's photos: rows of 3:4 cells `cols` wide, `rows[i]` cells in row i (a short row is centred), under
 * an optional large photo as wide as the rows and 3:4 too.
 */
type Grid = { cols: number; rows: number[]; large?: boolean };

/** Every photo keeps its own 3:4 shape: never stretched or cropped to fill the card (D-89). */
const PORTRAIT = 4 / 3;

/** `count` cells filled row by row, `cols` to a row; a short last row is centred. */
function rowsOf(count: number, cols: number): Grid {
  const rows: number[] = [];
  for (let left = count; left > 0; left -= cols) rows.push(Math.min(cols, left));
  return { cols, rows };
}

/** One large photo over the other `count - 1` in rows of `cols`. */
function largeOver(count: number, cols: number): Grid {
  return { ...rowsOf(count - 1, cols), large: true };
}

/** Width of the grid's small cells when it fills `box`, with every photo at 3:4. */
function cellWidth(grid: Grid, box: { width: number; height: number }): number {
  const g = storyMetrics.tileGap;
  const n = grid.rows.length;
  const byWidth = (box.width - (grid.cols - 1) * g) / grid.cols;
  // Height for small cells `w` wide: n rows of w·4/3 with gaps, plus the large photo (cols·w + gaps, 3:4).
  const byHeight = grid.large
    ? (box.height - (grid.cols - 1) * g * PORTRAIT - n * g) / ((grid.cols + n) * PORTRAIT)
    : (box.height - (n - 1) * g) / (n * PORTRAIT);
  return Math.max(0, Math.min(byWidth, byHeight));
}

/** The grid's cells for small cells `w` wide, its top-left corner at (0, 0), and the block's size. */
function cellsOf(grid: Grid, w: number): { cells: Rect[]; width: number; height: number } {
  const g = storyMetrics.tileGap;
  const h = w * PORTRAIT;
  const width = grid.cols * w + (grid.cols - 1) * g;
  const cells: Rect[] = [];
  let y = 0;
  if (grid.large) {
    cells.push({ x: 0, y: 0, width, height: width * PORTRAIT });
    y = width * PORTRAIT + g;
  }
  for (const inRow of grid.rows) {
    const left = ((grid.cols - inRow) * (w + g)) / 2;
    for (let i = 0; i < inRow; i++) cells.push({ x: left + i * (w + g), y, width: w, height: h });
    y += h + g;
  }
  return { cells, width, height: y - g };
}

/**
 * The layouts for `count` photos, the default first (D-62). Only layouts whose photos fill the safe area well
 * at 3:4 are offered (D-91): a Story drops what leaves a thin band or a narrow column (three in a row, the 2 by 4
 * grid), a post drops stacked. Three stacked, the 4 by 2 grid and the film strip are gone on both.
 */
function gridsFor(count: number, format: StoryFormat): [StoryLayoutId, Grid][] {
  const story = format === 'story';
  switch (count) {
    case 1:
      return [['full', rowsOf(1, 1)]];
    case 2:
      return story
        ? [
            ['sideBySide', rowsOf(2, 2)],
            ['stacked', rowsOf(2, 1)],
          ]
        : [['sideBySide', rowsOf(2, 2)]];
    case 3:
      return [
        ['oneLargeTwo', largeOver(3, 2)],
        ['twoAndOne', rowsOf(3, 2)],
        ...(story ? [] : [['threeRow', rowsOf(3, 3)] as [StoryLayoutId, Grid]]),
      ];
    case 4:
      return [
        ['grid2x2', rowsOf(4, 2)],
        ['oneLargeThree', largeOver(4, 3)],
      ];
    case 5:
      return [
        ['oneLargeStrip', largeOver(5, 4)],
        ['grid2x3', rowsOf(5, 3)],
      ];
    case 6:
      return [
        ['grid2x3', rowsOf(6, 3)],
        ['oneLargeStrip', largeOver(6, 5)],
      ];
    default: {
      // 7: 2, 3 and 2; 8: 3, 2 and 3. The middle row is full or short, so the block stays symmetric.
      const nine: Grid = { cols: 3, rows: count === 7 ? [2, 3, 2] : [3, 2, 3] };
      return [
        ['grid3x3', nine],
        ['oneLargeGrid', largeOver(count, count === 7 ? 3 : 4)],
        ...(story ? [] : [['grid2x4', rowsOf(count, 4)] as [StoryLayoutId, Grid]]),
      ];
    }
  }
}

/**
 * Places the photos and the words as one block in the middle of the safe area (D-90): the photos as large as
 * they fit at 3:4, the words under them, as wide as the photos (at least `textMinWidth`) and centred with them.
 * With the Print background, a paper card holds both, `printPad` around them; on a Story the card may reach
 * into the covered bands, since nothing on its edge matters.
 */
function place(
  grid: Grid,
  format: StoryFormat,
  framed: boolean,
  caption: string | null,
): Omit<StoryLayout, 'id' | 'labelKey'> {
  const m = storyMetrics;
  const safe = safeArea(format);
  const pad = framed ? m.printPad : 0;
  const area = { x: safe.x + pad, y: safe.y, width: safe.width - 2 * pad, height: safe.height };
  if (framed && format === 'feed') {
    area.y += pad;
    area.height -= 2 * pad;
  }
  // Keep room for the caption's lines, measured at the width the words will have; a narrower block of
  // photos can wrap it onto a second line, so measure again once.
  let lines = captionLinesFor(caption, area.width);
  let w = 0;
  let block = { cells: [] as Rect[], width: 0, height: 0 };
  let textWidth = area.width;
  for (let pass = 0; pass < 2; pass++) {
    w = cellWidth(grid, { width: area.width, height: area.height - m.textGap - textHeight(lines) });
    block = cellsOf(grid, w);
    textWidth = Math.min(area.width, Math.max(block.width, m.textMinWidth));
    const again = captionLinesFor(caption, textWidth);
    if (again <= lines) break;
    lines = again;
  }
  const tall = block.height + m.textGap + textHeight(lines);
  const top = area.y + (area.height - tall) / 2;
  const left = area.x + (area.width - block.width) / 2;
  const cells = block.cells.map((c) => ({ ...c, x: c.x + left, y: c.y + top }));
  const text = {
    x: area.x + (area.width - textWidth) / 2,
    y: top + block.height + m.textGap,
    width: textWidth,
    height: textHeight(lines),
  };
  const contentX = Math.min(left, text.x);
  const contentWidth = Math.max(block.width, textWidth);
  const card = framed
    ? { x: contentX - pad, y: top - pad, width: contentWidth + 2 * pad, height: tall + 2 * pad }
    : null;
  return { cells, text, captionLines: lines, card };
}

/**
 * The layouts a card with `count` photos can use, the default first (D-62). Each gives every photo's
 * rectangle on the card and where the words go; the card draws them there and the exported image is that
 * same view, so the preview and the file match. Every photo stays whole at its own 3:4 shape (D-89), and
 * everything stays inside the safe area (D-90). `caption` is the caption the card prints, so the photos leave
 * room for its lines.
 */
export function layoutsFor(
  count: number,
  format: StoryFormat,
  options: { framed?: boolean; caption?: string | null } = {},
): StoryLayout[] {
  const n = Math.min(slots.length, Math.max(1, Math.round(count)));
  return gridsFor(n, format).map(([id, grid]) => ({
    id,
    labelKey: `share.layout.${id}`,
    ...place(grid, format, options.framed ?? false, options.caption ?? null),
  }));
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
  /** The words under the photos, straight on the background (or the Print card), never on a photo (D-90). */
  text: string;
  /** Wordmark tint; null keeps its own brand green (on a light background). */
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
        // Darker than the Print background's, since white words sit straight on it.
        scrim: colors.glassStrong,
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
      return {
        fill: colors.background,
        blurred: false,
        scrim: null,
        card: null,
        text: colors.ink,
        logoTint: null,
      };
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
