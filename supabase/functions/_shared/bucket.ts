// Requests a function sends to the photo bucket itself (S3 API: R2, or local Supabase Storage), signed
// with short-lived presigned URLs. Pass s3ServerConfigFromEnv() (env.ts). Error messages carry only the
// operation and status, never a key (keys contain user ids).
import { objectUrl, presignObject, presignUrl, type S3Config } from './sigv4.ts';

const URL_TTL_SECONDS = 60;
const MAX_PAGES = 50; // 50,000 objects, far more than one person's photos

function xmlText(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Deletes every object under `prefix` and returns how many. The prefix must be one person's folder,
 * like moments/<user id>/ (two or more segments ending in "/"), and never under seed/ (seed users share
 * those keys). Lists one page, deletes it, and lists again from the start until the listing is empty.
 */
export async function deletePrefix(s3: S3Config, prefix: string): Promise<number> {
  const parts = prefix.slice(0, -1).split('/');
  if (!prefix.endsWith('/') || parts.length < 2 || parts.some((p) => !p) || parts[0] === 'seed') {
    throw new Error('delete objects: bad prefix');
  }
  let deleted = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const keys = await listKeys(s3, prefix);
    if (keys.length === 0) return deleted;
    for (const key of keys) {
      const del = await fetch(await presignObject(s3, key, { method: 'DELETE', expiresIn: URL_TTL_SECONDS }), {
        method: 'DELETE',
      });
      await del.body?.cancel();
      if (!del.ok && del.status !== 404) throw new Error(`delete object: ${del.status}`);
      deleted++;
    }
  }
  throw new Error('delete objects: the listing did not shrink');
}

/** Keys under `prefix`, up to 1,000. */
export async function listKeys(s3: S3Config, prefix: string): Promise<string[]> {
  const url = `${s3.endpoint.replace(/\/+$/, '')}/${s3.bucket}?list-type=2&max-keys=1000&prefix=${
    encodeURIComponent(prefix)
  }`;
  const res = await fetch(await presignUrl(url, s3, { method: 'GET', expiresIn: URL_TTL_SECONDS }));
  const xml = await res.text();
  if (!res.ok) throw new Error(`list objects: ${res.status}`);
  return [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => xmlText(m[1])).filter((k) => k.startsWith(prefix));
}

/** An object's bytes, or null when it doesn't exist. */
export async function getObject(s3: S3Config, key: string): Promise<Uint8Array | null> {
  const res = await fetch(await presignObject(s3, key, { method: 'GET', expiresIn: URL_TTL_SECONDS }));
  if (res.status === 404 || res.status === 400) {
    // Local Supabase Storage answers 400 NoSuchKey for a missing object.
    const body = await res.text();
    if (res.status === 404 || body.includes('NoSuchKey')) return null;
    throw new Error(`get object: ${res.status}`);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`get object: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Default part size: R2 needs every part but the last to be the same size, S3 at least 5 MiB. */
export const PART_SIZE = 8 * 1024 * 1024;

/**
 * A multipart upload fed in chunks of any size; holds at most one part in memory. `complete()` finishes
 * it, `abort()` throws it away (call it when anything fails).
 */
export class MultipartUpload {
  #buffer: Uint8Array;
  #filled = 0;
  #parts: { n: number; etag: string }[] = [];

  private constructor(
    private readonly s3: S3Config,
    private readonly key: string,
    private readonly uploadId: string,
    partSize: number,
  ) {
    this.#buffer = new Uint8Array(partSize);
  }

  static async start(s3: S3Config, key: string, contentType: string, partSize = PART_SIZE): Promise<MultipartUpload> {
    const headers = { 'content-type': contentType };
    const url = await presignUrl(`${objectUrl(s3, key)}?uploads=`, s3, {
      method: 'POST',
      expiresIn: URL_TTL_SECONDS,
      headers,
    });
    const res = await fetch(url, { method: 'POST', headers });
    const xml = await res.text();
    const id = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
    if (!res.ok || !id) throw new Error(`start upload: ${res.status}`);
    return new MultipartUpload(s3, key, xmlText(id), partSize);
  }

  #partUrl(query: string, method: 'PUT' | 'POST' | 'DELETE'): Promise<string> {
    return presignUrl(`${objectUrl(this.s3, this.key)}?${query}`, this.s3, { method, expiresIn: URL_TTL_SECONDS });
  }

  async #flush(): Promise<void> {
    if (this.#filled === 0) return;
    const n = this.#parts.length + 1;
    const body = this.#buffer.slice(0, this.#filled);
    const url = await this.#partUrl(`partNumber=${n}&uploadId=${encodeURIComponent(this.uploadId)}`, 'PUT');
    const res = await fetch(url, { method: 'PUT', body });
    await res.body?.cancel();
    const etag = res.headers.get('etag');
    if (!res.ok || !etag) throw new Error(`upload part: ${res.status}`);
    this.#parts.push({ n, etag });
    this.#filled = 0;
  }

  async write(chunk: Uint8Array): Promise<void> {
    let at = 0;
    while (at < chunk.length) {
      const take = Math.min(chunk.length - at, this.#buffer.length - this.#filled);
      this.#buffer.set(chunk.subarray(at, at + take), this.#filled);
      this.#filled += take;
      at += take;
      if (this.#filled === this.#buffer.length) await this.#flush();
    }
  }

  async complete(): Promise<void> {
    await this.#flush();
    const body = `<CompleteMultipartUpload>${
      this.#parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('')
    }</CompleteMultipartUpload>`;
    const url = await this.#partUrl(`uploadId=${encodeURIComponent(this.uploadId)}`, 'POST');
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/xml' }, body });
    const xml = await res.text();
    // S3 can answer 200 with an <Error> body for a failed completion.
    if (!res.ok || xml.includes('<Error>')) throw new Error(`complete upload: ${res.status}`);
  }

  async abort(): Promise<void> {
    const url = await this.#partUrl(`uploadId=${encodeURIComponent(this.uploadId)}`, 'DELETE');
    const res = await fetch(url, { method: 'DELETE' });
    await res.body?.cancel();
  }
}
