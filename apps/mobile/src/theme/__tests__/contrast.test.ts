import { colors } from '../tokens';

// NFR-A11Y-04: text meets WCAG AA (4.5:1) on the surfaces it is drawn on. The one exception is white on
// the brand green of primary buttons (AGENTS rule 12), kept by decision.

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const lightSurfaces = ['background', 'surface', 'subtle', 'segmentTrack', 'brandTint', 'dangerTint'] as const;
const bodyText = ['ink', 'inkSoft', 'muted', 'brandText', 'brandLink', 'danger', 'likeText'] as const;

describe('text contrast', () => {
  it.each(bodyText.flatMap((t) => lightSurfaces.map((s) => [t, s] as const)))('%s on %s is at least 4.5:1', (t, s) => {
    expect(contrast(colors[t], colors[s])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the lighter greys on white only, where they pass', () => {
    expect(contrast(colors.dayFuture, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.slotLabelEmpty, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.zoneText, colors.zoneTint)).toBeGreaterThanOrEqual(4.5);
  });

  it('computes known ratios (black on white is 21:1; white on brand is the documented exception)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', colors.brand)).toBeLessThan(4.5);
  });
});
