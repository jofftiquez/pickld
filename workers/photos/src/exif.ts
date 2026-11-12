// Finds location metadata in an image file (M5-07, FR-PRV-01, AGENTS rule 5). Used by scripts/exif-check.ts
// to audit uploaded files. Reads the EXIF block of JPEG (APP1), WebP (EXIF chunk) and PNG (eXIf chunk) and
// reports a GPS IFD pointer (tag 0x8825) in IFD0; also reports XMP that mentions GPS coordinates.

export type LocationFinding = 'exif-gps' | 'xmp-gps';

const GPS_IFD_TAG = 0x8825;
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/** True when a TIFF-structured EXIF payload (starting at "II*\0" or "MM\0*") has a GPS IFD in IFD0. */
export function tiffHasGps(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false;
  const order = ascii(tiff, 0, 2);
  if (order !== 'II' && order !== 'MM') return false;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const le = order === 'II';
  const ifd0 = view.getUint32(4, le);
  if (ifd0 + 2 > tiff.length) return false;
  const count = view.getUint16(ifd0, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > tiff.length) return false;
    if (view.getUint16(entry, le) === GPS_IFD_TAG) return true;
  }
  return false;
}

/** EXIF payloads (TIFF data) and XMP packets found in the file. */
function metadataBlocks(b: Uint8Array): { exif: Uint8Array[]; xmp: string[] } {
  const exif: Uint8Array[] = [];
  const xmp: string[] = [];
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the segments up to the image data.
    let at = 2;
    while (at + 4 <= b.length && b[at] === 0xff) {
      const marker = b[at + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const len = view.getUint16(at + 2);
      const body = b.subarray(at + 4, at + 2 + len);
      if (marker === 0xe1 && ascii(body, 0, 6) === 'Exif\0\0') exif.push(body.subarray(6));
      else if (marker === 0xe1) xmp.push(new TextDecoder().decode(body));
      at += 2 + len;
    }
  } else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    let at = 12;
    while (at + 8 <= b.length) {
      const id = ascii(b, at, 4);
      const len = view.getUint32(at + 4, true);
      const body = b.subarray(at + 8, at + 8 + len);
      if (id === 'EXIF') exif.push(ascii(body, 0, 6) === 'Exif\0\0' ? body.subarray(6) : body);
      if (id === 'XMP ') xmp.push(new TextDecoder().decode(body));
      at += 8 + len + (len % 2);
    }
  } else if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
    let at = 8;
    while (at + 8 <= b.length) {
      const len = view.getUint32(at);
      const id = ascii(b, at + 4, 4);
      const body = b.subarray(at + 8, at + 8 + len);
      if (id === 'eXIf') exif.push(body);
      if (id === 'iTXt' || id === 'tEXt') xmp.push(new TextDecoder().decode(body));
      at += 12 + len;
    }
  }
  return { exif, xmp };
}

/** Location metadata in the file, if any. */
export function locationFindings(bytes: Uint8Array): LocationFinding[] {
  const { exif, xmp } = metadataBlocks(bytes);
  const found: LocationFinding[] = [];
  if (exif.some(tiffHasGps)) found.push('exif-gps');
  if (xmp.some((x) => /GPS(Latitude|Longitude)/.test(x))) found.push('xmp-gps');
  return found;
}
