import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors } from '@/theme/tokens';

import {
  canvasSize,
  frameArea,
  layoutsFor,
  lidOf,
  overlayRects,
  paletteFor,
  photoArea,
  readableOn,
  safeArea,
  safeInsets,
  shareableMoment,
  storyBackgrounds,
  storyFormats,
  type Rect,
} from '../storyLayout';

const moment = (over: Partial<JarMoment>): JarMoment => ({
  id: 'm',
  slot: 'ootd',
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  caption: null,
  captured_at: null,
  added_at: '2026-11-08T01:00:00Z',
  edits: null,
  like_count: 0,
  thumbUrl: 'https://cdn/t.jpg',
  fullUrl: 'https://cdn/f.jpg',
  ...over,
});

describe('Share to Stories layout (T-509)', () => {
  it('exports a 1080×1920 Story and a 1080×1350 post, with text kept out of the Story’s covered bands', () => {
    expect(canvasSize('story')).toEqual({ width: 1080, height: 1920 });
    expect(canvasSize('feed')).toEqual({ width: 1080, height: 1350 });
    const story = safeInsets('story');
    // Instagram's profile bar and reply bar: at least 13% at the top and 18% at the bottom stay clear.
    expect(story.top / 1920).toBeGreaterThanOrEqual(0.13);
    expect(story.bottom / 1920).toBeGreaterThanOrEqual(0.18);
  });

  it('offers five backgrounds, the blurred photo first', () => {
    expect(storyBackgrounds).toEqual(['blur', 'lid', 'paper', 'ink', 'print']);
    expect(paletteFor('blur', null)).toMatchObject({ blurred: true, text: colors.surface });
    expect(paletteFor('print', null)).toMatchObject({ blurred: true, card: colors.surface, text: colors.ink });
    // Names and captions sit on pills over the photos (D-82): dark glass with white text, or white with ink.
    expect(paletteFor('blur', null)).toMatchObject({ pill: colors.glassStrong });
    expect(paletteFor('ink', null)).toMatchObject({ pill: colors.glassStrong, text: colors.surface });
    expect(paletteFor('paper', null)).toMatchObject({ pill: colors.surface, text: colors.ink });
    expect(paletteFor('print', null)).toMatchObject({ pill: colors.surface });
  });

  it('fills Lid color with the author’s lid and the more readable of ink or white on it', () => {
    expect(paletteFor('lid', lidColors.ink)).toMatchObject({ fill: lidColors.ink, text: colors.surface });
    expect(paletteFor('lid', lidColors.ube)).toMatchObject({ fill: lidColors.ube, text: colors.ink });
    expect(paletteFor('lid', lidColors.mango)).toMatchObject({ fill: lidColors.mango, text: colors.ink });
    expect(paletteFor('lid', '#ABCDEF').fill).toBe(lidColors.pickle);
    expect(paletteFor('lid', lidColors.ube).pill).toBe(lidColors.ube);
    expect(lidOf('#F2B632')).toBe(lidColors.mango);
    expect(lidOf(null)).toBe(lidColors.pickle);
    expect(readableOn(lidColors.ink)).toBe(colors.surface);
    expect(readableOn('#ffffff')).toBe(colors.ink);
  });

  it('shares a moment on its own only when it is live and not private, even for its owner', () => {
    const moments = [
      moment({ id: 'live' }),
      moment({ id: 'private', visibility: 'only_me' }),
      moment({ id: 'checking', status: 'checking' }),
      moment({ id: 'removed', status: 'removed' }),
    ];
    expect(shareableMoment(moments, 'live')?.id).toBe('live');
    expect(shareableMoment(moments, 'private')).toBeNull();
    expect(shareableMoment(moments, 'checking')).toBeNull();
    expect(shareableMoment(moments, 'removed')).toBeNull();
    expect(shareableMoment(moments, 'missing')).toBeNull();
  });
});

