import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors } from '@/theme/tokens';

import {
  canvasSize,
  layoutsFor,
  lidOf,
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
    // Instagram's profile bar and reply bar: at least 13% at the top and 17% at the bottom stay clear.
    expect(story.top / 1920).toBeGreaterThanOrEqual(0.13);
    expect(story.bottom / 1920).toBeGreaterThanOrEqual(0.17);
  });

  it('offers five backgrounds, the blurred photo first', () => {
    expect(storyBackgrounds).toEqual(['blur', 'lid', 'paper', 'ink', 'print']);
    expect(paletteFor('blur', null)).toMatchObject({ blurred: true, text: colors.surface });
    expect(paletteFor('print', null)).toMatchObject({ blurred: true, card: colors.surface, text: colors.ink });
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

describe('Share card layouts (D-62)', () => {
  const ids = (count: number) => layoutsFor(count, 'story').map((l) => l.id);
  const inside = (r: Rect, area: Rect) =>
    r.x >= area.x - 1e-6 &&
    r.y >= area.y - 1e-6 &&
    r.x + r.width <= area.x + area.width + 1e-6 &&
    r.y + r.height <= area.y + area.height + 1e-6;
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.width - 1e-6 &&
    b.x < a.x + a.width - 1e-6 &&
    a.y < b.y + b.height - 1e-6 &&
    b.y < a.y + a.height - 1e-6;
  const options = [
    { framed: false, caption: false },
    { framed: false, caption: true },
    { framed: true, caption: true },
  ];

  it('offers the planned layouts for each count, the default first', () => {
    expect(ids(1)).toEqual(['full']);
    expect(ids(2)).toEqual(['sideBySide', 'stacked']);
    expect(ids(3)).toEqual(['oneLargeTwo', 'threeStacked', 'threeRow']);
    expect(ids(4)).toEqual(['grid2x2', 'oneLargeThree']);
    expect(ids(5)).toEqual(['grid2x3', 'oneLargeStrip']);
    expect(ids(6)).toEqual(['grid2x3', 'oneLargeStrip']);
    expect(ids(7)).toEqual(['grid2x4', 'grid4x2', 'filmStrip']);
    expect(ids(8)).toEqual(['grid2x4', 'grid4x2', 'filmStrip']);
    expect(layoutsFor(8, 'feed').map((l) => l.id)).toEqual(ids(8));
    expect(layoutsFor(4, 'story')[0]?.labelKey).toBe('share.layout.grid2x2');
  });

  it('gives every count 1–8, in both formats, one rectangle per photo inside the safe area with no overlaps', () => {
    for (const format of storyFormats) {
      for (const option of options) {
        const area = photoArea(format, option);
        const safe = safeArea(format);
        expect(inside(area, safe)).toBe(true);
        for (let count = 1; count <= 8; count++) {
          const layouts = layoutsFor(count, format, option);
          expect(layouts.length).toBeGreaterThan(0);
          for (const layout of layouts) {
            expect(layout.cells).toHaveLength(count);
            layout.cells.forEach((cell, i) => {
              expect(cell.width).toBeGreaterThan(50);
              expect(cell.height).toBeGreaterThan(50);
              expect(inside(cell, area)).toBe(true);
              expect(inside(cell, safe)).toBe(true);
              layout.cells.slice(i + 1).forEach((other) => expect(overlap(cell, other)).toBe(false));
            });
          }
        }
      }
    }
  });

  it('draws one photo alone at 3:4, as large as the space allows', () => {
    const area = photoArea('story', { framed: false, caption: false });
    const [cell] = layoutsFor(1, 'story')[0]!.cells;
    expect(cell!.width / cell!.height).toBeCloseTo(3 / 4);
    expect(Math.max(cell!.height / area.height, cell!.width / area.width)).toBeCloseTo(1);
  });

  it('keeps today’s 2 rows of 4 as the default for a full jar, the short row centred', () => {
    const cells = layoutsFor(7, 'story')[0]!.cells;
    const top = new Set(cells.map((c) => Math.round(c.y)));
    expect(top.size).toBe(2);
    const first = cells.slice(0, 4);
    const last = cells.slice(4);
    const centre = (row: Rect[]) => (row[0]!.x + row[row.length - 1]!.x + row[row.length - 1]!.width) / 2;
    expect(centre(last)).toBeCloseTo(centre(first));
  });

  it('leaves room for the caption and the Print card', () => {
    const plain = photoArea('feed', { framed: false, caption: false });
    expect(photoArea('feed', { framed: false, caption: true }).height).toBeLessThan(plain.height);
    expect(photoArea('feed', { framed: true, caption: false }).width).toBeLessThan(plain.width);
  });
});
