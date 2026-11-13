// Finished photos for the data export (T-508; FR-PRV-02, FR-CAP-04..08): a moment's stored photo with its
// `edits` drawn on, the way the app's moment renderer (M2-18, MomentView) shows it in the moment detail.
// Edits stay data everywhere else (FR-CAP-08); only the export gets a drawn copy.
//
// Drawn with Skia's own WebAssembly build (canvaskit-wasm 0.42.0 "full", BSD-3, D-45), so the color filter is the same
// Skia color matrix the app's React Native Skia applies. Sticker art comes from the public stickers/ keys
// by the asset path saved in the overlay, so retired stickers (0032) and packs the owner no longer has
// still draw (FR-STK-04). Fonts are bundled (fonts/fonts.ts): Plus Jakarta Sans as the app bundles it,
// and free stand-ins for the phone faces the Type and Serif text styles use (DejaVu Sans Mono, which Menlo
// is built on; Gelasio, made to Georgia's metrics). Glyphs none of them has (emoji) are left out.
//
// The output is a JPEG at the stored photo's width, 3:4.
import type { Canvas, CanvasKit, Image, Paragraph, TypefaceFontProvider } from 'npm:canvaskit-wasm@0.42.0';
import { z } from './deps.ts';
import { FONTS } from './fonts/fonts.ts';
import {
  BUBBLE,
  BUBBLE_COLORS,
  bubbleAspect,
  bubbleLines,
  bubblePaddingX,
  FILTER_MATRICES,
  INK,
  layoutText,
  PHOTO_ASPECT,
  REF_WIDTH,
  STAMP,
  stampText,
  STICKER_FALLBACK_ASPECT,
  SURFACE,
  TEXT_COLORS,
  TEXT_SHADOW,
  TEXT_SHADOW_AT_30,
  TEXT_TRACKING,
} from './moment_layout.ts';

export const JPEG_QUALITY = 90;

// ---------------------------------------------------------------- edits (lenient, like parseEdits)

const base = {
  id: z.string().min(1).max(64),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().positive().max(4),
  rotation: z.number().min(-2 * Math.PI).max(2 * Math.PI),
};
const colorName = z.enum(['white', 'ink', 'pickle', 'butter', 'blush', 'sky']);
const overlaySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sticker'),
    ...base,
    asset: z.string().regex(/^stickers\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}\.png$/),
    stamp: z.enum(['time', 'date', 'weekday', 'jar_number']).optional(),
  }),
  z.object({
    type: z.literal('bubble'),
    ...base,
    shape: z.enum(['speech', 'thought', 'shout', 'whisper']).default('speech'),
    color: colorName.default('white'),
    text: z.string().max(60).default(''),
  }),
  z.object({
    type: z.literal('text'),
    ...base,
    text: z.string().max(80).refine((s) => s.trim().length > 0),
    font: z.enum(['clean', 'bold', 'type', 'serif']).default('bold'),
    color: colorName.default('white'),
    size: z.number().int().min(12).max(64).default(30),
    align: z.enum(['left', 'center']).default('center'),
  }),
]);
type Overlay = z.infer<typeof overlaySchema>;
const filterId = z.enum(['original', 'kalamansi', 'merienda', 'mono', 'dusk']);

export interface FinishedEdits {
  filter: z.infer<typeof filterId>;
  overlays: Overlay[];
}

/** Reads stored edits like the app's parseEdits: never throws, bad fields and overlays fall back or drop. */
export function readEdits(raw: unknown): FinishedEdits {
  const stored = z.object({
    filter: filterId.catch('original'),
    overlays: z.array(z.unknown()).catch([]),
  }).safeParse(raw);
  if (!stored.success) return { filter: 'original', overlays: [] };
  const seen = new Set<string>();
  const overlays = stored.data.overlays.flatMap((value) => {
    const o = overlaySchema.safeParse(value);
    if (!o.success || seen.has(o.data.id)) return [];
    seen.add(o.data.id);
    return [o.data];
  });
  return { filter: stored.data.filter, overlays };
}

/** True when the edits change the plain photo (momentRender.ts hasVisibleEdits). */
export function hasVisibleEdits(raw: unknown): boolean {
  const e = readEdits(raw);
  return e.filter !== 'original' || e.overlays.length > 0;
}