describe('Share card layouts (D-62, D-82)', () => {
  const ids = (count: number) => layoutsFor(count, 'story').map((l) => l.id);
  const eps = 1e-6;
  const inside = (r: Rect, area: Rect) =>
    r.x >= area.x - eps &&
    r.y >= area.y - eps &&
    r.x + r.width <= area.x + area.width + eps &&
    r.y + r.height <= area.y + area.height + eps;
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps;
  const share = (cells: Rect[], format: 'story' | 'feed') => {
    const { width, height } = canvasSize(format);
    return cells.reduce((sum, c) => sum + c.width * c.height, 0) / (width * height);
  };
  const options = [{ framed: false }, { framed: true }];

  it('offers the planned layouts for each count, the default first', () => {
    expect(ids(1)).toEqual(['full']);
    expect(ids(2)).toEqual(['sideBySide', 'stacked']);
    expect(ids(3)).toEqual(['oneLargeTwo', 'threeStacked', 'threeRow']);
    expect(ids(4)).toEqual(['grid2x2', 'oneLargeThree']);
    expect(ids(5)).toEqual(['grid2x3', 'oneLargeStrip']);
    expect(ids(6)).toEqual(['grid2x3', 'oneLargeStrip']);
    expect(ids(7)).toEqual(['grid4x2', 'grid2x4', 'filmStrip']);
    expect(ids(8)).toEqual(['grid4x2', 'grid2x4', 'filmStrip']);
    // A full jar is the most common card, so its default draws the biggest photos on a Story (D-88).
    for (const n of [7, 8]) {
      const [first, ...rest] = layoutsFor(n, 'story').map((l) => share(l.cells, 'story'));
      for (const other of rest) expect(first).toBeGreaterThan(other!);
    }
    expect(layoutsFor(8, 'feed').map((l) => l.id)).toEqual(ids(8));
    expect(layoutsFor(4, 'story')[0]?.labelKey).toBe('share.layout.grid2x2');
  });

  it('gives every count 1–8, in both formats, one rectangle per photo on the card with no overlaps', () => {
    for (const format of storyFormats) {
      for (const option of options) {
        const area = photoArea(format, option);
        expect(inside(area, frameArea(format))).toBe(true);
        for (let count = 1; count <= 8; count++) {
          const layouts = layoutsFor(count, format, option);
          expect(layouts.length).toBeGreaterThan(0);
          for (const layout of layouts) {
            expect(layout.cells).toHaveLength(count);
            layout.cells.forEach((cell, i) => {
              expect(cell.width).toBeGreaterThan(50);
              expect(cell.height).toBeGreaterThan(50);
              // Every photo keeps its own 3:4 shape: never stretched or cropped to fill the card (D-89).
              expect(cell.width / cell.height).toBeCloseTo(3 / 4, 6);
              expect(inside(cell, area)).toBe(true);
              layout.cells.slice(i + 1).forEach((other) => expect(overlap(cell, other)).toBe(false));
            });
          }
        }
      }
    }
  });

  it('fills the card’s width or its height, less a 24 px margin, with 12 px between photos', () => {
    for (const format of storyFormats) {
      const area = photoArea(format, { framed: false });
      expect(area).toEqual({ x: 24, y: 24, width: 1032, height: canvasSize(format).height - 48 });
      for (let count = 1; count <= 8; count++) {
        for (const { cells } of layoutsFor(count, format)) {
          const left = Math.min(...cells.map((c) => c.x));
          const right = Math.max(...cells.map((c) => c.x + c.width));
          const top = Math.min(...cells.map((c) => c.y));
          const bottom = Math.max(...cells.map((c) => c.y + c.height));
          const fillsWidth = left <= area.x + eps && right >= area.x + area.width - eps;
          const fillsHeight = top <= area.y + eps && bottom >= area.y + area.height - eps;
          expect(fillsWidth || fillsHeight).toBe(true);
        }
      }
    }
    const [a, b, c] = layoutsFor(4, 'story')[0]!.cells;
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(12);
    expect(c!.y - (a!.y + a!.height)).toBeCloseTo(12);
  });

  it('puts more of the card into photos than the old safe-area layouts could, at 3:4', () => {
    // The old layouts kept photos inside the safe area less the author row and footer: 936 × 1109 px, 50%
    // of the Story, so no old layout could reach half the card. Now every count has a layout past half the
    // Story, with every photo still whole at 3:4 (D-89).
    for (let count = 1; count <= 8; count++) {
      const shares = layoutsFor(count, 'story').map((l) => share(l.cells, 'story'));
      expect(Math.max(...shares)).toBeGreaterThan(0.5);
    }
  });

  it('draws one photo alone whole at 3:4, as large as the card allows, its key part in the uncovered band', () => {
    const area = photoArea('story', { framed: false });
    const [cell] = layoutsFor(1, 'story')[0]!.cells;
    expect(cell!.width / cell!.height).toBeCloseTo(3 / 4);
    // The full width less the margins: 1032 px wide, up from 832 px.
    expect(cell!.width).toBeCloseTo(area.width);
    expect(cell!.width).toBeGreaterThan(1000);
    expect(share([cell!], 'story')).toBeGreaterThan(0.65);
    // Centred on what Instagram leaves uncovered, so at least 95% of its height shows on a Story.
    const safe = safeArea('story');
    const shown = Math.min(cell!.y + cell!.height, safe.y + safe.height) - Math.max(cell!.y, safe.y);
    expect(shown / cell!.height).toBeGreaterThan(0.95);
    // A post is shorter: the photo takes the full height instead.
    const [post] = layoutsFor(1, 'feed')[0]!.cells;
    expect(post!.width / post!.height).toBeCloseTo(3 / 4);
    expect(post!.height).toBeCloseTo(photoArea('feed', { framed: false }).height);
  });

  it('keeps names and captions inside the safe area, clear of each other', () => {
    for (const format of storyFormats) {
      const safe = safeArea(format);
      const { author, caption, footer } = overlayRects(format);
      for (const r of [author, caption, footer]) expect(inside(r, safe)).toBe(true);
      expect(overlap(author, caption)).toBe(false);
      expect(overlap(caption, footer)).toBe(false);
    }
    const { author, footer } = overlayRects('story');
    expect(author.y / 1920).toBeGreaterThanOrEqual(0.13);
    expect((footer.y + footer.height) / 1920).toBeLessThanOrEqual(0.82);
  });

  it('centres the short row of the 2 by 4 grid', () => {
    const cells = layoutsFor(7, 'story').find((l) => l.id === 'grid2x4')!.cells;
    const top = new Set(cells.map((c) => Math.round(c.y)));
    expect(top.size).toBe(2);
    const first = cells.slice(0, 4);
    const last = cells.slice(4);
    const centre = (row: Rect[]) => (row[0]!.x + row[row.length - 1]!.x + row[row.length - 1]!.width) / 2;
    expect(centre(last)).toBeCloseTo(centre(first));
  });

  it('leaves room for the Print card', () => {
    const plain = photoArea('feed', { framed: false });
    expect(photoArea('feed', { framed: true }).width).toBeLessThan(plain.width);
    expect(photoArea('feed', { framed: true }).height).toBeLessThan(plain.height);
  });
});
