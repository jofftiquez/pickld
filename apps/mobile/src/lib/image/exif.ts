// Image metadata reader (FR-PRV-01, FR-CAP-02). Pure: bytes in, fields out. Reads the capture time
// (EXIF DateTimeOriginal + OffsetTimeOriginal) from gallery photos and finds location metadata so
// the pipeline can refuse to hand over a file that still carries it (AGENTS rule 5).
// Containers: JPEG (APP1 Exif/XMP, APP13 IPTC), WebP (EXIF/XMP chunks) and PNG (eXIf/iTXt chunks).

export type ImageFormat = 'jpeg' | 'webp' | 'png';

/** Tag names match the EXIF spec and the `exif` object from image pickers, so either can feed
 * `captureInfo`. `locationTags` lists every location field found (empty when clean). */
export type ImageMetadata = {
  format: ImageFormat;
  DateTimeOriginal?: string;
  OffsetTimeOriginal?: string;
  locationTags: string[];
};

export class LocationMetadataError extends Error {
  constructor(readonly tags: readonly string[]) {
    super(`Image still carries location metadata: ${tags.join(', ')}`);
    this.name = 'LocationMetadataError';
  }
}

const GPS_TAG_NAMES = [
  'GPSVersionID',
  'GPSLatitudeRef',
  'GPSLatitude',
  'GPSLongitudeRef',
  'GPSLongitude',
  'GPSAltitudeRef',
  'GPSAltitude',
  'GPSTimeStamp',
  'GPSSatellites',
  'GPSStatus',
  'GPSMeasureMode',
  'GPSDOP',
  'GPSSpeedRef',
  'GPSSpeed',
  'GPSTrackRef',
  'GPSTrack',
  'GPSImgDirectionRef',
  'GPSImgDirection',
  'GPSMapDatum',
  'GPSDestLatitudeRef',
  'GPSDestLatitude',
  'GPSDestLongitudeRef',
  'GPSDestLongitude',
  'GPSDestBearingRef',
  'GPSDestBearing',
  'GPSDestDistanceRef',
  'GPSDestDistance',
  'GPSProcessingMethod',
  'GPSAreaInformation',
  'GPSDateStamp',
  'GPSDifferential',
  'GPSHPositioningError',
];

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TYPE_ASCII = 2;

// XMP location properties (exif:GPS*, IPTC Extension locations, Photoshop city/state/country).
const XMP_LOCATION = /\b(exif:GPS\w+|Iptc4xmpExt:Location(?:Shown|Created)|photoshop:(?:City|State|Country))\b/g;

const latin1 = (bytes: Uint8Array, start: number, end: number) => {
  let s = '';
  for (let i = start; i < end && i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return s;
};

function startsWith(bytes: Uint8Array, at: number, text: string): boolean {
  return latin1(bytes, at, at + text.length) === text;
}

class Reader {
  private readonly view: DataView;
  constructor(
    readonly bytes: Uint8Array,
    private readonly little = false,
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  private check(at: number, size: number) {
    if (at < 0 || at + size > this.bytes.length) throw new RangeError('Metadata points outside the file');
  }
  u16(at: number): number {
    this.check(at, 2);
    return this.view.getUint16(at, this.little);
  }
  u32(at: number): number {
    this.check(at, 4);
    return this.view.getUint32(at, this.little);
  }
}

type Fields = { DateTimeOriginal?: string; OffsetTimeOriginal?: string; locationTags: string[] };

/** Parses a TIFF block (the payload of an Exif segment or chunk). Throws on malformed offsets. */
function readTiff(tiff: Uint8Array, out: Fields): void {
  const order = latin1(tiff, 0, 2);
  if (order !== 'II' && order !== 'MM') throw new RangeError('Not a TIFF block');
  const r = new Reader(tiff, order === 'II');
  if (r.u16(2) !== 42) throw new RangeError('Not a TIFF block');

  const entries = (ifd: number) => {
    const count = r.u16(ifd);
    const list: { tag: number; type: number; count: number; valueAt: number }[] = [];
    for (let i = 0; i < count; i++) {
      const at = ifd + 2 + i * 12;
      const type = r.u16(at + 2);
      const n = r.u32(at + 4);
      const size = type === TYPE_ASCII ? n : 4;
      list.push({ tag: r.u16(at), type, count: n, valueAt: size > 4 ? r.u32(at + 8) : at + 8 });
    }
    return list;
  };
  const ascii = (e: { type: number; count: number; valueAt: number }) => {
    if (e.type !== TYPE_ASCII) return undefined;
    if (e.valueAt + e.count > tiff.length) throw new RangeError('Metadata points outside the file');
    return latin1(tiff, e.valueAt, e.valueAt + e.count)
      .replace(/\u0000+$/, '')
      .trim();
  };

  const ifd0 = entries(r.u32(4));
  for (const e of ifd0) {
    if (e.tag === TAG_GPS_IFD) {
      const gps = entries(r.u32(e.valueAt));
      out.locationTags.push(
        ...(gps.length > 0 ? gps.map((g) => GPS_TAG_NAMES[g.tag] ?? `GPSTag0x${g.tag.toString(16)}`) : ['GPSInfo']),
      );
    }
    if (e.tag === TAG_EXIF_IFD) {
      for (const x of entries(r.u32(e.valueAt))) {
        if (x.tag === TAG_DATE_TIME_ORIGINAL) out.DateTimeOriginal = ascii(x);
        if (x.tag === TAG_OFFSET_TIME_ORIGINAL) out.OffsetTimeOriginal = ascii(x);
      }
    }
  }
}

function readXmp(text: string, out: Fields): void {
  for (const match of text.matchAll(XMP_LOCATION)) out.locationTags.push(`XMP ${match[1]}`);
}

function readJpeg(bytes: Uint8Array, out: Fields): void {
  const r = new Reader(bytes);
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) throw new RangeError('Malformed JPEG segment');
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return; // end of image or start of scan: no more metadata
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = r.u16(at + 2);
    const start = at + 4;
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) throw new RangeError('Malformed JPEG segment');
    if (marker === 0xe1 && startsWith(bytes, start, 'Exif\0\0')) readTiff(bytes.subarray(start + 6, end), out);
    else if (marker === 0xe1 && startsWith(bytes, start, 'http://ns.adobe.com/'))
      readXmp(latin1(bytes, start, end), out);
    else if (marker === 0xed) out.locationTags.push('IPTC'); // Photoshop IRB may hold City/Sublocation
    at = end;
  }
}

