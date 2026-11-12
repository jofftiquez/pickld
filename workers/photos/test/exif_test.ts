import { assertEquals } from 'jsr:@std/assert@1';

import { locationFindings } from '../src/exif.ts';

/** A TIFF payload whose IFD0 holds one entry with `tag`, in either byte order. */
function tiff(tag: number, littleEndian: boolean): Uint8Array {
  const b = new Uint8Array(26);
  const v = new DataView(b.buffer);
  b.set(littleEndian ? [0x49, 0x49, 0x2a, 0x00] : [0x4d, 0x4d, 0x00, 0x2a]);
  v.setUint32(4, 8, littleEndian);
  v.setUint16(8, 1, littleEndian); // one entry
  v.setUint16(10, tag, littleEndian);
  v.setUint16(12, 4, littleEndian); // LONG
  v.setUint32(14, 1, littleEndian);
  v.setUint32(18, 26, littleEndian); // value / offset
  v.setUint32(22, 0, littleEndian); // no next IFD
  return b;
}

const bytes = (...parts: (number[] | Uint8Array | string)[]) => {
  const arrays = parts.map((p) => typeof p === 'string' ? new TextEncoder().encode(p) : Uint8Array.from(p));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of arrays) out.set(a, (at += a.length) - a.length);
  return out;
};
const u16be = (n: number) => [n >> 8, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24];

function jpeg(exifTiff: Uint8Array | null, xmp?: string): Uint8Array {
  const segs: (number[] | Uint8Array | string)[] = [[0xff, 0xd8]];
  if (exifTiff) segs.push([0xff, 0xe1, ...u16be(2 + 6 + exifTiff.length)], 'Exif\0\0', exifTiff);
  if (xmp) segs.push([0xff, 0xe1, ...u16be(2 + xmp.length)], xmp);
  segs.push([0xff, 0xda, 0x00, 0x02], [1, 2, 3], [0xff, 0xd9]);
  return bytes(...segs);
}

function webp(exifTiff: Uint8Array | null): Uint8Array {
  const vp8 = bytes('VP8 ', u32le(4), [0, 0, 0, 0]);
  const chunks = exifTiff ? bytes(vp8, 'EXIF', u32le(exifTiff.length), exifTiff) : vp8;
  return bytes('RIFF', u32le(4 + chunks.length), 'WEBP', chunks);
}

const GPS = 0x8825;
const MODEL = 0x0110;

Deno.test('a GPS IFD is found in JPEG and WebP EXIF, in both byte orders', () => {
  assertEquals(locationFindings(jpeg(tiff(GPS, true))), ['exif-gps']);
  assertEquals(locationFindings(jpeg(tiff(GPS, false))), ['exif-gps']);
  assertEquals(locationFindings(webp(tiff(GPS, true))), ['exif-gps']);
});

Deno.test('EXIF without a GPS IFD, and files without EXIF, are clean', () => {
  assertEquals(locationFindings(jpeg(tiff(MODEL, true))), []);
  assertEquals(locationFindings(webp(tiff(MODEL, false))), []);
  assertEquals(locationFindings(jpeg(null)), []);
  assertEquals(locationFindings(webp(null)), []);
});

Deno.test('GPS coordinates in XMP are found', () => {
  const xmp = 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>14,39.0N</exif:GPSLatitude></x:xmpmeta>';
  assertEquals(locationFindings(jpeg(null, xmp)), ['xmp-gps']);
});
