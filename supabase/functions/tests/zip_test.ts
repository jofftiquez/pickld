// _shared/zip.ts: CRC-32 check value, and archives Python's zipfile reads back byte for byte.
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { crc32, ZipWriter } from '../_shared/zip.ts';
import { unzip } from './unzip.ts';

/** Builds an archive in memory. */
async function zipOf(files: { path: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const zip = new ZipWriter((c) => (chunks.push(c.slice()), Promise.resolve()));
  for (const f of files) await zip.add(f.path, f.data);
  await zip.finish();
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) (out.set(c, at), at += c.length);
  return out;
}

Deno.test('crc32 matches the standard check value', () => {
  assertEquals(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assertEquals(crc32(new Uint8Array()), 0);
});

Deno.test('an archive round-trips through Python zipfile', async () => {
  const big = crypto.getRandomValues(new Uint8Array(60_000));
  const files = [
    { path: 'profile.json', data: new TextEncoder().encode('{"username":"dalé"}\n') },
    { path: 'photos/2026-11-01/morning.jpg', data: big },
    { path: 'photos/2026-11-01/évening.jpg', data: new Uint8Array() },
  ];
  const got = await unzip(await zipOf(files));
  assertEquals([...got.keys()], files.map((f) => f.path));
  for (const f of files) assertEquals(got.get(f.path), f.data);
});

Deno.test('names are unique and finish is final', async () => {
  const zip = new ZipWriter(() => Promise.resolve());
  await zip.add('a.txt', new Uint8Array([1]));
  await assertRejects(() => zip.add('a.txt', new Uint8Array([2])), Error, 'duplicate');
  await zip.finish();
  await assertRejects(() => zip.add('b.txt', new Uint8Array([2])), Error, 'finished');
});
