// Uploads the placeholder photos in design/images to the local bucket under the keys supabase/seed.sql
// uses (seed/photos, seed/thumbs, seed/avatars), so seeded moments load locally.
//   cd workers/photos && deno task seed
// Then prints a signed URL for one photo and one thumbnail as a smoke test of the local server.
import { presignObject } from '../../../supabase/functions/_shared/sigv4.ts';
import { signPhotoUrl } from '../../../supabase/functions/_shared/photo_token.ts';
import { localS3Config, requireTokenSecret } from '../src/local.ts';

const cfg = await localS3Config();
const images = new URL('../../../design/images/', import.meta.url);

for await (const entry of Deno.readDir(images)) {
  if (!entry.isFile || !entry.name.endsWith('.jpg')) continue;
  const bytes = await Deno.readFile(new URL(entry.name, images));
  const name = entry.name.replace(/\.jpg$/, '');
  const keys = name.startsWith('av_') ? [`seed/avatars/${name}.jpg`] : [`seed/photos/${name}.jpg`, `seed/thumbs/${name}.jpg`];
  for (const key of keys) {
    const headers = { 'content-type': 'image/jpeg' };
    const url = await presignObject(cfg, key, { method: 'PUT', expiresIn: 300, headers });
    const res = await fetch(url, { method: 'PUT', headers, body: bytes });
    if (!res.ok) throw new Error(`upload ${key}: ${res.status} ${await res.text()}`);
    await res.body?.cancel();
    console.log(`uploaded ${key}`);
  }
}

const base = `http://127.0.0.1:${Deno.env.get('PHOTOS_PORT') ?? 55430}`;
const secret = requireTokenSecret();
for (const key of ['seed/photos/morning.jpg', 'seed/thumbs/morning.jpg']) {
  console.log((await signPhotoUrl(base, key, secret, 15 * 60)).url);
}
