import { render, screen } from '@testing-library/react-native';
import { processColor, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import i18n from '@/i18n';
import { fontFamilies } from '@/theme/fontFamilies';
import { bubble, bubbleColors } from '@/theme/tokens';

import { bubbleAspect } from '../bubble/bubbleLayout';
import { BubbleOverlay, registerBubbleRenderer } from '../bubble/BubbleOverlay';
import type { Bubble } from '../edits';
import { getOverlayRenderer, unregisterOverlayRenderer } from '../overlays/registry';

// The bubble renderer (FR-CAP-06): each shape's outline, the color and its text pair, the user's text
// scaled with the box, and what screen readers call it.

const base: Bubble = {
  id: 'b1',
  type: 'bubble',
  x: 0.5,
  y: 0.5,
  scale: 0.5,
  rotation: 0,
  shape: 'speech',
  color: 'white',
  text: 'Lunch break, finally!',
};
// Twice the reference width, so every length in the design doubles.
const W = bubble.referenceWidth * 2;
const H = 100;

async function draw(patch: Partial<Bubble>) {
  await render(<BubbleOverlay overlay={{ ...base, ...patch }} width={W} height={H} />);
  const body = StyleSheet.flatten(screen.getByTestId('bubble-b1').props.style) as ViewStyle;
  const whole = StyleSheet.flatten(screen.getByTestId('bubble-b1-shape').props.style) as ViewStyle;
  return { body, whole };
}
const textStyle = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style) as TextStyle;

