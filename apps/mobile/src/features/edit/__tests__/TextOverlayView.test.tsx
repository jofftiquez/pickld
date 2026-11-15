import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import i18n from '@/i18n';
import { colors, textOverlayColors } from '@/theme/tokens';

import { getOverlayRenderer, unregisterOverlayRenderer } from '../overlays/registry';
import { registerTextRenderer } from '../text/registerTextRenderer';
import {
  BACKGROUND_RADIUS,
  layoutText,
  OUTLINE_STEPS,
  OUTLINE_WIDTH,
  textAspect,
  type TextOverlay,
} from '../text/textOverlay';
import { TextOverlayView } from '../text/TextOverlayView';

// The text renderer (FR-CAP-07): each font, color and alignment as drawn, scaled with the box.

const overlay: TextOverlay = {
  id: 't1',
  type: 'text',
  x: 0.5,
  y: 0.4,
  scale: 0.5,
  rotation: 0,
  text: 'sinigang szn',
  font: 'bold',
  color: 'white',
  size: 30,
  align: 'center',
};

async function draw(o: TextOverlay, width = layoutText(o).width) {
  await render(<TextOverlayView overlay={o} width={width} height={width * textAspect(o)} />);
  const text = screen.getByText(o.text);
  return { text, style: StyleSheet.flatten(text.props.style) };
}

describe('TextOverlayView', () => {
  it.each([
    ['clean', 'PlusJakartaSans_600SemiBold', 'normal'],
    ['bold', 'PlusJakartaSans_800ExtraBold', 'normal'],
    ['type', Platform.OS === 'ios' ? 'Menlo' : 'monospace', 'normal'],
    ['serif', Platform.OS === 'ios' ? 'Georgia' : 'serif', 'italic'],
    ['script', 'Pacifico_400Regular', 'normal'],
    ['strong', 'Anton_400Regular', 'normal'],
    ['marker', 'PermanentMarker_400Regular', 'normal'],
    ['hand', 'CaveatBrush_400Regular', 'normal'],
  ] as const)('draws %s in its bundled or system face', async (font, family, slant) => {
    const { style } = await draw({ ...overlay, font });
    expect(style).toMatchObject({ fontFamily: family, fontStyle: slant });
  });

  it.each([
    ['bold', -0.6],
    ['clean', 0],
    ['type', 0],
    ['serif', 0],
    ['script', 0],
    ['strong', 0.6],
    ['marker', 0],
    ['hand', 0],
  ] as const)('tracks %s at %d points (Bold is tightened, Strong opened up)', async (font, spacing) => {
    expect((await draw({ ...overlay, font })).style.letterSpacing).toBeCloseTo(spacing, 6);
  });

  it.each(Object.keys(textOverlayColors) as (keyof typeof textOverlayColors)[])(
    'draws %s from its token with a shadow that keeps it legible',
    async (color) => {
      const { style } = await draw({ ...overlay, color });
      expect(style.color).toBe(textOverlayColors[color]);
      expect(style.textShadowColor).toBe(color === 'ink' ? colors.textOverlayShadowOnDark : colors.textOverlayShadow);
      expect(style.textShadowRadius).toBeGreaterThan(0);
    },
  );

  it('a solid background fills the box with the color and writes the words in white or black on it', async () => {
    const yellow = { ...overlay, color: 'yellow', background: 'solid' } as const;
    const { style } = await draw(yellow);
    expect(style.color).toBe(textOverlayColors.ink);
    expect(style.textShadowColor).toBeUndefined();
    const box = StyleSheet.flatten(screen.getByTestId('text-overlay-t1').props.style);
    expect(box.backgroundColor).toBe(textOverlayColors.yellow);
    expect(box.borderRadius).toBeCloseTo(BACKGROUND_RADIUS * 30, 6);
    const { padX, padY } = layoutText(yellow);
    expect(style).toMatchObject({ paddingHorizontal: padX, paddingVertical: padY });
    // A dark color gets white words.
    await draw({ ...overlay, color: 'purple', background: 'solid' });
    expect(StyleSheet.flatten(screen.getByText(overlay.text).props.style).color).toBe(textOverlayColors.white);
  });

  it('a soft background is a see-through wash of the contrasting color under the colored words', async () => {
    const { style } = await draw({ ...overlay, color: 'pink', background: 'soft' });
    expect(style.color).toBe(textOverlayColors.pink);
    expect(style.textShadowColor).toBeUndefined();
    const box = StyleSheet.flatten(screen.getByTestId('text-overlay-t1').props.style);
    expect(box.backgroundColor).toBe('rgba(255,255,255,0.6)');
  });

  it('an outline draws the words in its color round a circle under them, with no shadow', async () => {
    const outlined = { ...overlay, color: 'yellow', outline: 'ink' } as const;
    await render(<TextOverlayView overlay={outlined} width={layoutText(outlined).width} height={100} />);
    const all = screen.getAllByText(overlay.text, { includeHiddenElements: true });
    expect(all).toHaveLength(OUTLINE_STEPS + 1);
    const copies = all.slice(0, OUTLINE_STEPS).map((n) => StyleSheet.flatten(n.props.style));
    for (const c of copies) {
      expect(c.color).toBe(textOverlayColors.ink);
      const [{ translateX }, { translateY }] = c.transform as [{ translateX: number }, { translateY: number }];
      expect(Math.hypot(translateX, translateY)).toBeCloseTo(OUTLINE_WIDTH * 30, 6);
    }
    expect(all[0]?.props.importantForAccessibility).toBe('no');
    const fill = StyleSheet.flatten(all[OUTLINE_STEPS]?.props.style);
    expect(fill.color).toBe(textOverlayColors.yellow);
    expect(fill.textShadowColor).toBeUndefined();
  });

  it('draws the lines typed with Return', async () => {
    const twoLines = { ...overlay, text: 'sinigang\nszn' };
    await render(<TextOverlayView overlay={twoLines} width={200} height={200 * textAspect(twoLines)} />);
    expect(screen.getByText('sinigang\nszn')).toBeTruthy();
  });

  it.each(['left', 'center'] as const)('aligns %s', async (align) => {
    expect((await draw({ ...overlay, align })).style.textAlign).toBe(align);
  });

  it('scales the font, line height and shadow with the box and ignores the system text size', async () => {
    const natural = layoutText(overlay);
    const { text, style } = await draw(overlay, natural.width * 2);
    expect(style.fontSize).toBeCloseTo(60, 6);
    expect(style.lineHeight).toBeCloseTo(natural.lineHeight * 2, 6);
    expect(style.textShadowRadius).toBeCloseTo(20, 6);
    expect(text.props.allowFontScaling).toBe(false);
  });

  it('shows the lines layoutText chose', async () => {
    const long = { ...overlay, text: 'we finally found the best sinigang in the whole city tonight', size: 40 };
    await render(<TextOverlayView overlay={long} width={300} height={300 * textAspect(long)} />);
    expect(screen.getByText(layoutText(long).lines.join('\n'))).toBeTruthy();
  });
});

describe('registerTextRenderer', () => {
  afterEach(() => unregisterOverlayRenderer('text'));

  it('registers the text renderer with the layout aspect and the words as the spoken label', () => {
    registerTextRenderer();
    const renderer = getOverlayRenderer('text');
    expect(renderer?.Content).toBe(TextOverlayView);
    expect(renderer?.aspect(overlay)).toBeCloseTo(textAspect(overlay), 10);
    expect(renderer?.accessibilityLabel(overlay, i18n.t)).toBe('Text: sinigang szn');
  });
});
