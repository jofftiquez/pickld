import config from '../../../tailwind.config';
import { colors, radius, space, type } from '../tokens';

describe('tailwind theme', () => {
  it('takes every color from tokens and drops the default palette', () => {
    const themeColors = config.theme?.colors as Record<string, unknown>;
    for (const [name, value] of Object.entries(colors)) expect(themeColors[name]).toBe(value);
    expect(themeColors.blue).toBeUndefined();
  });

  it('maps radii, spacing and text sizes from tokens', () => {
    const r = config.theme?.borderRadius as Record<string, string>;
    const s = config.theme?.spacing as Record<string, string>;
    const f = config.theme?.fontSize as Record<string, [string, { fontWeight: string }]>;
    expect(r.card).toBe(`${radius.card}px`);
    expect(s.lg).toBe(`${space.lg}px`);
    expect(f.screenTitle).toEqual([`${type.screenTitle.size}px`, { fontWeight: type.screenTitle.weight }]);
  });
});
