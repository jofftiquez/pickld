import type { Config } from 'tailwindcss';
// nativewind/preset ships without module typings.
// @ts-expect-error untyped preset
import nativewindPreset from 'nativewind/preset';

import { colors, lidColors, radius, space, type } from './src/theme/tokens';

// Every color, radius, spacing step and text size comes from tokens.ts.
// The default Tailwind palette is replaced, not extended, so off-token values fail to resolve.
const fontSize = Object.fromEntries(
  Object.entries(type).map(([name, t]) => [name, [`${t.size}px`, { fontWeight: t.weight }]]),
);

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  theme: {
    colors: { transparent: 'transparent', ...colors, lid: lidColors },
    borderRadius: { none: '0px', ...Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])) },
    spacing: { 0: '0px', ...Object.fromEntries(Object.entries(space).map(([k, v]) => [k, `${v}px`])) },
    fontSize: fontSize as NonNullable<Config['theme']>['fontSize'],
    extend: {},
  },
  plugins: [],
};

export default config;