// ---------------------------------------------------------------- Skia

interface Kit {
  ck: CanvasKit;
  fonts: TypefaceFontProvider;
}

const TEXT_FONT: Record<string, string> = { clean: 'jakarta-600', bold: 'jakarta-800', type: 'mono', serif: 'serif' };

// Skia is fetched when a worker first draws instead of bundled: npm:canvaskit-wasm carries every build
// (about 25 MB), past the 20 MB a deployed function may weigh. Both files are pinned by hash.
const CANVASKIT = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.42.0/bin/full/';
const CANVASKIT_JS_SHA256 = '894815b2d39b24de2eacdb01453778d83e0b6c418b034e3b728e80956ac2a9d5';
const CANVASKIT_WASM_SHA256 = 'aca7fa6019f95d3de98d4a49ae60a3d66a09e9d5ca74091fbc369b9be959f959';

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function fetchPinned(name: string, sha256: string): Promise<ArrayBuffer> {
  const res = await fetch(CANVASKIT + name);
  if (!res.ok) throw new Error(`render: ${name} ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha256) throw new Error(`render: ${name} hash`);
  return bytes;
}

type CanvasKitInit = (opts: { locateFile: (file: string) => string }) => Promise<CanvasKit>;

async function loadCanvasKit(): Promise<CanvasKit> {
  const [js, wasm] = await Promise.all([
    fetchPinned('canvaskit.js', CANVASKIT_JS_SHA256),
    fetchPinned('canvaskit.wasm', CANVASKIT_WASM_SHA256),
  ]);
  // The glue is an Emscripten script that picks Node, browser or worker by the globals it sees. With
  // those hidden it takes the plain path: it compiles the module it is pointed at with
  // WebAssembly.instantiateStreaming, here the checked bytes behind a blob: URL.
  const init = new Function(
    'module',
    'exports',
    'define',
    'require',
    'process',
    'window',
    'document',
    'WorkerGlobalScope',
    '__filename',
    `${new TextDecoder().decode(js)}\nreturn CanvasKitInit;`,
  )() as CanvasKitInit;
  const url = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
  try {
    return await init({ locateFile: () => url });
  } finally {
    URL.revokeObjectURL(url);
  }
}

let kit: Promise<Kit> | null = null;

/** Loads Skia and the fonts once per worker. */
export function skia(): Promise<Kit> {
  kit ??= (async () => {
    const ck = await loadCanvasKit();
    const fonts = ck.TypefaceFontProvider.Make();
    for (const [family, b64] of Object.entries(FONTS)) {
      fonts.registerFont(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), family);
    }
    return { ck, fonts };
  })();
  kit.catch(() => (kit = null));
  return kit;
}

/** Where the moment draws stickers' art from (the bucket's public stickers/ keys). */
export type AssetSource = (key: string) => Promise<Uint8Array | null>;

export interface FinishedInput {
  photo: Uint8Array;
  edits: unknown;
  /** captured_at, else added_at: what the moment detail gives auto stamps. */
  capturedAt: Date;
  /** The jar's IANA zone. */
  tz: string;
}

export interface FinishedRenderer {
  render(input: FinishedInput): Promise<Uint8Array>;
  /** Frees the sticker art kept between moments. */
  close(): void;
}

/** A renderer for one export: sticker art is fetched once and reused for every moment. */
export function finishedRenderer(assets: AssetSource): FinishedRenderer {
  const art = new Map<string, Image | null>();
  return {
    async render(input) {
      const k = await skia();
      const edits = readEdits(input.edits);
      for (const o of edits.overlays) {
        if (o.type !== 'sticker' || art.has(o.asset)) continue;
        const bytes = await assets(o.asset);
        art.set(o.asset, bytes ? k.ck.MakeImageFromEncoded(bytes) : null);
      }
      return draw(k, input, edits, art);
    },
    close() {
      for (const img of art.values()) img?.delete();
      art.clear();
    },
  };
}

function draw(k: Kit, input: FinishedInput, edits: FinishedEdits, art: Map<string, Image | null>): Uint8Array {
  const { ck } = k;
  const trash: { delete(): void }[] = [];
  const keep = <T extends { delete(): void }>(o: T): T => {
    trash.push(o);
    return o;
  };
  try {
    const photo = ck.MakeImageFromEncoded(input.photo);
    if (!photo) throw new Error('render: the photo could not be decoded');
    keep(photo);
    // A 3:4 frame at the photo's width; a photo of another shape is centred and cropped (cover).
    const W = photo.width();
    const H = Math.round(W / PHOTO_ASPECT);
    const surface = ck.MakeSurface(W, H);
    if (!surface) throw new Error('render: no surface');
    keep(surface);
    const canvas = surface.getCanvas();
    canvas.clear(ck.WHITE);

    const scale = Math.max(W / photo.width(), H / photo.height());
    const dw = photo.width() * scale;
    const dh = photo.height() * scale;
    const paint = keep(new ck.Paint());
    paint.setColorFilter(keep(ck.ColorFilter.MakeMatrix([...FILTER_MATRICES[edits.filter]])));
    canvas.drawImageRectOptions(
      photo,
      ck.XYWHRect(0, 0, photo.width(), photo.height()),
      ck.XYWHRect((W - dw) / 2, (H - dh) / 2, dw, dh),
      ck.FilterMode.Linear,
      ck.MipmapMode.Linear,
      paint,
    );

    const u = W / REF_WIDTH; // pixels per design point
    for (const o of edits.overlays) {
      const sticker = o.type === 'sticker' ? art.get(o.asset) ?? null : null;
      const aspect = o.type === 'sticker'
        ? sticker ? sticker.height() / sticker.width() : STICKER_FALLBACK_ASPECT
        : o.type === 'bubble'
        ? bubbleAspect(o.text, o.shape)
        : layoutText(o).height / layoutText(o).width;
      const w = o.scale * W;
      const h = w * aspect;
      const cx = o.x * W;
      const cy = o.y * H;
      canvas.save();
      canvas.translate(cx, cy);
      canvas.rotate((o.rotation * 180) / Math.PI, 0, 0);
      canvas.translate(-w / 2, -h / 2);
      if (o.type === 'sticker') drawSticker(k, canvas, keep, o, sticker, w, h, u, input);
      else if (o.type === 'bubble') drawBubble(k, canvas, keep, o, w, h, u);
      else drawText(k, canvas, keep, o, w);
      canvas.restore();
    }

    const out = keep(surface.makeImageSnapshot()).encodeToBytes(ck.ImageFormat.JPEG, JPEG_QUALITY);
    if (!out) throw new Error('render: could not encode');
    return out;
  } finally {
    for (const o of trash.reverse()) o.delete();
  }
}

type Keep = <T extends { delete(): void }>(o: T) => T;

function color(ck: CanvasKit, css: string, alpha = 1) {
  const c = ck.parseColorString(css);
  c[3] *= alpha;
  return c;
}

/** A paragraph in one of the bundled families. */
function paragraph(
  k: Kit,
  keep: Keep,
  text: string,
  o: {
    family: string;
    size: number;
    lineHeight: number;
    color: string;
    align: 'left' | 'center';
    letterSpacing?: number;
    maxLines?: number;
    shadow?: { color: string; offsetY: number; sigma: number };
    width: number;
  },
): Paragraph {
  const { ck } = k;
  const style = new ck.ParagraphStyle({
    textAlign: o.align === 'left' ? ck.TextAlign.Left : ck.TextAlign.Center,
    maxLines: o.maxLines,
    textStyle: {
      color: color(ck, o.color),
      fontFamilies: [o.family],
      fontSize: o.size,
      heightMultiplier: o.lineHeight / o.size,
      halfLeading: true,
      letterSpacing: o.letterSpacing ?? 0,
      shadows: o.shadow
        ? [{ color: color(ck, o.shadow.color), offset: [0, o.shadow.offsetY], blurRadius: o.shadow.sigma }]
        : [],
    },
  });
  const builder = keep(ck.ParagraphBuilder.MakeFromFontProvider(style, k.fonts));
  builder.addText(text);
  const p = keep(builder.build());
  p.layout(o.width);
  return p;
}

function rrect(l: number, t: number, r: number, b: number, radii: [number, number, number, number]) {
  // Per-corner radii: top-left, top-right, bottom-right, bottom-left (each x then y).
  const [tl, tr, br, bl] = radii.map((x) => Math.min(x, (r - l) / 2, (b - t) / 2));
  return Float32Array.of(l, t, r, b, tl, tl, tr, tr, br, br, bl, bl);
}

function drawSticker(
  k: Kit,
  canvas: Canvas,
  keep: Keep,
  o: Extract<Overlay, { type: 'sticker' }>,
  sticker: Image | null,
  w: number,
  h: number,
  u: number,
  input: FinishedInput,
) {
  const { ck } = k;
  const live = o.stamp ? stampText(o.stamp, input.capturedAt, input.tz) : null;
  if (live !== null) {
    // StampSticker: a dashed ink ring, inside it a white label with an ink border and the value.
    const ring = Math.max(u, STAMP.ring * h);
    const stroke = keep(new ck.Paint());
    stroke.setAntiAlias(true);
    stroke.setStyle(ck.PaintStyle.Stroke);
    stroke.setColor(color(ck, INK));
    stroke.setStrokeWidth(ring);
    stroke.setPathEffect(keep(ck.PathEffect.MakeDash([ring * 3, ring * 2])));
    const outer = (STAMP.radius + STAMP.inset) * h;
    canvas.drawRRect(rrect(ring / 2, ring / 2, w - ring / 2, h - ring / 2, [outer, outer, outer, outer]), stroke);
    const m = STAMP.inset * h;
    const border = Math.max(u, STAMP.border * h);
    const r = STAMP.radius * h;
    const fill = keep(new ck.Paint());
    fill.setAntiAlias(true);
    fill.setColor(color(ck, SURFACE));
    canvas.drawRRect(rrect(m, m, w - m, h - m, [r, r, r, r]), fill);
    const line = keep(new ck.Paint());
    line.setAntiAlias(true);
    line.setStyle(ck.PaintStyle.Stroke);
    line.setColor(color(ck, INK));
    line.setStrokeWidth(border);
    canvas.drawRRect(
      rrect(m + border / 2, m + border / 2, w - m - border / 2, h - m - border / 2, [r, r, r, r]),
      line,
    );
    const inner = w - 2 * m - 2 * border - 2 * STAMP.padding * h;
    let size = STAMP.text * h;
    let p = paragraph(k, keep, live, {
      family: 'jakarta-800',
      size,
      lineHeight: size * 1.2,
      color: INK,
      align: 'center',
      width: 1e5,
    });
    if (p.getMaxIntrinsicWidth() > inner) {
      size *= inner / p.getMaxIntrinsicWidth(); // adjustsFontSizeToFit on one line
      p = paragraph(k, keep, live, {
        family: 'jakarta-800',
        size,
        lineHeight: size * 1.2,
        color: INK,
        align: 'center',
        width: 1e5,
      });
    }
    canvas.drawParagraph(p, w / 2 - 5e4, h / 2 - p.getHeight() / 2);
    return;
  }
  if (!sticker) return; // like the app: art it doesn't have takes its place without drawing
  const paint = keep(new ck.Paint());
  paint.setAntiAlias(true);
  canvas.drawImageRectOptions(
    sticker,
    ck.XYWHRect(0, 0, sticker.width(), sticker.height()),
    ck.XYWHRect(0, 0, w, h),
    ck.FilterMode.Linear,
    ck.MipmapMode.Linear,
    paint,
  );
}

function drawBubble(
  k: Kit,
  canvas: Canvas,
  keep: Keep,
  o: Extract<Overlay, { type: 'bubble' }>,
  w: number,
  h: number,
  u: number,
) {
  const { ck } = k;
  const s = w / BUBBLE.referenceWidth;
  const pair = BUBBLE_COLORS[o.color];
  if (o.shape === 'shout') {
    // skewX about the bubble's centre, text included, as the app's transform does.
    canvas.translate(w / 2, h / 2);
    canvas.skew(Math.tan((BUBBLE.shoutSkewDeg * Math.PI) / 180), 0);
    canvas.translate(-w / 2, -h / 2);
  }
  const radii: [number, number, number, number] = o.shape === 'speech'
    ? [BUBBLE.radius * s, BUBBLE.radius * s, BUBBLE.radius * s, BUBBLE.tailRadius * s]
    : o.shape === 'thought'
    ? [h / 2, h / 2, h / 2, h / 2]
    : o.shape === 'shout'
    ? [BUBBLE.shoutRadius * s, BUBBLE.shoutRadius * s, BUBBLE.shoutRadius * s, BUBBLE.shoutRadius * s]
    : [BUBBLE.whisperRadius * s, BUBBLE.whisperRadius * s, BUBBLE.whisperRadius * s, BUBBLE.whisperRadius * s];
  const body = rrect(0, 0, w, h, radii);

  // The shadow is in fixed points in the app, so it scales with the photo, not the bubble.
  const sh = BUBBLE.shadow;
  const shadow = keep(new ck.Paint());
  shadow.setAntiAlias(true);
  shadow.setColor(color(ck, sh.color, sh.opacity));
  shadow.setMaskFilter(keep(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, (sh.radius * u) / 2, false)));
  canvas.save();
  canvas.translate(0, sh.offsetY * u);
  canvas.drawRRect(body, shadow);
  canvas.restore();

  const fill = keep(new ck.Paint());
  fill.setAntiAlias(true);
  fill.setColor(color(ck, pair.fill));
  canvas.drawRRect(body, fill);
  if (o.shape === 'whisper') {
    const bw = BUBBLE.whisperBorder * s;
    const line = keep(new ck.Paint());
    line.setAntiAlias(true);
    line.setStyle(ck.PaintStyle.Stroke);
    line.setColor(color(ck, pair.text));
    line.setStrokeWidth(bw);
    line.setPathEffect(keep(ck.PathEffect.MakeDash([bw * 3, bw * 2])));
    const r = BUBBLE.whisperRadius * s - bw / 2;
    canvas.drawRRect(rrect(bw / 2, bw / 2, w - bw / 2, h - bw / 2, [r, r, r, r]), line);
  }
  if (o.text === '') return;

  const inner = w - 2 * bubblePaddingX(o.shape) * s;
  const maxLines = bubbleLines(o.text, o.shape);
  const family = o.shape === 'shout' ? 'jakarta-800' : 'jakarta-700';
  // adjustsFontSizeToFit (minimumFontScale 0.5): shrink until the text fits its lines.
  let p: Paragraph | null = null;
  for (let f = 1; f >= 0.5 - 1e-9; f -= 0.05) {
    p = paragraph(k, keep, o.text, {
      family,
      size: BUBBLE.fontSize * s * f,
      lineHeight: BUBBLE.lineHeight * s * f,
      color: pair.text,
      align: 'center',
      maxLines,
      width: inner,
    });
    if (!p.didExceedMaxLines()) break;
  }
  if (p) canvas.drawParagraph(p, (w - inner) / 2, (h - p.getHeight()) / 2);
}

function drawText(k: Kit, canvas: Canvas, keep: Keep, o: Extract<Overlay, { type: 'text' }>, w: number) {
  const layout = layoutText(o);
  const s = w / layout.width;
  const size = layout.fontSize * s;
  const shadow = size / 30;
  // Lines are broken by the layout, never by the text engine: lay out wide, then place.
  const wide = 1e5;
  const p = paragraph(k, keep, layout.lines.join('\n'), {
    family: TEXT_FONT[o.font],
    size,
    lineHeight: layout.lineHeight * s,
    color: TEXT_COLORS[o.color],
    align: o.align,
    letterSpacing: (TEXT_TRACKING[o.font] ?? 0) * size,
    shadow: {
      color: o.color === 'ink' ? TEXT_SHADOW.onDark : TEXT_SHADOW.light,
      offsetY: TEXT_SHADOW_AT_30.offset * shadow,
      sigma: (TEXT_SHADOW_AT_30.radius * shadow) / 2,
    },
    width: wide,
  });
  const x = o.align === 'left' ? layout.padX * s : w / 2 - wide / 2;
  canvas.drawParagraph(p, x, layout.padY * s);
}
