import type { JarMoment } from '@/features/jar/jarPage';
import { colors, lidColors } from '@/theme/tokens';

import {
  canvasSize,
  lidOf,
  paletteFor,
  readableOn,
  safeInsets,
  shareableMoment,
  storyBackgrounds,
} from '../storyLayout';

const moment = (over: Partial<JarMoment>): JarMoment => ({
  id: 'm',
  slot: 'ootd',
  status: 'live',
  is_private: false,
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
      moment({ id: 'private', is_private: true }),
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
