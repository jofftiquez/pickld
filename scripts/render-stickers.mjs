// Renders the sticker art in assets/stickers/<pack>/<name>.png from the catalog in the local database.
// Usage: node scripts/render-stickers.mjs [--force] [pack-slug ...]   (no slugs: every pack)
// With STICKER_CATALOG=<file.json> it renders those rows (public_sticker_catalog()'s shape) instead of reading the
// local database, so art for a migration that isn't applied yet can be rendered without touching the database.
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

async function readCatalog() {
  if (process.env.STICKER_CATALOG) return JSON.parse(readFileSync(resolve(process.env.STICKER_CATALOG), 'utf8'));
  // Local stack only: the URL and anon key are read at runtime, never stored.
  const statusText = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const status = JSON.parse(statusText.slice(statusText.indexOf('{')));
  const res = await fetch(`${status.API_URL}/rest/v1/rpc/public_sticker_catalog`, {
    method: 'POST',
    headers: {
      apikey: status.ANON_KEY,
      authorization: `Bearer ${status.ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error(`public_sticker_catalog: ${res.status} ${await res.text()}`);
  return res.json();
}
const force = process.argv.includes('--force');
const only = process.argv.slice(2).filter((a) => a !== '--force');
const catalog = (await readCatalog()).filter(
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

// Milestone badges (0168, -v2 art): a gold rosette with a big number and a ribbon banner, so earning one feels like
// a reward. The ribbon's colour tells the kind apart: jars green, full jars pink, friends blue, the year purple.
const RIBBON = { jars: '#5fae2e', full: '#ff5c93', friends: '#2f9bf0', year: '#8b5cf6' };
function milestoneParts(label) {
  const n = /^(\d+) (full jars|jars)$/.exec(label);
  if (n) return { big: n[1], word: n[2], ribbon: n[2] === 'jars' ? RIBBON.jars : RIBBON.full };
  return (
    {
      'First full jar': { big: '1', sup: 'st', word: 'full jar', ribbon: RIBBON.full },
      '1 year of jars': { big: '1', word: 'year of jars', ribbon: RIBBON.year },
      'First friend': { big: '1', sup: 'st', word: 'friend', ribbon: RIBBON.friends },
      'Full jar of friends': { big: '8', word: 'friends joined', ribbon: RIBBON.friends },
    }[label] ?? { big: '★', word: label, ribbon: RIBBON.jars }
  );
}
function milestoneHtml(label) {
  const m = milestoneParts(label);
  const star = (outer, inner, k) =>
    Array.from({ length: k * 2 }, (_, i) => {
      const r = i % 2 ? inner : outer;
      const a = (Math.PI * i) / k - Math.PI / 2;
      return `${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`;
    }).join(',');
  const ink = '#3d2300';
  // A smooth outline of width w around everything drawn: dilate the shape, soften it, then cut it back to a crisp edge.
  const outline = (id, c, w) =>
    `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${w - 1}" result="d"/>` +
    `<feGaussianBlur in="d" stdDeviation="1" result="b"/>` +
    `<feComponentTransfer in="b" result="a"><feFuncA type="linear" slope="6" intercept="-1.5"/></feComponentTransfer>` +
    `<feFlood flood-color="${c}" result="c"/><feComposite in="c" in2="a" operator="in" result="o"/>` +
    `<feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const sparkle = (x, y, size, c) =>
    `<i style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${c};` +
    `clip-path:polygon(${star(50, 13, 4)})"></i>`;
  return `<style>@font-face { font-family: Jakarta; src: url('${font}'); font-weight: 800; }
    #s { display: inline-block; padding: 22px; }
    .b { position: relative; width: 250px; height: 292px; filter: url(#w) drop-shadow(0 6px 8px rgba(0,0,0,0.22)); }
    .o { position: absolute; inset: 0; filter: url(#k); }
    .tail { position: absolute; top: 168px; width: 58px; height: 118px; background: ${m.ribbon};
            clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
            background-image: linear-gradient(90deg, rgba(255,255,255,0.25) 0 30%, rgba(0,0,0,0.08) 70%); }
    .ros { position: absolute; left: 15px; top: 0; width: 220px; height: 220px; clip-path: polygon(${star(50, 46.5, 26)});
           background: radial-gradient(circle at 38% 30%, #fff3a6, #ffc928 45%, #f29a00 100%); }
    .disc { position: absolute; left: 47px; top: 32px; width: 156px; height: 156px; border-radius: 50%; box-sizing: border-box;
            border: 6px solid #fff0a0; box-shadow: 0 0 0 3px ${ink}, inset 0 -8px 0 rgba(200,110,0,0.35);
            background: radial-gradient(circle at 35% 28%, #fffbe0, #ffe066 40%, #ffb800 100%); }
    .shine { position: absolute; left: 76px; top: 52px; width: 46px; height: 20px; border-radius: 50%;
             background: rgba(255,255,255,0.85); transform: rotate(-28deg); }
    .num { position: absolute; left: 47px; top: 34px; width: 156px; text-align: center; font: 800 ${m.big.length > 2 ? 62 : 74}px/1 Jakarta;
           color: #8a4600; text-shadow: 0 3px 0 #fff6c2, 0 -2px 0 rgba(120,60,0,0.25); letter-spacing: -0.02em; padding-top: ${m.big.length > 2 ? 30 : 24}px; }
    .num sup { font-size: 0.42em; vertical-align: 0.9em; margin-left: 2px; }
    .band { position: absolute; left: 0; top: 146px; width: 250px; height: 46px; background: ${m.ribbon};
            clip-path: polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%);
            background-image: linear-gradient(180deg, rgba(255,255,255,0.3) 0 45%, rgba(0,0,0,0.1) 100%);
            display: flex; align-items: center; justify-content: center; color: #ffffff; text-transform: uppercase;
            font: 800 ${m.word.length > 12 ? 16 : 19}px/1 Jakarta; letter-spacing: 0.06em; text-shadow: 0 2px 0 rgba(0,0,0,0.22); }
  </style><svg width="0" height="0" style="position:absolute">${outline('w', '#ffffff', 6)}${outline('k', ink, 3)}</svg>
  <div id="s"><div class="b">
    <div class="o"><div class="tail" style="left:62px;transform:rotate(14deg)"></div><div class="tail" style="left:130px;transform:rotate(-14deg)"></div></div>
    <div class="o"><div class="ros"></div></div>
    <div class="disc"></div><div class="shine"></div>
    <div class="num">${escapeHtml(m.big)}${m.sup ? `<sup>${m.sup}</sup>` : ''}</div>
    <div class="o"><div class="band">${escapeHtml(m.word)}</div></div>
    ${sparkle(4, 10, 34, '#ffd84a')}${sparkle(212, 4, 28, '#ffd84a')}
  </div></div>`;
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Stickers can be pinched to twice the photo's width, so the art is drawn big: each sticker is measured at 1x, then
// drawn at the pixel density that makes its longest side MAX_PX (the catalog's art_width/art_height limit, 0100),
// at most MAX_DENSITY. Density scales strokes, shadows and filters alike, where CSS zoom would not. Compress the
// result with `pngquant --quality=70-95`, as committed.
const MAX_PX = 2048;
const MAX_DENSITY = 16;
const VIEWPORT = { width: 1200, height: 600 };
const browser = await chromium.launch();
const measure = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
// Word-art packs and Hashtags (T-511) have their own lettering in word-art.mjs; everything else is a pill.
const faces = fontFaces(root);
async function load(page, doc, after) {
  await page.setContent(doc);
  await page.evaluate(() => document.fonts.ready);
  if (after) await page.evaluate(after);
}
async function render(s, doc, after) {
  await load(measure, doc, after);
  const box = await measure.locator('#s').boundingBox();
  if (!box) throw new Error(`${s.asset_path}: nothing to draw`);
  const deviceScaleFactor = Math.min(MAX_DENSITY, MAX_PX / Math.max(box.width, box.height));
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor });
  await load(page, doc, after);
  const out = resolve(root, 'assets', s.asset_path);
  mkdirSync(dirname(out), { recursive: true });
  // A clip of the measured box, not an element screenshot: heavy lettering redraws too slowly for Playwright's
  // stability check at high density.
  await page.screenshot({ path: out, omitBackground: true, clip: box, timeout: 120_000 });
  await page.close();
  console.log(`assets/${s.asset_path}`);
}
const shoot = (s, html, after) =>
  render(s, `<!doctype html><html><head><style>${faces}${PAGE_CSS}</style></head><body>${html}</body></html>`, after);
for (const s of catalog) {
  if (WORD_ART_PACKS.includes(s.pack_slug)) {
    // The T-507 pills restyled under -v2 names are retired (0065); their committed art stays as it is.
    const restyled = existsSync(resolve(root, 'assets', s.asset_path.replace(/\.png$/, '-v2.png')));
    if (!restyled) await shoot(s, wordArtHtml(s.pack_slug, s.label, s.sort));
    continue;
  }
  if (s.pack_slug === HASHTAG_PACK) {
    await shoot(s, hashtagHtml(s.label, s.sort), bubbleScript);
    continue;
  }
  // The pill milestones (0012, 0060, 0135) are retired in 0168; their committed art stays as it is.
  if (s.pack_slug === 'milestones' && s.asset_path.endsWith('-v2.png')) {
    await shoot(s, milestoneHtml(s.label));
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
  const fontCheck = () => {
    if (!document.fonts.check('800 26px Jakarta')) throw new Error('font did not load');
  };
  await render(
    s,
    `<!doctype html><html><head><style>
    @font-face { font-family: Jakarta; src: url('${font}'); font-weight: 800; }
    html, body { margin: 0; background: transparent; }
    #s { display: inline-block; padding: 14px; }
    #p { display: inline-block; font: 800 26px/1.15 Jakarta; white-space: nowrap; letter-spacing: 0.02em;
         transform: rotate(${st.tilt}deg); box-shadow: 0 3px 8px rgba(0,0,0,0.18); ${frame} }
  </style></head><body><div id="s"><div id="p">${escapeHtml(st.text)}</div></div></body></html>`,
    fontCheck,
  );
}
await browser.close();
console.log(`${catalog.length} stickers`);
