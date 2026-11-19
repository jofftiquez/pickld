// Styled word-art lettering for the word packs and hashtag bubbles for the Hashtags pack (T-511), used by
// render-stickers.mjs. Each pack has its own lettering: font, fill, outline, 3D extrusion and small decorations,
// over a white die-cut edge so the sticker reads on any photo. Fonts are OFL Google Fonts from @expo-google-fonts.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONTS = {
  archivo: 'archivo-black/400Regular/ArchivoBlack_400Regular.ttf',
  luckiest: 'luckiest-guy/400Regular/LuckiestGuy_400Regular.ttf',
  pacifico: 'pacifico/400Regular/Pacifico_400Regular.ttf',
  bungee: 'bungee/400Regular/Bungee_400Regular.ttf',
  racing: 'racing-sans-one/400Regular/RacingSansOne_400Regular.ttf',
  hand: 'patrick-hand/400Regular/PatrickHand_400Regular.ttf',
  bangers: 'bangers/400Regular/Bangers_400Regular.ttf',
  chewy: 'chewy/400Regular/Chewy_400Regular.ttf',
  marker: 'permanent-marker/400Regular/PermanentMarker_400Regular.ttf',
  gochi: 'gochi-hand/400Regular/GochiHand_400Regular.ttf',
  fredoka: 'fredoka/700Bold/Fredoka_700Bold.ttf',
  titan: 'titan-one/400Regular/TitanOne_400Regular.ttf',
};

/** @font-face rules with every font inlined (a page made with setContent can't load file:// fonts). */
export function fontFaces(root) {
  return Object.entries(FONTS)
    .map(([name, file]) => {
      const data = readFileSync(resolve(root, 'node_modules/@expo-google-fonts', file)).toString('base64');
      return `@font-face { font-family: ${name}; src: url('data:font/ttf;base64,${data}'); }`;
    })
    .join('\n');
}
export const FONT_NAMES = Object.keys(FONTS);

const RAINBOW =
  'repeating-linear-gradient(180deg,#e8352e 0 14%,#f5892a 14% 28%,#ffd93b 28% 42%,#3fae5a 42% 57%,#2f6fd1 57% 71%,#7a3fb0 71% 86%,#e8352e 86% 100%)';

