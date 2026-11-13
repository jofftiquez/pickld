import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertNoLocationMetadata, LocationMetadataError, readImageMetadata } from '../exif';

// Fixtures come from scripts/make-image-fixtures.mjs; ImageMagick independently reads the same tags.
const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name)));
const GPS = ['GPSLatitudeRef', 'GPSLatitude', 'GPSLongitudeRef', 'GPSLongitude'];

describe('readImageMetadata', () => {
  it.each([
    ['gps-offset.jpg', 'jpeg', '2026:11:09 23:45:10', '+08:00'],
    ['gps-no-offset.jpg', 'jpeg', '2026:11:10 00:15:00', undefined], // big-endian TIFF
    ['gps-no-date.jpg', 'jpeg', undefined, undefined],
    ['gps.webp', 'webp', '2026:11:09 23:45:10', '+08:00'],
  ])('reads capture time and GPS tags from %s', (name, format, dateTimeOriginal, offset) => {
    expect(readImageMetadata(fixture(name))).toEqual({
      format,
      locationTags: GPS,
      ...(dateTimeOriginal ? { DateTimeOriginal: dateTimeOriginal } : {}),
      ...(offset ? { OffsetTimeOriginal: offset } : {}),
    });
  });

  it.each([
    ['clean.jpg', 'jpeg'],
    ['clean.webp', 'webp'],
  ])('finds nothing in %s', (name, format) => {
    expect(readImageMetadata(fixture(name))).toEqual({ format, locationTags: [] });
  });

  it('finds XMP location properties in a WebP', () => {
    const xmp = new TextEncoder().encode('<x:xmpmeta><rdf:Description exif:GPSLatitude="14,34.95N"/></x:xmpmeta>');
    const clean = fixture('clean.webp');
    const chunk = new Uint8Array(8 + xmp.length + (xmp.length % 2));
    chunk.set(new TextEncoder().encode('XMP '));
    new DataView(chunk.buffer).setUint32(4, xmp.length, true);
    chunk.set(xmp, 8);
    const file = new Uint8Array(clean.length + chunk.length);
    file.set(clean);
    file.set(chunk, clean.length);
    new DataView(file.buffer).setUint32(4, file.length - 8, true);
    expect(readImageMetadata(file).locationTags).toEqual(['XMP exif:GPSLatitude']);
  });

  it('refuses unknown formats', () => {
    expect(() => readImageMetadata(new TextEncoder().encode('GIF89a'))).toThrow(TypeError);
  });
});

describe('assertNoLocationMetadata', () => {
  it.each(['gps-offset.jpg', 'gps-no-offset.jpg', 'gps-no-date.jpg', 'gps.webp'])('refuses %s', (name) => {
    expect(() => assertNoLocationMetadata(fixture(name))).toThrow(LocationMetadataError);
    try {
      assertNoLocationMetadata(fixture(name));
    } catch (error) {
      expect((error as LocationMetadataError).tags).toEqual(GPS);
    }
  });

  it.each(['clean.jpg', 'clean.webp'])('accepts %s', (name) => {
    expect(() => assertNoLocationMetadata(fixture(name))).not.toThrow();
  });

  describe('APP13 (Photoshop / IPTC)', () => {
    const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
    const u16 = (n: number) => [n >> 8, n & 0xff];
    const u32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    const block = (id: number, data: number[], name: number[] = [0, 0]) => [
      ...ascii('8BIM'),
      ...u16(id),
      ...name,
      ...u32(data.length),
      ...data,
      ...(data.length % 2 ? [0] : []),
    ];
    const withApp13 = (payload: number[]) => {
      const clean = fixture('clean.jpg');
      const segment = [0xff, 0xed, ...u16(payload.length + 2), ...payload];
      return new Uint8Array([...clean.subarray(0, 2), ...segment, ...clean.subarray(2)]);
    };
    const photoshop = (...blocks: number[][]) => [...ascii('Photoshop 3.0\0'), ...blocks.flat()];
    // MD5 of nothing: the digest iOS writes for its empty IPTC record.
    const emptyDigest = [
      0xd4, 0x1d, 0x8c, 0xd9, 0x8f, 0x00, 0xb2, 0x04, 0xe9, 0x80, 0x09, 0x98, 0xec, 0xf8, 0x42, 0x7e,
    ];

    it('accepts the empty IPTC record iOS writes on every JPEG', () => {
      const ios = withApp13(photoshop(block(0x0404, []), block(0x0425, emptyDigest)));
      expect(() => assertNoLocationMetadata(ios)).not.toThrow();
    });

    it('refuses an IPTC record with a city', () => {
      const city = [0x1c, 2, 90, ...u16(6), ...ascii('Manila')]; // IPTC-IIM dataset 2:90 City
      const file = withApp13(photoshop(block(0x0425, emptyDigest), block(0x0404, city, [3, ...ascii('abc')])));
      expect(readImageMetadata(file).locationTags).toEqual(['IPTC']);
      expect(() => assertNoLocationMetadata(file)).toThrow(LocationMetadataError);
    });

    it.each([
      ['an unknown APP13 payload', ascii('Adobe_CM')],
      ['a resource block cut short', [...photoshop(block(0x0404, [])), ...ascii('8BIM'), 0x04]],
      [
        'a resource size past the segment',
        [...ascii('Photoshop 3.0\0'), ...ascii('8BIM'), ...u16(0x0404), 0, 0, ...u32(99)],
      ],
    ])('refuses %s', (_, payload) => {
      expect(() => assertNoLocationMetadata(withApp13(payload))).toThrow(LocationMetadataError);
    });
  });

  it('fails closed on unreadable files', () => {
    const truncated = fixture('gps-offset.jpg').subarray(0, 60); // Exif segment cut short
    expect(() => assertNoLocationMetadata(truncated)).toThrow(LocationMetadataError);
    expect(() => assertNoLocationMetadata(new Uint8Array([1, 2, 3]))).toThrow(LocationMetadataError);
  });
});
