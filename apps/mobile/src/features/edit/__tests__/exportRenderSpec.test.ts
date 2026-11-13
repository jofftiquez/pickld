import {
  BUBBLE,
  BUBBLE_COLORS,
  bubbleAspect as serverBubbleAspect,
  bubbleLines as serverBubbleLines,
  FILTER_MATRICES,
  INK,
  layoutText as serverLayoutText,
  STAMP,
  stampText as serverStampText,
  SURFACE,
  TEXT_COLORS,
  TEXT_SHADOW,
} from '../../../../../../supabase/functions/_shared/moment_layout';
import { bubble, bubbleColors, colors, stickerTool, textOverlayColors } from '@/theme/tokens';

import { bubbleAspect, bubbleLines } from '../bubble/bubbleLayout';
import { filterMatrices } from '../filters';
import { stampText } from '../stickers/stamps';
import { layoutText } from '../text/textOverlay';

// The data export draws finished photos on the server (T-508, supabase/functions/_shared/moment_render.ts)
// from copies of the app's filters, styles and layout. This fails when either side changes without the
// other, so a finished photo keeps looking like the moment detail.

describe('the export renderer matches the app', () => {
  it('uses the same filter matrices', () => {
    expect(FILTER_MATRICES).toEqual(filterMatrices);
  });

  it('uses the same colors and bubble styles', () => {
    expect(BUBBLE_COLORS).toEqual(bubbleColors);
    expect(TEXT_COLORS).toEqual(textOverlayColors);
    expect([INK, SURFACE]).toEqual([colors.ink, colors.surface]);
    expect(TEXT_SHADOW).toEqual({ light: colors.textOverlayShadow, onDark: colors.textOverlayShadowOnDark });
    expect(STAMP).toEqual(stickerTool.stamp);
    const { shadow, shoutSkew, ...layout } = bubble;
    const shared = Object.fromEntries(
      Object.keys(layout)
        .filter((k) => k in BUBBLE)
        .map((k) => [k, layout[k as keyof typeof layout]]),
    );
    expect(shared).toEqual(Object.fromEntries(Object.keys(shared).map((k) => [k, BUBBLE[k as keyof typeof BUBBLE]])));
    expect(Object.keys(shared)).toEqual(
      expect.arrayContaining(['referenceWidth', 'fontSize', 'lineHeight', 'charWidth', 'radius']),
    );
    expect(`${BUBBLE.shoutSkewDeg}deg`).toBe(shoutSkew);
    expect(BUBBLE.shadow).toEqual({
      color: shadow.shadowColor,
      opacity: shadow.shadowOpacity,
      radius: shadow.shadowRadius,
      offsetY: shadow.shadowOffset.height,
    });
  });

  it.each([
    ['', 'speech'],
    ['merienda time na!', 'speech'],
    ['a much longer bubble that has to wrap onto several lines', 'thought'],
    ['supercalifragilisticexpialidocious', 'shout'],
    ['shh', 'whisper'],
  ] as const)('lays out the bubble %j (%s) the same way', (text, shape) => {
    expect(serverBubbleLines(text, shape)).toBe(bubbleLines(text, shape));
    expect(serverBubbleAspect(text, shape)).toBe(bubbleAspect({ text, shape }));
  });

  it.each([
    { text: 'Kape muna', font: 'bold', size: 40 },
    { text: 'serif and mono\nsecond line', font: 'serif', size: 24 },
    { text: 'averyveryverylongwordthatcannotfitononeline', font: 'type', size: 64 },
    { text: '今日は良い天気 and some words', font: 'clean', size: 30 },
  ] as const)('lays out the text $text the same way', (o) => {
    expect(serverLayoutText(o)).toEqual(layoutText(o));
  });

  it.each(['time', 'date', 'weekday', 'jar_number'] as const)('words the %s stamp the same way', (kind) => {
    const capturedAt = new Date('2026-11-12T07:14:00Z');
    expect(serverStampText(kind, capturedAt, 'Asia/Manila', 'en-US')).toBe(
      stampText(kind, { capturedAt, tz: 'Asia/Manila' }, 'en-US'),
    );
  });
});
