// A small ZIP writer for fn:account-jobs' data export (FR-PRV-02): STORE only (photos are already
// compressed), UTF-8 names, CRC-32, no ZIP64 (at most 65,535 entries and 4 GiB, checked). Entries are
// streamed to a sink as they are added, so only one file is held in memory at a time.
// https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT (4.3.7 local header, 4.3.12 central
// directory, 4.3.16 end of central directory).

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3), as ZIP uses it. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time fields (local time is undefined here; UTC is used). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getUTCFullYear(), 1980), 2107);
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

const MAX_U32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;
const UTF8_FLAG = 0x0800;

interface CentralEntry {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

export class ZipWriter {
  #offset = 0;
  #entries: CentralEntry[] = [];
  #names = new Set<string>();
  #finished = false;

  constructor(private readonly sink: (chunk: Uint8Array) => Promise<void>) {}

  async #write(chunk: Uint8Array): Promise<void> {
    if (this.#offset + chunk.length > MAX_U32) throw new Error('zip: archive too large');
    this.#offset += chunk.length;
    await this.sink(chunk);
  }

  /** Adds one stored file. Names use forward slashes and must be unique. */
  async add(path: string, data: Uint8Array, modified = new Date()): Promise<void> {
    if (this.#finished) throw new Error('zip: already finished');
    if (this.#names.has(path)) throw new Error('zip: duplicate name');
    if (this.#entries.length >= MAX_ENTRIES) throw new Error('zip: too many entries');
    this.#names.add(path);
    const name = new TextEncoder().encode(path);
    const crc = crc32(data);
    const { time, date } = dosDateTime(modified);
    const header = new Uint8Array(30 + name.length);
    const v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true); // version needed: 2.0
    v.setUint16(6, UTF8_FLAG, true);
    v.setUint16(8, 0, true); // method: stored
    v.setUint16(10, time, true);
    v.setUint16(12, date, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true); // compressed size
    v.setUint32(22, data.length, true); // uncompressed size
    v.setUint16(26, name.length, true);
    v.setUint16(28, 0, true); // extra length
    header.set(name, 30);
    const offset = this.#offset;
    await this.#write(header);
    await this.#write(data);
    this.#entries.push({ name, crc, size: data.length, offset, time, date });
  }

  /** Writes the central directory and the end record. */
  async finish(): Promise<void> {
    if (this.#finished) throw new Error('zip: already finished');
    this.#finished = true;
    const start = this.#offset;
    for (const e of this.#entries) {
      const rec = new Uint8Array(46 + e.name.length);
      const v = new DataView(rec.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(4, 20, true); // version made by
      v.setUint16(6, 20, true); // version needed
      v.setUint16(8, UTF8_FLAG, true);
      v.setUint16(10, 0, true);
      v.setUint16(12, e.time, true);
      v.setUint16(14, e.date, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.size, true);
      v.setUint32(24, e.size, true);
      v.setUint16(28, e.name.length, true);
      // extra, comment, disk number, internal and external attributes: all 0
      v.setUint32(42, e.offset, true);
      rec.set(e.name, 46);
      await this.#write(rec);
    }
    const size = this.#offset - start;
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, this.#entries.length, true);
    v.setUint16(10, this.#entries.length, true);
    v.setUint32(12, size, true);
    v.setUint32(16, start, true);
    await this.#write(end);
  }
}
