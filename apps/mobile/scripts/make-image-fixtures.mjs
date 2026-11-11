#!/usr/bin/env node
// Regenerates the tiny EXIF fixtures for src/lib/image tests (M2-09, FR-PRV-01).
// Needs ImageMagick (`magick`) for the base pixels; the EXIF blocks (GPS + capture time) are written
// here byte by byte so the fixtures don't depend on exiftool. Check them independently with
// `magick identify -format '%[EXIF:*]' <file>`.
// Usage: node scripts/make-image-fixtures.mjs
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = new URL('../src/lib/image/__tests__/__fixtures__/', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'pickld-fixtures-'));

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;

/** A TIFF/EXIF block: IFD0 pointing at an Exif IFD and a GPS IFD; entries are [tag, type, value]. */
function tiff(littleEndian, { exif = [], gps = [] }) {
  const ifd0 = [];
  const layout = [ifd0];
  if (exif.length) layout.push(exif);
  if (gps.length) layout.push(gps);
  // Pointer entries are filled in once offsets are known.
  if (exif.length) ifd0.push([0x8769, LONG, 0]);
  if (gps.length) ifd0.push([0x8825, LONG, 0]);

  const ifdSize = (ifd) => 2 + ifd.length * 12 + 4;
  const valueBytes = ([, type, value]) => {
    if (type === ASCII) return Buffer.from(`${value}\0`, 'latin1');
    if (type === RATIONAL) {
      const b = Buffer.alloc(value.length * 8);
      value.forEach(([n, d], i) => {
        b[littleEndian ? 'writeUInt32LE' : 'writeUInt32BE'](n, i * 8);
        b[littleEndian ? 'writeUInt32LE' : 'writeUInt32BE'](d, i * 8 + 4);
      });
      return b;
    }
    if (type === SHORT) {
      const b = Buffer.alloc(2);
      b[littleEndian ? 'writeUInt16LE' : 'writeUInt16BE'](value);
      return b;
    }
    const b = Buffer.alloc(4);
    b[littleEndian ? 'writeUInt32LE' : 'writeUInt32BE'](value);
    return b;
  };

  // Offsets: header (8), then each IFD followed by its out-of-line values.
  let offset = 8;
  const ifdOffsets = [];
  const extras = [];
  for (const ifd of layout) {
    ifdOffsets.push(offset);
    offset += ifdSize(ifd);
    const extra = [];
    for (const entry of ifd) {
      const bytes = valueBytes(entry);
      if (bytes.length > 4) {
        extra.push({ entry, bytes, at: offset });
        offset += bytes.length + (bytes.length % 2);
      }
    }
    extras.push(extra);
  }
  const ptr = (tag) => ifd0.find((e) => e[0] === tag);
  if (exif.length) ptr(0x8769)[2] = ifdOffsets[1];
  if (gps.length) ptr(0x8825)[2] = ifdOffsets[layout.indexOf(gps)];

  const out = Buffer.alloc(offset);
  const u16 = (v, at) => out[littleEndian ? 'writeUInt16LE' : 'writeUInt16BE'](v, at);
  const u32 = (v, at) => out[littleEndian ? 'writeUInt32LE' : 'writeUInt32BE'](v, at);
  out.write(littleEndian ? 'II' : 'MM', 0, 'latin1');
  u16(42, 2);
  u32(8, 4);
  layout.forEach((ifd, i) => {
    let at = ifdOffsets[i];
    const sorted = [...ifd].sort((a, b) => a[0] - b[0]);
    u16(sorted.length, at);
    at += 2;
    for (const entry of sorted) {
      const [tag, type, value] = entry;
      const bytes = valueBytes(entry);
      const count = type === ASCII ? bytes.length : type === RATIONAL ? value.length : 1;
      u16(tag, at);
      u16(type, at + 2);
      u32(count, at + 4);
      const extra = extras[i].find((x) => x.entry === entry);
      if (extra) {
        u32(extra.at, at + 8);
        extra.bytes.copy(out, extra.at);
      } else {
        bytes.copy(out, at + 8);
      }
      at += 12;
    }
    u32(0, at);
  });
  return out;
}

// Rizal Park, Manila: 14°34'57" N, 120°58'44" E.
const manilaGps = [
  [0x0001, ASCII, 'N'],
  [
    0x0002,
    RATIONAL,
    [
      [14, 1],
      [34, 1],
      [57, 1],
    ],
  ],
  [0x0003, ASCII, 'E'],
  [
    0x0004,
    RATIONAL,
    [
      [120, 1],
      [58, 1],
      [44, 1],
    ],
  ],
];

function magick(args, file) {
  const path = join(tmp, file);
  execFileSync('magick', [...args, path]);
  return readFileSync(path);
}

/** Inserts an APP1 Exif segment right after SOI. */
function jpegWithExif(jpeg, exifTiff) {
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), exifTiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)]);
}

function riffChunk(fourcc, data) {
  const head = Buffer.alloc(8);
  head.write(fourcc, 0, 'latin1');
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

/** Wraps a simple (VP8) WebP in an extended VP8X container with an EXIF chunk. */
function webpWithExif(webp, exifTiff, width, height) {
  const vp8 = webp.subarray(12);
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x08; // EXIF flag
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const body = Buffer.concat([
    Buffer.from('WEBP', 'latin1'),
    riffChunk('VP8X', vp8x),
    vp8,
    riffChunk('EXIF', exifTiff),
  ]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

const base = ['-size', '6x8', 'gradient:white-green', '-strip'];
const jpeg = magick([...base, '-quality', '50'], 'base.jpg');
const webp = magick([...base, '-define', 'webp:lossless=false', '-quality', '50'], 'base.webp');

const fixtures = {
  // Late evening in Manila, with the offset: belongs to 2026-11-09.
  'gps-offset.jpg': jpegWithExif(
    jpeg,
    tiff(true, {
      exif: [
        [0x9003, ASCII, '2026:11:09 23:45:10'],
        [0x9011, ASCII, '+08:00'],
      ],
      gps: manilaGps,
    }),
  ),
  // Just after midnight, no offset recorded (big-endian TIFF, as some cameras write).
  'gps-no-offset.jpg': jpegWithExif(
    jpeg,
    tiff(false, { exif: [[0x9003, ASCII, '2026:11:10 00:15:00']], gps: manilaGps }),
  ),
  // GPS only, no capture time.
  'gps-no-date.jpg': jpegWithExif(jpeg, tiff(true, { gps: manilaGps })),
  // GPS in a WebP container: what a regression in the encoder would produce.
  'gps.webp': webpWithExif(
    webp,
    tiff(true, {
      exif: [
        [0x9003, ASCII, '2026:11:09 23:45:10'],
        [0x9011, ASCII, '+08:00'],
      ],
      gps: manilaGps,
    }),
    6,
    8,
  ),
  // No metadata at all, like the manipulator's re-encoded output.
  'clean.webp': webp,
  'clean.jpg': jpeg,
};

for (const [name, bytes] of Object.entries(fixtures)) writeFileSync(join(outDir, name), bytes);
rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${Object.keys(fixtures).length} fixtures to ${outDir}`);
