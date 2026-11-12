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

/**
 * The server credential, for fn:moderate only: applying a verdict must be something no client can do.
 * SUPABASE_SERVICE_ROLE_KEY is provided by the Edge runtime and never leaves the server (rule 2). Even
 * with it, a moment becomes live or removed only through moderation_apply() (migration 0011).
 */
export function serviceClient(): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
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

/**
 * The photo bucket for requests a function sends itself (fn:account-purge's sweep). Signed URLs for the app
 * keep S3_ENDPOINT; locally that is 127.0.0.1, which inside the Edge runtime container is the container,
 * so S3_INTERNAL_ENDPOINT (http://host.docker.internal:…) reaches the host instead. Unset with R2.
 */
export function s3ServerConfigFromEnv(): S3Config {
  const config = s3ConfigFromEnv();
  return { ...config, endpoint: Deno.env.get('S3_INTERNAL_ENDPOINT') || config.endpoint };
}

/** Origin of the photo Worker (workers/photos). */
export function photoBaseUrl(): string {
  return required('PHOTO_BASE_URL');
}

/** Shared with the photo Worker; signs photo tokens. */
export function photoTokenSecret(): string {
  return required('PHOTO_TOKEN_SECRET');
}

/** HMAC key for contact hashes (fn:contacts-match, D-4). Never leaves the Edge Function, not even to Postgres. */
export function contactHashSecret(): string {
  return required('CONTACT_HASH_SECRET');
}

/** The header value the Supabase Cron job sends to fn:send-push (at least 32 characters). */
export function pushCronSecret(): string {
  return required('PUSH_CRON_SECRET');
}

/** Optional: only needed when the Expo project turns on enhanced push security. */
export function expoAccessToken(): string | undefined {
  return Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;
}

/** A client with only the anon key and no caller (fn:public-page): Postgres decides what anon may read. */
export function anonClient(): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
