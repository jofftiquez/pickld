// Renders the sticker art in assets/stickers/<pack>/<name>.png from the catalog in the local database.
// Usage (after `pnpm db:reset`): node scripts/render-stickers.mjs [--force] [pack-slug ...]   (no slugs: every pack)
// Existing files are kept (art never changes under a key; restyled art gets a new file name), unless --force.
//
// The catalog (labels, packs, asset paths) lives in supabase/migrations (0012); this script reads it with the
// anon key through public_sticker_catalog() (C-6), the same call the web page makes, so art and rows can't
// drift. Every sticker is an original word sticker in the Hi-fi A style (design/screens/Stickers.html): a
// tilted pill in Plus Jakarta Sans ExtraBold with a soft shadow, transparent background, rendered at 3x.
// Upload the result with `cd workers/photos && deno task stickers`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import {
  bubbleScript,
  fontFaces,
  HASHTAG_PACK,
  hashtagHtml,
  PAGE_CSS,
  WORD_ART_PACKS,
  wordArtHtml,
} from './word-art.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Inlined: a page made with setContent can't load file:// fonts.
const font = `data:font/ttf;base64,${readFileSync(
  resolve(root, 'node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
).toString('base64')}`;

// Local stack only: the URL and anon key are read at runtime, never stored.
const statusText = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const status = JSON.parse(statusText.slice(statusText.indexOf('{')));
const res = await fetch(`${status.API_URL}/rest/v1/rpc/public_sticker_catalog`, {
  method: 'POST',
  headers: { apikey: status.ANON_KEY, authorization: `Bearer ${status.ANON_KEY}`, 'content-type': 'application/json' },
  body: '{}',
});
if (!res.ok) throw new Error(`public_sticker_catalog: ${res.status} ${await res.text()}`);
const force = process.argv.includes('--force');
const only = process.argv.slice(2).filter((a) => a !== '--force');
const catalog = (await res.json()).filter(
  (s) =>
    (only.length === 0 || only.includes(s.pack_slug)) && (force || !existsSync(resolve(root, 'assets', s.asset_path))),
);

// Hi-fi A sticker palette (tokens.ts: ink, brand, stickerOnWhiteText; the yellow and white pills of the design).
const PALETTE = [
  { bg: '#11140d', fg: '#ffffff' },
  { bg: '#ffe08a', fg: '#11140d' },
  { bg: '#ffffff', fg: '#11140d' },
  { bg: '#c4521c', fg: '#ffffff' },
  { bg: '#7fad33', fg: '#11140d' },
  { bg: '#2f74a8', fg: '#ffffff' },
  { bg: '#6f4fae', fg: '#ffffff' },
];
const CHRISTMAS = [
  { bg: '#ffffff', fg: '#9e1b14' },
  { bg: '#2c4a12', fg: '#ffffff' },
  { bg: '#f2bd2e', fg: '#11140d' },
  { bg: '#9e1b14', fg: '#ffffff' },
];
const TILT = [-3, 3, -2, 2, 0, -1, 1];
// Auto stamps: the editor draws the live value; the art is a sample in the stamp's frame.
const STAMP_SAMPLE = { time: '2:14 PM', date: 'NOV 11', weekday: 'WEDNESDAY', jar_number: 'JAR #42' };

function style(s) {
  const i = (s.pack_sort * 3 + s.sort) % PALETTE.length;
  if (s.pack_slug === 'stamps') {
    return { text: (STAMP_SAMPLE[s.stamp] ?? s.label).toUpperCase(), kind: 'stamp', tilt: TILT[i], ...PALETTE[0] };
  }
  // Seasonal Christmas art in the shop banner's colours (design: StickerShop): white, pine green, gold, red.
  if (s.pack_slug.startsWith('christmas-')) {
    return { text: s.label, kind: 'word', tilt: TILT[i], ...CHRISTMAS[s.sort % CHRISTMAS.length] };
  }
  if (s.pack_slug === 'milestones') return { text: `★ ${s.label}`, kind: 'earned', tilt: TILT[i], ...PALETTE[4] };
  return { text: s.label, kind: 'word', tilt: TILT[i], ...PALETTE[i] };
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 3 });
// Word-art packs and Hashtags (T-511) have their own lettering in word-art.mjs; everything else is a pill.
// Rendered at 2x (the lettering is large) and then compressed with `pngquant --quality=70-95`, as committed.
const faces = fontFaces(root);
const page2x = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 2 });
async function shoot(s, html, after) {
  const page = page2x;
  await page.setContent(
    `<!doctype html><html><head><style>${faces}${PAGE_CSS}</style></head><body>${html}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  if (after) await page.evaluate(after);
  const out = resolve(root, 'assets', s.asset_path);
  mkdirSync(dirname(out), { recursive: true });
  await page.locator('#s').screenshot({ path: out, omitBackground: true });
  console.log(`assets/${s.asset_path}`);
}
for (const s of catalog) {
  if (WORD_ART_PACKS.includes(s.pack_slug)) {
    // The T-507 pills (no -v2) are retired (0065); their committed art stays as it is.
    if (s.asset_path.endsWith('-v2.png')) await shoot(s, wordArtHtml(s.pack_slug, s.label, s.sort));
    continue;
  }
  if (s.pack_slug === HASHTAG_PACK) {
    await shoot(s, hashtagHtml(s.label, s.sort), bubbleScript);
    continue;
  }
  const st = style(s);
  const frame = {
    word: `background:${st.bg};color:${st.fg};border-radius:18px;padding:10px 18px;`,
    stamp:
      `background:#ffffff;color:#11140d;border:3px solid #11140d;outline:2px dashed #11140d;outline-offset:3px;` +
      `border-radius:10px;padding:8px 16px;letter-spacing:0.08em;`,
    earned: `background:${st.bg};color:${st.fg};border:3px solid #ffe08a;border-radius:999px;padding:10px 20px;`,
  }[st.kind];
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Jakarta; src: url('${font}'); font-weight: 800; }
    html, body { margin: 0; background: transparent; }
    #s { display: inline-block; padding: 14px; }
    #p { display: inline-block; font: 800 26px/1.15 Jakarta; white-space: nowrap; letter-spacing: 0.02em;
         transform: rotate(${st.tilt}deg); box-shadow: 0 3px 8px rgba(0,0,0,0.18); ${frame} }
  </style></head><body><div id="s"><div id="p">${escapeHtml(st.text)}</div></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check('800 26px Jakarta')))) throw new Error('font did not load');
  const out = resolve(root, 'assets', s.asset_path);
  mkdirSync(dirname(out), { recursive: true });
  await page.locator('#s').screenshot({ path: out, omitBackground: true });
  console.log(`assets/${s.asset_path}`);
}
await browser.close();
console.log(`${catalog.length} stickers`);