// One look per pack; `looks` rotate by sticker so a pack has variety inside one style.
const PACKS = {
  corporate: {
    font: 'archivo',
    size: 40,
    upper: false,
    spacing: '-0.01em',
    tilt: [-3, 2, -2, 3],
    skew: 0,
    looks: [
      { fill: '#ffffff', stroke: '#1f3a5f', extrude: '#1f3a5f' },
      { fill: 'linear-gradient(180deg,#ffd76a,#f2a33a)', stroke: '#1f3a5f', extrude: '#1f3a5f' },
      { fill: 'linear-gradient(180deg,#e8f1fb,#a9c8ea)', stroke: '#11140d', extrude: '#2f62b8' },
    ],
    extrudeDepth: 6,
    strokeW: 4,
    decor: 'check',
  },
  'gen-z': {
    font: 'luckiest',
    size: 44,
    upper: true,
    spacing: '0.02em',
    tilt: [-5, 4, -3, 5],
    skew: 0,
    looks: [
      { fill: 'linear-gradient(180deg,#e7ff6e,#9be22d)', stroke: '#11140d', extrude: '#ff5fa2' },
      { fill: 'linear-gradient(180deg,#ffb3d6,#ff4f9a)', stroke: '#11140d', extrude: '#7b3fe4' },
      { fill: 'linear-gradient(180deg,#c9a8ff,#7b3fe4)', stroke: '#11140d', extrude: '#c6f432' },
    ],
    extrudeDepth: 6,
    strokeW: 4,
    decor: 'sparkle',
    shine: true,
  },
  trentahin: {
    font: 'pacifico',
    size: 42,
    upper: false,
    spacing: '0',
    tilt: [-6, -4, -5, -3],
    skew: 0,
    looks: [
      { fill: 'linear-gradient(180deg,#ffd27a 0%,#f08a3c 55%,#c2531f 100%)', stroke: '#5a3416', extrude: '#5a3416' },
      { fill: 'linear-gradient(180deg,#ff9fc4 0%,#e0478f 55%,#8a2c8f 100%)', stroke: '#4a1748', extrude: '#4a1748' },
      { fill: 'linear-gradient(180deg,#b9e6d3 0%,#3f9e86 55%,#1f5f55 100%)', stroke: '#173f39', extrude: '#173f39' },
    ],
    extrudeDepth: 5,
    strokeW: 3,
    decor: 'stars',
    shine: true,
    lineHeight: 1.35,
  },
  pride: {
    font: 'bungee',
    size: 38,
    upper: true,
    spacing: '0.01em',
    tilt: [-3, 3, -2, 2],
    skew: 0,
    looks: [
      { fill: RAINBOW, stroke: '#e0368f', extrude: '#21307a' },
      { fill: RAINBOW, stroke: '#11140d', extrude: '#7a3fb0' },
      {
        fill: 'linear-gradient(180deg,#5bcefa 0 20%,#f5a9b8 20% 40%,#ffffff 40% 60%,#f5a9b8 60% 80%,#5bcefa 80%)',
        stroke: '#21307a',
        extrude: '#21307a',
      },
    ],
    extrudeDepth: 6,
    strokeW: 3,
    decor: 'hearts',
  },
  cyclists: {
    font: 'racing',
    size: 44,
    upper: true,
    spacing: '0.02em',
    tilt: [-4, -3, -5, -2],
    skew: -10,
    looks: [
      { fill: 'linear-gradient(180deg,#ffb15c,#ff6b1a)', stroke: '#11140d', extrude: '#11140d' },
      { fill: 'linear-gradient(180deg,#d6f08a,#7fad33)', stroke: '#11140d', extrude: '#11140d' },
      { fill: 'linear-gradient(180deg,#ffffff,#d9dee6)', stroke: '#11140d', extrude: '#ff6b1a' },
    ],
    extrudeDepth: 5,
    strokeW: 3,
    decor: 'speed',
  },
  gym: {
    font: 'bangers',
    size: 46,
    upper: true,
    spacing: '0.04em',
    tilt: [-4, 3, -3, 4],
    skew: -6,
    looks: [
      { fill: 'linear-gradient(180deg,#ff8a5c,#e8352e)', stroke: '#11140d', extrude: '#11140d' },
      { fill: 'linear-gradient(180deg,#fff3a0,#ffc928)', stroke: '#11140d', extrude: '#e8352e' },
      { fill: 'linear-gradient(180deg,#ffffff,#cfd6df)', stroke: '#11140d', extrude: '#2f62b8' },
    ],
    extrudeDepth: 6,
    strokeW: 3,
    decor: 'bolt',
  },
  foodie: {
    font: 'chewy',
    size: 44,
    upper: false,
    spacing: '0.01em',
    tilt: [-3, 4, -2, 3],
    skew: 0,
    looks: [
      { fill: 'linear-gradient(180deg,#ffd27a,#f08a3c)', stroke: '#6b2d12', extrude: '#6b2d12' },
      { fill: 'linear-gradient(180deg,#ffc2d1,#ff6f91)', stroke: '#6b1d34', extrude: '#6b1d34' },
      { fill: 'linear-gradient(180deg,#d6f08a,#7fad33)', stroke: '#2c4a12', extrude: '#2c4a12' },
    ],
    extrudeDepth: 5,
    strokeW: 3,
    decor: 'steam',
    shine: true,
  },
  travel: {
    font: 'marker',
    size: 40,
    upper: false,
    spacing: '0.01em',
    tilt: [-5, 3, -3, 4],
    skew: 0,
    looks: [
      { fill: '#ffffff', stroke: '#1d5a8a', extrude: '#1d5a8a' },
      { fill: 'linear-gradient(180deg,#9be7ff,#2fa8d8)', stroke: '#0f3550', extrude: '#0f3550' },
      { fill: 'linear-gradient(180deg,#ffe08a,#f5a623)', stroke: '#5a3416', extrude: '#c4521c' },
    ],
    extrudeDepth: 4,
    strokeW: 3,
    decor: 'plane',
    lineHeight: 1.2,
  },
  student: {
    font: 'gochi',
    size: 46,
    upper: false,
    spacing: '0.01em',
    tilt: [-3, 2, -4, 3],
    skew: 0,
    looks: [
      { fill: '#ffffff', stroke: '#2f62b8', extrude: '#2f62b8' },
      { fill: 'linear-gradient(180deg,#fff7b0,#ffe066)', stroke: '#11140d', extrude: '#11140d' },
      { fill: 'linear-gradient(180deg,#ffd1dc,#ff8fab)', stroke: '#4a1748', extrude: '#4a1748' },
    ],
    extrudeDepth: 4,
    strokeW: 3,
    decor: 'pencil',
  },
  parents: {
    font: 'fredoka',
    size: 42,
    upper: false,
    spacing: '0',
    tilt: [-3, 3, -2, 2],
    skew: 0,
    looks: [
      { fill: 'linear-gradient(180deg,#c9f0e4,#5cc2a5)', stroke: '#1f5f55', extrude: '#1f5f55' },
      { fill: 'linear-gradient(180deg,#ffe3b3,#ffb35c)', stroke: '#6b3a12', extrude: '#6b3a12' },
      { fill: 'linear-gradient(180deg,#e3dcff,#9b86f0)', stroke: '#3a2a7a', extrude: '#3a2a7a' },
    ],
    extrudeDepth: 5,
    strokeW: 3,
    decor: 'hearts',
    shine: true,
  },
  'fan-life': {
    font: 'titan',
    size: 40,
    upper: true,
    spacing: '0.02em',
    tilt: [-4, 4, -3, 3],
    skew: 0,
    looks: [
      { fill: 'linear-gradient(180deg,#ffffff,#ffd6f0)', stroke: '#c2187a', extrude: '#6a1b9a' },
      { fill: 'linear-gradient(180deg,#b5f1ff,#4fc3f7)', stroke: '#11140d', extrude: '#ff4fa3' },
      { fill: 'linear-gradient(180deg,#fff59d,#ffca28)', stroke: '#11140d', extrude: '#7b3fe4' },
    ],
    extrudeDepth: 6,
    strokeW: 3,
    decor: 'sparkle',
    shine: true,
  },
};

