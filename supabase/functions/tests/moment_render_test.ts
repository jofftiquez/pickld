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
