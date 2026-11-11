import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

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
  return { body };
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

  it('Shout: square-ish, slanted, in the heaviest weight', async () => {
    const { body } = await draw({ shape: 'shout' });
    expect(body.borderRadius).toBe(bubble.shoutRadius * 2);
    expect(body.transform).toEqual([{ skewX: bubble.shoutSkew }]);
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
