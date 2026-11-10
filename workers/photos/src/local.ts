// Local development only (Deno): the S3 stand-in is the Supabase Storage S3 endpoint of the local stack
// (`pnpm db:start`), bucket `photos` (created by supabase/seed.sql). Credentials are read at runtime
// from `supabase status`, never stored in the repo; S3_* variables override them.
import type { S3Config } from '../../../supabase/functions/_shared/sigv4.ts';

async function supabaseStatus(): Promise<Record<string, string>> {
  const out = await new Deno.Command('pnpm', {
    args: ['exec', 'supabase', 'status', '-o', 'json'],
    stdout: 'piped',
    stderr: 'null',
  }).output();
  const text = new TextDecoder().decode(out.stdout);
  return JSON.parse(text.slice(text.indexOf('{')));
}

export async function localS3Config(): Promise<S3Config> {
  const env = Deno.env.toObject();
  if (env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    return {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION || 'local',
      bucket: env.S3_BUCKET || 'photos',
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    };
  }
  const s = await supabaseStatus();
  return {
    endpoint: s.STORAGE_S3_URL,
    region: s.S3_PROTOCOL_REGION || 'local',
    bucket: env.S3_BUCKET || 'photos',
    accessKeyId: s.S3_PROTOCOL_ACCESS_KEY_ID,
    secretAccessKey: s.S3_PROTOCOL_ACCESS_KEY_SECRET,
  };
}

export function requireTokenSecret(): string {
  const secret = Deno.env.get('PHOTO_TOKEN_SECRET') ?? '';
  if (secret.length < 32) {
    throw new Error('Set PHOTO_TOKEN_SECRET (32+ characters) in workers/photos/.env; see .env.example');
  }
  return secret;
}