export const WORD_ART_PACKS = Object.keys(PACKS);
export const HASHTAG_PACK = 'hashtags';

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Two lines for long phrases, split at the space nearest the middle. */
function lines(text, max) {
  if (text.length <= max || !text.includes(' ')) return [text];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++)
    if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [text.slice(0, best), text.slice(best + 1)];
}

const DECOR = {
  sparkle: (c) =>
    `<svg class="d" style="right:-6px;top:-4px" width="40" height="40" viewBox="0 0 40 40"><path d="M20 2 C22 14 26 18 38 20 C26 22 22 26 20 38 C18 26 14 22 2 20 C14 18 18 14 20 2Z" fill="${c}" stroke="#11140d" stroke-width="2.5" stroke-linejoin="round"/></svg>` +
    `<svg class="d" style="left:-10px;bottom:-8px" width="24" height="24" viewBox="0 0 40 40"><path d="M20 2 C22 14 26 18 38 20 C26 22 22 26 20 38 C18 26 14 22 2 20 C14 18 18 14 20 2Z" fill="#ffffff" stroke="#11140d" stroke-width="3" stroke-linejoin="round"/></svg>`,
  stars: (c) =>
    `<svg class="d" style="right:0;top:2px" width="26" height="26" viewBox="0 0 24 24"><path d="M12 1l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.2 5.6 20.6 7 13.5l-5.3-5 7.2-.9z" fill="#ffd93b" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  hearts: (c) =>
    `<svg class="d" style="right:-2px;top:-2px" width="30" height="30" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#ff5fa2" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  check: (c) =>
    `<svg class="d" style="right:-4px;top:-2px" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#7fad33" stroke="${c}" stroke-width="3"/><path d="M10 16.5l4 4 8-9" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bolt: (c) =>
    `<svg class="d" style="right:-6px;top:-6px" width="34" height="40" viewBox="0 0 24 28"><path d="M14 1L3 16h7l-2 11 11-15h-7z" fill="#ffd93b" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  steam: (c) =>
    `<svg class="d" style="right:-2px;top:-8px" width="30" height="34" viewBox="0 0 24 28"><g fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"><path d="M6 26c-3-4 3-6 0-10s3-6 0-10"/><path d="M13 26c-3-4 3-6 0-10s3-6 0-10"/><path d="M20 26c-3-4 3-6 0-10s3-6 0-10"/></g></svg>`,
  plane: (c) =>
    `<svg class="d" style="right:-8px;top:-8px" width="38" height="38" viewBox="0 0 24 24"><path d="M2 11l20-8-7 19-3-8z" fill="#ffffff" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><path d="M12 14l10-11" stroke="${c}" stroke-width="1.6"/></svg>`,
  pencil: (c) =>
    `<svg class="d" style="right:-6px;top:-6px" width="36" height="36" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ffd93b" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 20l1-5 4 4z" fill="#f5d7b0" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l4 4" stroke="${c}" stroke-width="1.6"/></svg>`,
  speed: (c) =>
    `<svg class="d" style="left:-2px;top:50%;transform:translateY(-50%)" width="40" height="46" viewBox="0 0 40 46"><g stroke="${c}" stroke-width="5" stroke-linecap="round"><line x1="8" y1="9" x2="36" y2="9"/><line x1="2" y1="23" x2="34" y2="23"/><line x1="12" y1="37" x2="36" y2="37"/></g></svg>`,
};