describe('BubbleOverlay', () => {
  it('Speech: round corners with a sharp bottom-left one, scaled with the box', async () => {
    const { body } = await draw({ shape: 'speech' });
    expect(body).toMatchObject({
      width: W,
      height: H,
      borderRadius: bubble.radius * 2,
      borderBottomLeftRadius: bubble.tailRadius * 2,
      backgroundColor: bubbleColors.white.fill,
      paddingHorizontal: bubble.paddingX * 2,
    });
    expect(body.transform).toBeUndefined();
    expect(body.borderStyle).toBeUndefined();
  });

  it('Thought: a pill (radius half the height) with more room at the ends', async () => {
    const { body } = await draw({ shape: 'thought' });
    expect(body.borderRadius).toBe(H / 2);
    expect(body.borderBottomLeftRadius).toBeUndefined();
    expect(body.paddingHorizontal).toBe(bubble.thoughtPaddingX * 2);
  });

  it('Shout: square-ish, slanted with its tail, in the heaviest weight', async () => {
    const { body, whole } = await draw({ shape: 'shout' });
    expect(body.borderRadius).toBe(bubble.shoutRadius * 2);
    expect(whole.transform).toEqual([{ skewX: bubble.shoutSkew }]);
    expect(body.transform).toBeUndefined();
    expect(textStyle(base.text).fontFamily).toBe(fontFamilies.extrabold);
  });

  it('Whisper: a dashed outline in the text color, over the fill so the text stays legible', async () => {
    const { body } = await draw({ shape: 'whisper', color: 'sky' });
    expect(body).toMatchObject({
      borderRadius: bubble.whisperRadius * 2,
      borderStyle: 'dashed',
      borderWidth: bubble.whisperBorder * 2,
      borderColor: bubbleColors.sky.text,
      backgroundColor: bubbleColors.sky.fill,
    });
    expect(textStyle(base.text).fontFamily).toBe(fontFamilies.bold);
  });

  it.each(Object.entries(bubbleColors))(
    '%s fills the bubble and colors the text with its pair',
    async (color, pair) => {
      const { body } = await draw({ color: color as Bubble['color'] });
      expect(body.backgroundColor).toBe(pair.fill);
      expect(textStyle(base.text).color).toBe(pair.text);
    },
  );

  it('draws the text as typed, scaled with the box, ignoring the system text size and never overflowing', async () => {
    await draw({});
    const text = screen.getByText('Lunch break, finally!');
    expect(textStyle('Lunch break, finally!')).toMatchObject({
      fontSize: bubble.fontSize * 2,
      lineHeight: bubble.lineHeight * 2,
      textAlign: 'center',
    });
    expect(text.props.allowFontScaling).toBe(false);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    expect(text.props.numberOfLines).toBe(2);
  });

  it('casts its shadow from the whole bubble, tail included, not the body alone', async () => {
    const { body, whole } = await draw({});
    expect(whole).toMatchObject({ shadowOpacity: 0.22, shadowRadius: 24, width: W, height: H });
    expect(whole.backgroundColor).toBeUndefined(); // so the shadow follows the drawn shape
    expect(body.shadowOpacity).toBeUndefined();
  });

  it('Speech flipped right: the sharp corner moves to the bottom right', async () => {
    const { body } = await draw({ shape: 'speech', tail: 'right' });
    expect(body.borderBottomRightRadius).toBe(6 * 2);
    expect(body.borderBottomLeftRadius).toBeUndefined();
    expect(body.borderRadius).toBe(20 * 2);
  });

  // The box is 400 × 100 here, so 2 points draw per reference unit and the box is 50 units tall.
  type HostJson = { type: string; props: Record<string, unknown>; children: (HostJson | string)[] | null };
  /** Props of every native SVG node of this type drawn (react-native-svg's host components). */
  function svgNodes(type: 'RNSVGSvgView' | 'RNSVGPath' | 'RNSVGCircle') {
    const found: Record<string, unknown>[] = [];
    const walk = (n: HostJson | HostJson[] | string | null) => {
      if (n === null || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.type === type) found.push(n.props);
      n.children?.forEach(walk);
    };
    walk(screen.toJSON() as HostJson | HostJson[] | null);
    return found;
  }
  const filled = (color: string) => ({ type: 0, payload: processColor(color) });

  it('a bubble saved without a side draws its point on the left, below the box, in the fill color', async () => {
    await draw({}); // base has no tail
    expect(screen.getByTestId('bubble-b1-tail-left')).toBeTruthy();
    // Hangs 16 units (32 points) below the 100-point box, across its whole width.
    expect(svgNodes('RNSVGSvgView')[0]).toMatchObject({ width: 400, height: 132, vbWidth: 200, vbHeight: 66 });
    const [point] = svgNodes('RNSVGPath');
    expect(point).toMatchObject({ d: 'M16 48 L6 66 L40 48 Z', fill: filled(bubbleColors.white.fill) });
  });

  it('tail on the left and on the right mirror each other', async () => {
    await draw({ tail: 'left', color: 'butter' });
    expect(svgNodes('RNSVGPath')[0]).toMatchObject({
      d: 'M16 48 L6 66 L40 48 Z',
      fill: filled(bubbleColors.butter.fill),
    });
    await draw({ tail: 'right' });
    expect(screen.getByTestId('bubble-b1-tail-right')).toBeTruthy();
    expect(screen.queryByTestId('bubble-b1-tail-left')).toBeNull();
    expect(svgNodes('RNSVGPath').map((p) => p.d)).toEqual(['M184 48 L194 66 L160 48 Z']);
  });

  it('Thought trails two dots instead of a point, mirrored when flipped', async () => {
    await draw({ shape: 'thought', tail: 'right' });
    // Pill radius 25 units, so under x = 160 (40 from the right) the bottom is flat at 50:
    // large dot 2 below it with radius 6 → centre 58; small one 14 out and 11 down → (174, 69), r 3.5.
    expect(svgNodes('RNSVGPath')).toEqual([]);
    expect(svgNodes('RNSVGCircle').map((c) => [c.cx, c.cy, c.r])).toEqual([
      [160, 58, 6],
      [174, 69, 3.5],
    ]);
    expect(svgNodes('RNSVGSvgView')[0]).toMatchObject({ vbHeight: 72.5 }); // 69 + 3.5
  });

  it('Whisper’s point carries the dashed outline down its two edges', async () => {
    await draw({ shape: 'whisper', color: 'sky' });
    const [point, edges] = svgNodes('RNSVGPath');
    expect(point?.d).toBe('M16 48 L6 66 L40 48 Z');
    expect(edges).toMatchObject({ d: 'M16 48 L6 66 L40 48', strokeWidth: 1.5, stroke: filled(bubbleColors.sky.text) });
    expect(edges?.strokeDasharray).toEqual(['4.5', '3']); // 3 and 2 border widths
  });

  it('Speech and Shout have no dashed edges', async () => {
    await draw({ shape: 'shout' });
    expect(svgNodes('RNSVGPath')).toHaveLength(1);
  });

  it('an empty bubble draws only its shape', async () => {
    await draw({ text: '' });
    expect(screen.getByTestId('bubble-b1').props.children).toBeNull();
  });
});

describe('registerBubbleRenderer', () => {
  afterEach(() => unregisterOverlayRenderer('bubble'));

  it('registers the bubble renderer with its layout and spoken labels', async () => {
    registerBubbleRenderer();
    const renderer = getOverlayRenderer('bubble');
    expect(renderer?.Content).toBe(BubbleOverlay);
    expect(renderer?.aspect(base)).toBe(bubbleAspect(base));
    expect(renderer?.accessibilityLabel(base, i18n.t)).toBe('Speech bubble: Lunch break, finally!');
    expect(renderer?.accessibilityLabel({ ...base, shape: 'whisper', text: '' }, i18n.t)).toBe(
      'Whisper bubble, no text yet',
    );
  });
});
