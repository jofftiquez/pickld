import {
  BUBBLE,
  BUBBLE_COLORS,
  bubbleAspect as serverBubbleAspect,
  bubbleLines as serverBubbleLines,
  bubbleTailGeometry as serverBubbleTailGeometry,
  bubbleTailSide as serverBubbleTailSide,
  cloudGeometry as serverCloudGeometry,
  isCloud as serverIsCloud,
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

import {
  bubbleAspect,
  bubbleLines,
  bubbleTailGeometry,
  bubbleTailSide,
  cloudGeometry,
  isCloud,
} from '../bubble/bubbleLayout';
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
      expect.arrayContaining([
        'referenceWidth',
        'fontSize',
        'lineHeight',
        'charWidth',
        'radius',
        'tailRadius',
        'tailStart',
        'tailEnd',
        'tailTipX',
        'tailLength',
        'tailOverlap',
        'thoughtDotX',
        'thoughtDotR',
        'thoughtDotSmallR',
        'thoughtDotGap',
        'thoughtDotStepX',
        'thoughtDotStepY',
        'cloudPuffR',
        'cloudPuffStep',
        'cloudPuffSizes',
      ]),
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
    ['speech', 'left', 42],
    ['shout', 'right', 64],
    ['whisper', 'right', 42],
    ['thought', 'left', 42],
    ['thought', 'right', 130],
  ] as const)('draws the %s tail on the %s of a %d-unit box the same way', (shape, side, height) => {
    expect(serverBubbleTailGeometry(shape, side, height)).toEqual(bubbleTailGeometry(shape, side, height));
  });

  it.each([42, 64, 130])('draws a %d-unit-tall cloud thought and its dots the same way', (height) => {
    expect(serverCloudGeometry(height)).toEqual(cloudGeometry(height));
    for (const side of ['left', 'right'] as const) {
      expect(serverBubbleTailGeometry('thought', side, height, true)).toEqual(
        bubbleTailGeometry('thought', side, height, true),
      );
    }
    for (const o of [
      { shape: 'thought' as const, cloud: true },
      { shape: 'thought' as const },
      { shape: 'speech' as const, cloud: true },
    ]) {
      expect(serverIsCloud(o)).toBe(isCloud(o));
    }
  });

  it('puts the tail of a bubble saved without a side on the same side', () => {
    expect(serverBubbleTailSide({})).toBe(bubbleTailSide({}));
    expect(serverBubbleTailSide({ tail: 'right' })).toBe(bubbleTailSide({ tail: 'right' }));
    expect(serverBubbleTailSide({ tail: 'left' })).toBe(bubbleTailSide({ tail: 'left' }));
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
