// Captures design/screens/<Screen>.html to docs/milestones/<M>/<Screen>-design.png with Playwright.
// Usage: node scripts/capture-design.mjs M1 Main Splash ...   (screen names are design/screens file names)
// The phone frame is the first element in each design file's <body> (390 × 844); it is captured at 3x,
// close to the iOS Simulator's iPhone 17 Pro output, so the two sit side by side.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [milestone, ...screens] = process.argv.slice(2);
if (!/^M\d$/.test(milestone ?? '') || screens.length === 0) {
  console.error('usage: node scripts/capture-design.mjs M<n> <Screen> [<Screen> ...]');
  process.exit(1);
}

const outDir = resolve(root, 'docs/milestones', milestone);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 });
for (const screen of screens) {
  await page.goto(pathToFileURL(resolve(root, 'design/screens', `${screen}.html`)).href);
  await page.evaluate(() => document.fonts.ready);
  const out = resolve(outDir, `${screen}-design.png`);
  await page.locator('body > div').first().screenshot({ path: out });
  console.log(out);
}
await browser.close();
