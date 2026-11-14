import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors } from '@/theme/tokens';

import {
  canvasSize,
  captionLinesFor,
  layoutsFor,
  lidOf,
  paletteFor,
  readableOn,
  safeArea,
  safeInsets,
  shareableMoment,
  storyBackgrounds,
  storyFormats,
  storyMetrics,
  textHeight,
  type Rect,
  type StoryFormat,
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
  it('exports a 1080×1920 Story and a 1080×1350 post, keeping clear of the Story’s covered bands', () => {
    expect(canvasSize('story')).toEqual({ width: 1080, height: 1920 });
    expect(canvasSize('feed')).toEqual({ width: 1080, height: 1350 });
    // Instagram's profile bar and reply bar cover about the top and bottom 250 px of a Story (D-90).
    expect(safeInsets('story')).toMatchObject({ top: 250, bottom: 250 });
  });

  it('offers five backgrounds, the blurred photo first', () => {
    expect(storyBackgrounds).toEqual(['blur', 'lid', 'paper', 'ink', 'print']);
    expect(paletteFor('blur', null)).toMatchObject({ blurred: true, text: colors.surface });
    expect(paletteFor('print', null)).toMatchObject({ blurred: true, card: colors.surface, text: colors.ink });
    // The words sit on the background, under the photos (D-90): white on the dark ones, ink on the light ones.
    expect(paletteFor('blur', null)).toMatchObject({ scrim: colors.glassStrong });
    expect(paletteFor('ink', null)).toMatchObject({ text: colors.surface });
    expect(paletteFor('paper', null)).toMatchObject({ text: colors.ink, logoTint: null });
  });

  it('fills Lid color with the author’s lid and the more readable of ink or white on it', () => {
    expect(paletteFor('lid', lidColors.ink)).toMatchObject({ fill: lidColors.ink, text: colors.surface });
    expect(paletteFor('lid', lidColors.ube)).toMatchObject({ fill: lidColors.ube, text: colors.ink });
    expect(paletteFor('lid', lidColors.mango)).toMatchObject({ fill: lidColors.mango, text: colors.ink });
    expect(paletteFor('lid', '#ABCDEF').fill).toBe(lidColors.pickle);
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

describe('Share card layouts (D-62, D-89, D-90, D-91)', () => {
  const ids = (count: number, format: StoryFormat = 'story') => layoutsFor(count, format).map((l) => l.id);
  const eps = 1e-6;
  const inside = (r: Rect, area: Rect) =>
    r.x >= area.x - eps &&
    r.y >= area.y - eps &&
    r.x + r.width <= area.x + area.width + eps &&
    r.y + r.height <= area.y + area.height + eps;
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps;
  const photoShare = (cells: Rect[], format: StoryFormat) => {
    const { width, height } = canvasSize(format);
    return cells.reduce((sum, c) => sum + c.width * c.height, 0) / (width * height);
  };
  const longCaption = 'a very long caption that keeps going past one line on any layout we draw here';
  const variants = [
    { framed: false, caption: null },
    { framed: true, caption: null },
    { framed: false, caption: 'lunch crew' },
    { framed: true, caption: longCaption },
  ];

  it('offers only the layouts that fill each format well, the default first', () => {
    expect(ids(1)).toEqual(['full']);
    expect(ids(2)).toEqual(['sideBySide', 'stacked']);
    expect(ids(3)).toEqual(['oneLargeTwo', 'twoAndOne']);
    expect(ids(4)).toEqual(['grid2x2', 'oneLargeThree']);
    expect(ids(5)).toEqual(['oneLargeStrip', 'grid2x3']);
    expect(ids(6)).toEqual(['grid2x3', 'oneLargeStrip']);
    expect(ids(7)).toEqual(['grid3x3', 'oneLargeGrid']);
    expect(ids(8)).toEqual(['grid3x3', 'oneLargeGrid']);
    // A post is wider than it is tall for a block of photos: three in a row and the 2 by 4 grid fit it, stacked doesn't.
    expect(ids(2, 'feed')).toEqual(['sideBySide']);
    expect(ids(3, 'feed')).toEqual(['oneLargeTwo', 'twoAndOne', 'threeRow']);
    expect(ids(8, 'feed')).toEqual(['grid3x3', 'oneLargeGrid', 'grid2x4']);
    // Cut for leaving the card empty around a narrow column or a thin band (D-91).
    for (const format of storyFormats) {
      for (let count = 1; count <= 8; count++) {
        for (const id of ids(count, format)) expect(['threeStacked', 'grid4x2', 'filmStrip']).not.toContain(id);
      }
    }
    expect(layoutsFor(4, 'story')[0]?.labelKey).toBe('share.layout.grid2x2');
  });

  it('keeps every photo whole at 3:4, apart, and everything inside the safe area, for every count and format', () => {
    for (const format of storyFormats) {
      const safe = safeArea(format);
      for (const option of variants) {
        for (let count = 1; count <= 8; count++) {
          for (const layout of layoutsFor(count, format, option)) {
            expect(layout.cells).toHaveLength(count);
            layout.cells.forEach((cell, i) => {
              expect(cell.width).toBeGreaterThan(90);
              // Every photo keeps its own 3:4 shape: never stretched or cropped to fill the card (D-89).
              expect(cell.width / cell.height).toBeCloseTo(3 / 4, 6);
              expect(inside(cell, safe)).toBe(true);
              expect(overlap(cell, layout.text)).toBe(false);
              layout.cells.slice(i + 1).forEach((other) => expect(overlap(cell, other)).toBe(false));
            });
            // The words sit under the photos, inside the safe area too.
            expect(inside(layout.text, safe)).toBe(true);
            expect(layout.text.y).toBeGreaterThanOrEqual(Math.max(...layout.cells.map((c) => c.y + c.height)));
            expect(layout.text.width).toBeGreaterThanOrEqual(Math.min(storyMetrics.textMinWidth, safe.width) - eps);
            expect(layout.card === null).toBe(!option.framed);
          }
        }
      }
    }
  });

  it('keeps a Story’s covered bands empty: nothing above 250 px or below 1670 px but the background', () => {
    for (let count = 1; count <= 8; count++) {
      for (const { cells, text } of layoutsFor(count, 'story', { caption: longCaption })) {
        for (const r of [...cells, text]) {
          expect(r.y).toBeGreaterThanOrEqual(250 - eps);
          expect(r.y + r.height).toBeLessThanOrEqual(1670 + eps);
        }
      }
    }
  });

  it('centres the photos and words as one block, filling the safe area’s width or height', () => {
    for (const format of storyFormats) {
      const safe = safeArea(format);
      for (let count = 1; count <= 8; count++) {
        for (const { cells, text } of layoutsFor(count, format)) {
          const left = Math.min(...cells.map((c) => c.x));
          const right = Math.max(...cells.map((c) => c.x + c.width));
          const top = Math.min(...cells.map((c) => c.y));
          const bottom = text.y + text.height;
          expect((left + right) / 2).toBeCloseTo(safe.x + safe.width / 2);
          expect((top + bottom) / 2).toBeCloseTo(safe.y + safe.height / 2);
          const fillsWidth = left <= safe.x + eps && right >= safe.x + safe.width - eps;
          const fillsHeight = top <= safe.y + eps && bottom >= safe.y + safe.height - eps;
          expect(fillsWidth || fillsHeight).toBe(true);
        }
      }
    }
    const [a, b, c] = layoutsFor(4, 'story')[0]!.cells;
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(storyMetrics.tileGap);
    expect(c!.y - (a!.y + a!.height)).toBeCloseTo(storyMetrics.tileGap);
  });

  it('gives a full jar’s default its biggest photos, and every count a fair share of photo', () => {
    for (const format of storyFormats) {
      for (const n of [7, 8]) {
        const [first, ...rest] = layoutsFor(n, format).map((l) => photoShare(l.cells, format));
        for (const other of rest) expect(first).toBeGreaterThan(other!);
      }
      for (let count = 1; count <= 8; count++) {
        const best = Math.max(...layoutsFor(count, format).map((l) => photoShare(l.cells, format)));
        // Inside the safe area (74% of a Story, 85% of a post), with room kept for the words. Two photos side
        // by side are the least: two 3:4 photos can't be taller than the card is wide.
        expect(best).toBeGreaterThan(format === 'story' ? 0.29 : 0.42);
      }
    }
  });

  it('keeps room for the caption: a longer caption shrinks the photos, never the words', () => {
    const none = layoutsFor(1, 'story')[0]!;
    const one = layoutsFor(1, 'story', { caption: 'lunch crew' })[0]!;
    const two = layoutsFor(1, 'story', { caption: longCaption })[0]!;
    expect([none.captionLines, one.captionLines, two.captionLines]).toEqual([0, 1, 2]);
    expect(none.text.height).toBe(textHeight(0));
    expect(two.text.height).toBe(textHeight(2));
    expect(one.cells[0]!.height).toBeLessThan(none.cells[0]!.height);
    expect(two.cells[0]!.height).toBeLessThan(one.cells[0]!.height);
    expect(captionLinesFor('', 900)).toBe(0);
    expect(captionLinesFor('x'.repeat(500), 900)).toBe(storyMetrics.captionLines);
  });

  it('wraps the Print card around the photos and words, inside the card', () => {
    for (const format of storyFormats) {
      const { width, height } = canvasSize(format);
      for (let count = 1; count <= 8; count++) {
        for (const layout of layoutsFor(count, format, { framed: true })) {
          const card = layout.card!;
          expect(inside(card, { x: 0, y: 0, width, height })).toBe(true);
          for (const r of [...layout.cells, layout.text]) expect(inside(r, card)).toBe(true);
          const top = Math.min(...layout.cells.map((c) => c.y));
          expect(top - card.y).toBeCloseTo(storyMetrics.printPad);
        }
      }
    }
  });

  it('centres the short rows of the 3 by 3 grid', () => {
    for (const count of [7, 8]) {
      const cells = layoutsFor(count, 'story')[0]!.cells;
      const rows = new Map<number, Rect[]>();
      for (const c of cells) rows.set(Math.round(c.y), [...(rows.get(Math.round(c.y)) ?? []), c]);
      expect([...rows.values()].map((r) => r.length)).toEqual(count === 7 ? [2, 3, 2] : [3, 2, 3]);
      const centre = (row: Rect[]) => (row[0]!.x + row[row.length - 1]!.x + row[row.length - 1]!.width) / 2;
      const centres = [...rows.values()].map(centre);
      for (const c of centres) expect(c).toBeCloseTo(centres[0]!);
    }
  });
});