/** The page body for one word-art sticker; the screenshot target is #s. */
export function wordArtHtml(packSlug, label, sort) {
  const p = PACKS[packSlug];
  const look = p.looks[(sort - 1) % p.looks.length];
  const tilt = p.tilt[(sort - 1) % p.tilt.length];
  const text = p.upper ? label.toUpperCase() : label;
  const body = lines(text, p.font === 'pacifico' ? 16 : 13)
    .map(esc)
    .join('<br>');
  const steps = p.extrudeDepth;
  const cut = 7; // white die-cut, beyond the outline
  const layer = (style, extra = '') => `<div class="l" style="${style}">${extra}${body}</div>`;
  const layers = [];
  // Die-cut: white, thick stroke, at every extrusion step so the edge wraps the 3D part too. The #cut filter grows
  // the white steps by `cut` with a round edge (dilate, soften, re-sharpen): smooth when the art is drawn big.
  const cutFilter = `<svg width="0" height="0" style="position:absolute"><filter id="cut" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="${cut - 1.5}"/><feGaussianBlur stdDeviation="1.5"/>
    <feComponentTransfer result="a"><feFuncA type="linear" slope="6" intercept="-2"/></feComponentTransfer>
    <feFlood flood-color="#fff"/><feComposite in2="a" operator="in"/></filter></svg>`;
  const white = [];
  for (let k = steps; k >= 0; k -= 1) {
    white.push(layer(`color:#fff;-webkit-text-stroke:${p.strokeW * 2}px #fff;transform:translate(${k}px,${k}px)`));
  }
  layers.push(`<div class="l stack" style="padding:0;filter:url(#cut)">${white.join('')}</div>`);
  for (let k = steps; k >= 0.5; k -= 0.5) {
    layers.push(
      layer(
        `color:${look.extrude};-webkit-text-stroke:${p.strokeW * 2}px ${look.extrude};transform:translate(${k}px,${k}px)`,
      ),
    );
  }
  layers.push(layer(`color:${look.stroke};-webkit-text-stroke:${p.strokeW * 2}px ${look.stroke}`));
  const fillStyle = look.fill.includes('gradient')
    ? `background:${look.fill};-webkit-background-clip:text;background-clip:text;color:transparent`
    : `color:${look.fill}`;
  layers.push(layer(fillStyle));
  if (p.shine) {
    layers.push(
      layer(
        'background:linear-gradient(180deg,rgba(255,255,255,0.55) 0 30%,rgba(255,255,255,0) 46%);-webkit-background-clip:text;background-clip:text;color:transparent',
      ),
    );
  }
  const room = p.decor === 'speed' ? 'padding:0 0 0 38px' : 'padding:18px 24px 0 0';
  return `${cutFilter}<div id="s"><div id="w" style="transform:rotate(${tilt}deg) skewX(${p.skew}deg);${room}">
    <div class="stack" style="font-family:${p.font};font-size:${p.size}px;letter-spacing:${p.spacing};line-height:${p.lineHeight ?? 1.08}">${layers.join('')}</div>
    ${DECOR[p.decor](look.stroke)}
  </div></div>`;
}

