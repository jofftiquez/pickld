// _shared/moment_render.ts (T-508): finished photos for the data export. Pixels are read back from the
// JPEG, so expectations allow JPEG's small error. Expected colors are worked out here by hand, not taken
// from the module's tables.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { finishedRenderer, hasVisibleEdits, readEdits, skia } from '../_shared/moment_render.ts';

/** A solid PNG of w×h in one color. */
async function solid(w: number, h: number, rgb: [number, number, number]): Promise<Uint8Array> {
  const { ck } = await skia();
  const s = ck.MakeSurface(w, h)!;
  s.getCanvas().clear(ck.Color(rgb[0], rgb[1], rgb[2], 1));
  const img = s.makeImageSnapshot();
  const out = img.encodeToBytes(ck.ImageFormat.PNG, 100)!;
  img.delete();
  s.delete();
  return out;
}

/** Decodes an image and reads the pixel at (x, y) as [r, g, b]. */
async function pixelAt(bytes: Uint8Array, x: number, y: number) {
  const { ck } = await skia();
  const img = ck.MakeImageFromEncoded(bytes)!;
  const info = { width: 1, height: 1, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul };
  const px = img.readPixels(x, y, { ...info, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array;
  const size = [img.width(), img.height()];
  img.delete();
  return { rgb: [px[0], px[1], px[2]], size };
}

const near = (got: number[], want: number[], tol = 6) =>
  assert(got.every((v, i) => Math.abs(v - want[i]) <= tol), `got ${got}, want ${want}`);

const at = { capturedAt: new Date('2026-11-12T07:14:00Z'), tz: 'Asia/Manila' };

Deno.test('readEdits: lenient like the app; hasVisibleEdits', () => {
  assertEquals(readEdits(null), { filter: 'original', overlays: [] });
  assertEquals(readEdits({ filter: 'sepia', overlays: 'x' }), { filter: 'original', overlays: [] });
  const e = readEdits({
    v: 1,
    filter: 'dusk',
    overlays: [
      { id: 'a', type: 'text', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, text: 'hi' },
      { id: 'a', type: 'text', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, text: 'duplicate id' },
      { id: 'b', type: 'text', x: 2, y: 0.5, scale: 0.5, rotation: 0, text: 'off the photo' },
      { id: 'c', type: 'text', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, text: '   ' },
      { id: 'd', type: 'sticker', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, asset: '../secret.png' },
      { id: 'e', type: 'bubble', x: 0.5, y: 0.5, scale: 0.5, rotation: 0 },
    ],
  });
  assertEquals(e.filter, 'dusk');
  assertEquals(e.overlays.map((o) => o.id), ['a', 'e']);
  assertEquals(e.overlays[0], {
    id: 'a',
    type: 'text',
    x: 0.5,
    y: 0.5,
    scale: 0.5,
    rotation: 0,
    text: 'hi',
    font: 'bold',
    color: 'white',
    size: 30,
    align: 'center',
  });
  assertEquals(hasVisibleEdits(null), false);
  assertEquals(hasVisibleEdits({ filter: 'original', overlays: [] }), false);
  assertEquals(hasVisibleEdits({ filter: 'mono', overlays: [] }), true);
  // The six filters added in QA item 23 are known, not read as Original.
  for (const filter of ['kape', 'ube', 'sampaguita', 'gabi', 'luma', 'ulan']) {
    assertEquals(readEdits({ filter, overlays: [] }).filter, filter);
  }
  assertEquals(hasVisibleEdits({ filter: 'original', overlays: [{ id: 'x', type: 'nope' }] }), false);
});

Deno.test('the filter is the Skia color matrix: mono on an asymmetric color', async () => {
  // Rec. 709 luma of (200, 40, 120): 0.2126·200 + 0.7152·40 + 0.0722·120 = 79.8. A wrong channel order
  // (BGR) would give 0.2126·120 + 0.7152·40 + 0.0722·200 = 68.4.
  const r = finishedRenderer(() => Promise.resolve(null));
  const out = await r.render({ photo: await solid(300, 400, [200, 40, 120]), edits: { filter: 'mono' }, ...at });
  r.close();
  const { rgb, size } = await pixelAt(out, 150, 200);
  assertEquals(size, [300, 400]);
  near(rgb, [80, 80, 80], 3);
  // And without edits the color comes through as is.
  const plain = finishedRenderer(() => Promise.resolve(null));
  near(
    (await pixelAt(await plain.render({ photo: await solid(300, 400, [200, 40, 120]), edits: null, ...at }), 150, 200))
      .rgb,
    [200, 40, 120],
  );
  plain.close();
});

Deno.test('a photo of another shape is cropped to 3:4 at its width', async () => {
  const r = finishedRenderer(() => Promise.resolve(null));
  const out = await r.render({ photo: await solid(300, 300, [10, 200, 10]), edits: null, ...at });
  r.close();
  const { rgb, size } = await pixelAt(out, 150, 390);
  assertEquals(size, [300, 400]);
  near(rgb, [10, 200, 10]);
});

Deno.test('a sticker draws its art from the asset key, centred, scaled to the photo width and rotated', async () => {
  // A 100×20 red bar, 0.5 of a 400-wide photo (200×40), centred at (0.25, 0.5) of 400×533, turned 90°:
  // it stands 40 wide and 200 tall around (100, 267).
  const asked: string[] = [];
  const bar = await solid(100, 20, [230, 20, 20]);
  const r = finishedRenderer((key) => {
    asked.push(key);
    return Promise.resolve(key === 'stickers/old-pack/retired.png' ? bar : null);
  });
  const sticker = (id: string, asset: string, x: number) => ({
    id,
    type: 'sticker',
    x,
    y: 0.5,
    scale: 0.5,
    rotation: Math.PI / 2,
    asset,
  });
  const edits = {
    filter: 'original',
    overlays: [
      sticker('a', 'stickers/old-pack/retired.png', 0.25),
      sticker('b', 'stickers/old-pack/retired.png', 0.75),
    ],
  };
  const photo = await solid(400, 533, [255, 255, 255]);
  const out = await r.render({ photo, edits, ...at });
  // Fetched once for both overlays and again not at all for a second moment.
  await r.render({ photo, edits, ...at });
  r.close();
  assertEquals(asked, ['stickers/old-pack/retired.png']);
  const red = [230, 20, 20];
  const white = [255, 255, 255];
  near((await pixelAt(out, 100, 267)).rgb, red);
  near((await pixelAt(out, 100, 267 - 90)).rgb, red, 10); // inside the turned bar
  near((await pixelAt(out, 100 + 60, 267)).rgb, white, 10); // where an unturned bar would be
  near((await pixelAt(out, 300, 267 + 90)).rgb, red, 10); // the second one
});

Deno.test('text and bubbles draw (they change the pixels where they sit, not elsewhere)', async () => {
  const r = finishedRenderer(() => Promise.resolve(null));
  const photo = await solid(390, 520, [40, 90, 160]);
  const out = await r.render({
    photo,
    edits: {
      filter: 'original',
      overlays: [
        {
          id: 'b',
          type: 'bubble',
          x: 0.5,
          y: 0.25,
          scale: 0.6,
          rotation: 0,
          shape: 'speech',
          color: 'white',
          text: 'hi',
        },
        { id: 't', type: 'text', x: 0.5, y: 0.75, scale: 0.8, rotation: 0, text: 'MMMMMM', font: 'bold', size: 64 },
        {
          id: 's',
          type: 'sticker',
          x: 0.5,
          y: 0.5,
          scale: 0.4,
          rotation: 0,
          asset: 'stickers/stamps/time.png',
          stamp: 'time',
        },
      ],
    },
    ...at,
  });
  r.close();
  const { ck } = await skia();
  const img = ck.MakeImageFromEncoded(out)!;
  const all = img.readPixels(0, 0, {
    width: 390,
    height: 520,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  img.delete();
  const changed = (y0: number, y1: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < 390; x++) {
        const i = (y * 390 + x) * 4;
        if (Math.abs(all[i] - 40) + Math.abs(all[i + 1] - 90) + Math.abs(all[i + 2] - 160) > 60) n++;
      }
    }
    return n;
  };
  assert(changed(100, 160) > 2000, 'the bubble');
  assert(changed(370, 410) > 1000, 'the text');
  assert(changed(240, 280) > 300, 'the drawn time stamp');
  assertEquals(changed(0, 40), 0, 'the top edge is untouched');
});

// A white bubble 0.6 of a 390 × 520 photo wide (234 px, 1.17 px per bubble unit) with no text: one line,
// 42 units (49.14 px) tall, centred at (195, 156), so its box runs x 78..312, y 131.43..180.57.
async function bubbleRender(patch: Record<string, unknown>) {
  const r = finishedRenderer(() => Promise.resolve(null));
  const photo = await solid(390, 520, [40, 90, 160]);
  const out = await r.render({
    photo,
    edits: {
      filter: 'original',
      overlays: [
        {
          id: 'b',
          type: 'bubble',
          x: 0.5,
          y: 0.3,
          scale: 0.6,
          rotation: 0,
          shape: 'speech',
          color: 'white',
          text: '',
          ...patch,
        },
      ],
    },
    ...at,
  });
  r.close();
  return out;
}
const white = [255, 255, 255];
const isWhite = async (out: Uint8Array, x: number, y: number) => {
  const { rgb } = await pixelAt(out, x, y);
  return rgb.every((v, i) => Math.abs(v - white[i]) <= 12);
};

// The point's corners in bubble units are (16, 40), (6, 58), (40, 40); its centroid (20.67, 46) is
// 24.18 px in and 53.82 px down the box: (102, 185) on the photo, 4 px below the body. Mirrored: (288, 185).
Deno.test('a speech bubble’s point hangs on its saved side; one saved without a side hangs on the left', async () => {
  for (const [patch, left] of [[{}, true], [{ tail: 'left' }, true], [{ tail: 'right' }, false]] as const) {
    const out = await bubbleRender(patch);
    assertEquals(await isWhite(out, 102, 185), left, `${JSON.stringify(patch)}: tail on the left`);
    assertEquals(await isWhite(out, 288, 185), !left, `${JSON.stringify(patch)}: tail on the right`);
    assert(await isWhite(out, 195, 156), 'the body');
    assertEquals(await isWhite(out, 195, 190), false, 'nothing under the middle');
  }
});

// A thought's large dot is centred 40 units in and 50 down (2 below its flat bottom, radius 6):
// (78 + 46.8, 131.43 + 58.5) ≈ (125, 190); mirrored (265, 190).
Deno.test('a thought’s dots trail on its saved side', async () => {
  const left = await bubbleRender({ shape: 'thought' });
  assert(await isWhite(left, 125, 190));
  assertEquals(await isWhite(left, 265, 190), false);
  const right = await bubbleRender({ shape: 'thought', tail: 'right' });
  assert(await isWhite(right, 265, 190));
  assertEquals(await isWhite(right, 125, 190), false);
});

// A cloud thought's top edge dips between its corner puff (centre 18, 18; radius 18) and the next one
// (centre 45.3, 14; radius 14): at 31 units in and 3 down, (114, 135) on the photo, the cloud shows the
// photo where an old pill thought, flat along its top, is white. Its dots still trail on its side.
Deno.test('a cloud thought dips between its puffs; a thought saved without `cloud` stays a pill', async () => {
  const cloud = await bubbleRender({ shape: 'thought', cloud: true });
  assertEquals(await isWhite(cloud, 114, 135), false, 'the cloud dips between puffs');
  assert(await isWhite(cloud, 195, 156), 'the body');
  assert(await isWhite(cloud, 125, 188), 'the large dot on the left');
  assertEquals(await isWhite(cloud, 265, 188), false);
  const pill = await bubbleRender({ shape: 'thought' });
  assert(await isWhite(pill, 114, 135), 'the pill is flat along the top');
});

Deno.test('readEdits keeps a bubble’s tail side and drops one with an unknown side', () => {
  const b = { type: 'bubble', x: 0.5, y: 0.5, scale: 0.5, rotation: 0 };
  const e = readEdits({
    filter: 'original',
    overlays: [{ ...b, id: 'r', tail: 'right' }, { ...b, id: 'old' }, { ...b, id: 'bad', tail: 'up' }],
  });
  assertEquals(e.overlays.map((o) => [o.id, 'tail' in o ? o.tail : 'none']), [['r', 'right'], ['old', 'none']]);
});

// A text overlay 0.6 of a 390 × 520 photo wide (234 px), centred at (195, 260). "hi" in Bold at 30 on a
// background is 2 × 0.64 em of letters with 0.4 em either side: a 62.4 × 52.5 point box, drawn 3.75 times
// that, so the box runs x 78..312, y 161.56..358.44 and its left padding is x 78..123.
async function textRender(patch: Record<string, unknown>) {
  const r = finishedRenderer(() => Promise.resolve(null));
  const photo = await solid(390, 520, [40, 90, 160]);
  const out = await r.render({
    photo,
    edits: {
      filter: 'original',
      overlays: [
        {
          id: 't',
          type: 'text',
          x: 0.5,
          y: 0.5,
          scale: 0.6,
          rotation: 0,
          text: 'hi',
          font: 'bold',
          size: 30,
          ...patch,
        },
      ],
    },
    ...at,
  });
  r.close();
  return out;
}

Deno.test('a solid text background fills its box with the color; a soft one is a wash of black or white', async () => {
  const solidBg = await textRender({ color: 'yellow', background: 'solid' });
  near((await pixelAt(solidBg, 90, 260)).rgb, [0xfd, 0xcb, 0x5c]);
  near((await pixelAt(solidBg, 60, 260)).rgb, [40, 90, 160]); // outside the box
  // Yellow is light, so its wash is ink #11140d at 0.6 over the photo.
  const soft = await textRender({ color: 'yellow', background: 'soft' });
  near((await pixelAt(soft, 90, 260)).rgb, [26, 48, 72]);
});

Deno.test('an outline draws the words in its color round them', async () => {
  const red = (out: Uint8Array) => countNear(out, [0xed, 0x49, 0x56]);
  assertEquals(await red(await textRender({ color: 'white' })), 0);
  assert((await red(await textRender({ color: 'white', outline: 'red' }))) > 300, 'the red outline');
});

Deno.test('the Script, Strong, Marker and Hand fonts are bundled and draw', async () => {
  for (const font of ['script', 'strong', 'marker', 'hand']) {
    const white = await countNear(await textRender({ font, color: 'white', text: 'MMMM' }), [255, 255, 255], 30);
    assert(white > 300, `${font} draws`);
  }
});

Deno.test('readEdits keeps a text’s background, outline and new fonts and drops unknown ones', () => {
  const t = { type: 'text', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, text: 'hi' };
  const e = readEdits({
    filter: 'original',
    overlays: [
      { ...t, id: 'ok', font: 'marker', color: 'teal', background: 'soft', outline: 'ink' },
      { ...t, id: 'old', color: 'butter' },
      { ...t, id: 'bad', background: 'glow' },
    ],
  });
  assertEquals(e.overlays.map((o) => o.id), ['ok', 'old']);
  const ok = e.overlays[0] as Record<string, unknown>;
  assertEquals([ok.font, ok.color, ok.background, ok.outline], ['marker', 'teal', 'soft', 'ink']);
});

/** How many pixels of a 390 × 520 render are within tol of rgb. */
async function countNear(bytes: Uint8Array, rgb: number[], tol = 40) {
  const { ck } = await skia();
  const img = ck.MakeImageFromEncoded(bytes)!;
  const all = img.readPixels(0, 0, {
    width: 390,
    height: 520,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  img.delete();
  let n = 0;
  for (let i = 0; i < all.length; i += 4) {
    if (Math.abs(all[i] - rgb[0]) + Math.abs(all[i + 1] - rgb[1]) + Math.abs(all[i + 2] - rgb[2]) <= tol) n++;
  }
  return n;
}

Deno.test('a place sticker draws its pill where it sits; readEdits keeps only its words and color', async () => {
  const o = {
    id: 'p',
    type: 'place',
    x: 0.5,
    y: 0.5,
    scale: 0.5,
    rotation: 0,
    text: 'Baguio',
    color: 'butter',
  } as const;
  assertEquals(readEdits({ filter: 'original', overlays: [{ ...o, latitude: 16.4 }] }).overlays, [o]);
  assertEquals(readEdits({ filter: 'original', overlays: [{ ...o, text: ' ' }] }).overlays, []);

  const r = finishedRenderer(() => Promise.resolve(null));
  const photo = await solid(390, 520, [40, 90, 160]);
  const out = await r.render({ photo, edits: { filter: 'original', overlays: [o] }, ...at });
  // The pill is 195 px wide (half the photo) and 67 px tall, centred: its left end is butter, and the photo
  // just above it and just left of it is untouched.
  near((await pixelAt(out, 97 + 10, 260)).rgb, [0xff, 0xe0, 0x8a], 12);
  near((await pixelAt(out, 195, 215)).rgb, [40, 90, 160], 12);
  near((await pixelAt(out, 90, 260)).rgb, [40, 90, 160], 12);
});
