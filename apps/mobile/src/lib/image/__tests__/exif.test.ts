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

  it('fails closed on unreadable files', () => {
    const truncated = fixture('gps-offset.jpg').subarray(0, 60); // Exif segment cut short
    expect(() => assertNoLocationMetadata(truncated)).toThrow(LocationMetadataError);
    expect(() => assertNoLocationMetadata(new Uint8Array([1, 2, 3]))).toThrow(LocationMetadataError);
  });
});
