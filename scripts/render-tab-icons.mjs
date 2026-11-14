// Renders the native tab bar's icons (D-108) from the app's own stroke icons in apps/mobile/src/components/icons.ts,
// so the iOS 26 Liquid Glass bar uses the same Today, Moments and Jars glyphs as the custom bar.
// Usage: node scripts/render-tab-icons.mjs   (writes apps/mobile/assets/tabs/<name>.png, @2x and @3x)
// Black on transparent; iOS draws them as template images in the bar's own colors.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { icons } from '../apps/mobile/src/components/icons.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'apps/mobile/assets/tabs');
const POINTS = 26; // UIKit's tab bar image size; the 24-unit grid fills it.
const STROKE = 1.8; // <Icon>'s default stroke width.

function svg(shapes) {
  const body = shapes
    .map((s) =>
      s.kind === 'path'
        ? `<path d="${s.d}"/>`
        : s.kind === 'circle'
          ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`
          : `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${POINTS}" height="${POINTS}" fill="none" stroke="#000" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const scale of [1, 2, 3]) {
  const page = await browser.newPage({ viewport: { width: POINTS, height: POINTS }, deviceScaleFactor: scale });
  for (const name of ['today', 'moments', 'jars']) {
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(icons[name])}`,
    );
    await page
      .locator('svg')
      .screenshot({ path: resolve(out, scale === 1 ? `${name}.png` : `${name}@${scale}x.png`), omitBackground: true });
  }
  await page.close();
}
await browser.close();
console.log(`Wrote ${out}`);
