// Uploads the sticker art in assets/stickers to the photo bucket under `stickers/<pack>/<name>.png`, the keys in
// stickers.asset_path (supabase/migrations/0012). The photo Worker serves these keys without a token.
//   cd workers/photos && deno task stickers                 local stack (credentials from `supabase status`)
//   S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… deno task stickers   staging/production R2
// Art never changes under a key (it is cached as immutable), so an object that already exists is skipped:
// changed art gets a new file name and a new catalog row. `deno task seed` runs this too.
import { presignObject, type S3Config } from '../../../supabase/functions/_shared/sigv4.ts';
import { isStickerKey } from '../../../supabase/functions/_shared/object_keys.ts';
import { localS3Config } from '../src/local.ts';

const ASSETS = new URL('../../../assets/', import.meta.url);

async function* pngs(dir: URL, prefix: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory) yield* pngs(new URL(`${entry.name}/`, dir), `${path}/`);
    else if (entry.isFile && entry.name.endsWith('.png')) yield path;
  }
}

export async function uploadStickers(cfg: S3Config): Promise<{ uploaded: number; skipped: number }> {
  let uploaded = 0;
  let skipped = 0;
  const keys: string[] = [];
  for await (const key of pngs(new URL('stickers/', ASSETS), 'stickers/')) keys.push(key);
  for (const key of keys.sort()) {
    if (!isStickerKey(key)) throw new Error(`not a sticker key: ${key} (stickers/<pack>/<name>.png, a-z 0-9 -)`);
    const head = await fetch(await presignObject(cfg, key, { method: 'HEAD', expiresIn: 300 }), { method: 'HEAD' });
    await head.body?.cancel();
    if (head.ok) {
      skipped++;
      continue;
    }
    const headers = { 'content-type': 'image/png' };
    const url = await presignObject(cfg, key, { method: 'PUT', expiresIn: 300, headers });
    const res = await fetch(url, { method: 'PUT', headers, body: await Deno.readFile(new URL(key, ASSETS)) });
    if (!res.ok) throw new Error(`upload ${key}: ${res.status} ${await res.text()}`);
    await res.body?.cancel();
    uploaded++;
  }
  return { uploaded, skipped };
}

if (import.meta.main) {
  const { uploaded, skipped } = await uploadStickers(await localS3Config());
  console.log(`stickers: ${uploaded} uploaded, ${skipped} already there`);
}