// ---------------------------------------------------------------- hashtag bubbles
const BUBBLE_COLORS = [
  { bg: '#e86a5f', fg: '#ffffff' },
  { bg: '#2e6f63', fg: '#ffffff' },
  { bg: '#f2a33a', fg: '#ffffff' },
  { bg: '#e9dcae', fg: '#5a3d2b' },
  { bg: '#7a6a5e', fg: '#ffffff' },
  { bg: '#6b3a2a', fg: '#ffffff' },
  { bg: '#3d7cc9', fg: '#ffffff' },
  { bg: '#c7569a', fg: '#ffffff' },
];
const SHAPES = ['cloud', 'oval', 'spiky', 'drop', 'rect'];

function bubblePath(shape, w, h, seed) {
  const cx = w / 2;
  const cy = h / 2;
  if (shape === 'oval') {
    const ellipse = `M0,${cy} a${cx},${cy} 0 1,1 ${w},0 a${cx},${cy} 0 1,1 ${-w},0Z`;
    return `${ellipse}M${w * 0.18},${h * 0.8} L${w * 0.38},${h * 0.92} L${w * 0.06},${h * 1.2}Z`;
  }
  if (shape === 'rect') {
    const r = h * 0.38;
    return `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${w * 0.3} L${w * 0.1},${h * 1.22} L${w * 0.16},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0Z`;
  }
  if (shape === 'spiky') {
    const n = 18;
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n;
      const jitter = 1 + 0.06 * Math.sin(seed * 7 + i * 3.3);
      const rx = (i % 2 === 0 ? w * 0.56 : w * 0.44) * jitter;
      const ry = (i % 2 === 0 ? h * 0.72 : h * 0.5) * jitter;
      d += `${i === 0 ? 'M' : 'L'}${(cx + rx * Math.cos(a)).toFixed(1)},${(cy + ry * Math.sin(a)).toFixed(1)}`;
    }
    return `${d}Z`;
  }
  if (shape === 'drop') {
    // A balloon with its point out to the lower left, like a thought swoosh.
    return `M${w * 0.06},${h * 1.12} C${w * 0.2},${h * 0.82} ${w * 0.02},${h * 0.2} ${w * 0.34},${h * 0.02} C${w * 0.62},${-h * 0.12} ${w * 1.05},${h * 0.04} ${w * 1.02},${h * 0.5} C${w},${h * 0.98} ${w * 0.5},${h * 1.06} ${w * 0.06},${h * 1.12}Z`;
  }
  // cloud: bumps around a rounded body, tail at the bottom right.
  const bumps = [];
  const nx = Math.max(3, Math.round(w / (h * 0.55)));
  const r = (w / nx) * 0.62;
  for (let i = 0; i < nx; i++) {
    const x = r * 0.9 + ((w - r * 1.8) * i) / (nx - 1);
    bumps.push(
      [x, r * 0.75, r * (0.9 + 0.12 * Math.sin(seed + i * 1.7))],
      [x, h - r * 0.75, r * (0.9 + 0.12 * Math.cos(seed + i * 2.1))],
    );
  }
  bumps.push([r * 0.6, cy, r * 0.95], [w - r * 0.6, cy, r * 0.95]);
  const circles = bumps
    .map(([x, y, rr]) => `M${x - rr},${y} a${rr},${rr} 0 1,1 ${rr * 2},0 a${rr},${rr} 0 1,1 ${-rr * 2},0Z`)
    .join('');
  const body = `M${r * 0.6},${r * 0.6} H${w - r * 0.6} V${h - r * 0.6} H${r * 0.6}Z`;
  const tail = `M${w * 0.62},${h * 0.8} L${w * 0.84},${h * 0.8} L${w * 0.86},${h * 1.25}Z`;
  return body + circles + tail;
}

