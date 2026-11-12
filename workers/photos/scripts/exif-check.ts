// Audits uploaded photos for location metadata (M5-07, FR-PRV-01). Lists moment photos, thumbnails, avatars
// and covers in the bucket, checks a random sample (default 50 of each prefix) and exits 1 if any file has GPS
// EXIF or GPS XMP.
//   cd workers/photos && deno task exif-check [sample]
// Locally it reads the local stack's bucket (credentials from `supabase status`). For staging, set S3_ENDPOINT,
// S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET to a read-only R2 token in the shell; never commit them.
import { getObject, listKeys } from '../../../supabase/functions/_shared/bucket.ts';
import { locationFindings } from '../src/exif.ts';
import { localS3Config } from '../src/local.ts';

const sample = Number(Deno.args[0] ?? 50);
const cfg = await localS3Config();
console.log(`bucket ${cfg.bucket} at ${new URL(cfg.endpoint).host}`);

function pick<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

let checked = 0;
const bad: string[] = [];
for (const prefix of ['moments/', 'avatars/', 'covers/']) {
  const keys = await listKeys(cfg, prefix);
  const groups = prefix === 'moments/'
    ? [keys.filter((k) => k.endsWith('/full.jpg')), keys.filter((k) => k.endsWith('/thumb.jpg'))]
    : [keys];
  for (const group of groups) {
    for (const key of pick(group, sample)) {
      const bytes = await getObject(cfg, key);
      if (bytes === null) continue;
      checked++;
      const found = locationFindings(bytes);
      if (found.length > 0) bad.push(`${key}: ${found.join(', ')}`);
    }
  }
  console.log(`${prefix}: ${keys.length} objects`);
}
console.log(`checked ${checked} files; ${bad.length} with location metadata`);
for (const line of bad) console.log(`  ${line}`);
if (checked === 0) console.log('nothing to check: upload a photo first');
Deno.exit(bad.length > 0 ? 1 : 0);
