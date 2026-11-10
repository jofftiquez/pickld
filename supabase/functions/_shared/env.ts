// Configuration from the Edge Function environment. SUPABASE_URL and SUPABASE_ANON_KEY are provided by
// the runtime; the rest are Supabase secrets (`supabase secrets set …`, locally supabase/functions/.env).
import { createClient, type SupabaseClient } from './deps.ts';
import type { S3Config } from './sigv4.ts';

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v;
}

/** A client that acts as the caller: every query goes through RLS with their JWT. Never a service key. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The photo bucket: R2 in staging/production, the local Supabase Storage S3 endpoint in development. */
export function s3ConfigFromEnv(): S3Config {
  return {
    endpoint: required('S3_ENDPOINT'),
    region: Deno.env.get('S3_REGION') || 'auto',
    bucket: Deno.env.get('S3_BUCKET') || 'photos',
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
  };
}

/** Origin of the photo Worker (workers/photos). */
export function photoBaseUrl(): string {
  return required('PHOTO_BASE_URL');
}

/** Shared with the photo Worker; signs photo tokens. */
export function photoTokenSecret(): string {
  return required('PHOTO_TOKEN_SECRET');
}