function readWebp(bytes: Uint8Array, out: Fields): void {
  const r = new Reader(bytes, true);
  let at = 12;
  while (at + 8 <= bytes.length) {
    const fourcc = latin1(bytes, at, at + 4);
    const size = r.u32(at + 4);
    const start = at + 8;
    const end = start + size;
    if (end > bytes.length) throw new RangeError('Malformed WebP chunk');
    if (fourcc === 'EXIF') {
      const offset = startsWith(bytes, start, 'Exif\0\0') ? 6 : 0;
      readTiff(bytes.subarray(start + offset, end), out);
    } else if (fourcc === 'XMP ') {
      readXmp(latin1(bytes, start, end), out);
    }
    at = end + (size % 2);
  }
}

function readPng(bytes: Uint8Array, out: Fields): void {
  const r = new Reader(bytes);
  let at = 8;
  while (at + 12 <= bytes.length) {
    const size = r.u32(at);
    const type = latin1(bytes, at + 4, at + 8);
    const start = at + 8;
    const end = start + size;
    if (end + 4 > bytes.length) throw new RangeError('Malformed PNG chunk');
    if (type === 'eXIf') readTiff(bytes.subarray(start, end), out);
    else if ((type === 'iTXt' || type === 'tEXt') && startsWith(bytes, start, 'XML:com.adobe.xmp')) {
      readXmp(latin1(bytes, start, end), out);
    }
    if (type === 'IEND') return;
    at = end + 4; // skip CRC
  }
}

export function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'webp';
  if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  return null;
}

/** Reads capture time and location metadata. Throws on unknown formats or malformed metadata. */
export function readImageMetadata(bytes: Uint8Array): ImageMetadata {
  const format = detectFormat(bytes);
  if (!format) throw new TypeError('Unsupported image format');
  const out: Fields = { locationTags: [] };
  if (format === 'jpeg') readJpeg(bytes, out);
  else if (format === 'webp') readWebp(bytes, out);
  else readPng(bytes, out);
  return { format, ...out };
}

/** Fails closed: throws `LocationMetadataError` when the file carries location metadata, and also
 * when it cannot be read (unknown format or malformed metadata), since then it can't be proven clean. */
export function assertNoLocationMetadata(bytes: Uint8Array): void {
  let tags: string[];
  try {
    tags = readImageMetadata(bytes).locationTags;
  } catch (error) {
    throw new LocationMetadataError([`unreadable (${error instanceof Error ? error.message : String(error)})`]);
  }
  if (tags.length > 0) throw new LocationMetadataError(tags);
}