/** The page body for one hashtag bubble. Sizing happens in the page (it needs the measured text width). */
export function hashtagHtml(label, sort) {
  const c = BUBBLE_COLORS[(sort - 1) % BUBBLE_COLORS.length];
  const shape = SHAPES[(sort - 1) % SHAPES.length];
  const tilt = [-4, 3, -2, 4, -3][(sort - 1) % 5];
  return `<div id="s" class="tight"><div id="w" style="transform:rotate(${tilt}deg)"><span id="m" style="font-family:hand;font-size:46px;visibility:hidden;position:absolute;white-space:nowrap">${esc(label)}</span><svg id="b"></svg></div></div>
  <script>window.__bubble = ${JSON.stringify({ label, shape, bg: c.bg, fg: c.fg, seed: sort })};</script>`;
}

/** Runs in the page after fonts load: draws the bubble around the measured text. */
export const bubbleScript = `(${(bubblePathSrc) => {
  const { label, shape, bg, fg, seed } = window.__bubble;
  const bubblePath = new Function(`return ${bubblePathSrc}`)();
  const m = document.getElementById('m').getBoundingClientRect();
  const padX = shape === 'spiky' ? 40 : shape === 'cloud' ? 34 : shape === 'drop' ? 40 : 28;
  const padY = shape === 'spiky' ? 30 : shape === 'cloud' ? 26 : 18;
  const w = m.width + padX * 2;
  const h = m.height + padY * 2;
  const margin = 22;
  const svg = document.getElementById('b');
  const W = w + margin * 2;
  const H = h * 1.3 + margin * 2;
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `${-margin} ${-margin} ${W} ${H}`);
  const d = bubblePath(shape, w, h, seed);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  svg.innerHTML = `
    <defs>
      <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.2"/></filter>
    </defs>
    <path d="${d}" fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round" filter="url(#sh)"/>
    <path d="${d}" fill="${bg}"/>
    <text x="${shape === 'drop' ? w * 0.56 : w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-family="hand" font-size="46" fill="${fg}" stroke="${fg}" stroke-width="0.9" letter-spacing="0.5">${esc(label)}</text>`;
  // Crop to the bubble: its outline (8px white edge) plus room for the shadow.
  const bb = svg.querySelector('path').getBBox();
  const x = bb.x - 12;
  const y = bb.y - 12;
  svg.setAttribute('width', bb.width + 24);
  svg.setAttribute('height', bb.height + 28);
  svg.setAttribute('viewBox', `${x} ${y} ${bb.width + 24} ${bb.height + 28}`);
}})(${JSON.stringify(bubblePath.toString())})`;

/** Shared page CSS for word art and bubbles. */
export const PAGE_CSS = `
  html, body { margin: 0; background: transparent; }
  #s { display: inline-block; padding: 28px 40px 28px 46px; }
  #s.tight { padding: 6px; }
  #w { position: relative; display: inline-block; }
  .stack { display: grid; white-space: nowrap; text-align: center; word-spacing: 0.12em; }
  .stack > .l { grid-area: 1 / 1; padding: 0 4px; position: relative; }
  #w { filter: drop-shadow(0 3px 4px rgba(0,0,0,0.22)); }
  .d { position: absolute; overflow: visible;
       filter: drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff); }
`;
