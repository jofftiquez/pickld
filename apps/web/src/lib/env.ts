import { z } from 'zod';

// Server-only configuration (see .env.example). The anon key is a public value, but it stays on the
// server anyway: pages are rendered there and the browser only gets HTML and signed photo URLs.
const supabase = z.object({ SUPABASE_URL: z.url(), SUPABASE_ANON_KEY: z.string().min(20) });

export function env() {
  return supabase.parse(process.env);
}

const optionalUrl = z
  .url()
  .optional()
  .catch(undefined);

/** Store listings; static pages read them at build time, so they never need the Supabase settings. */
export function storeLinks() {
  return {
    appStore: optionalUrl.parse(process.env.APP_STORE_URL || undefined) ?? null,
    googlePlay:
      optionalUrl.parse(process.env.PLAY_STORE_URL || undefined) ??
      'https://play.google.com/store/apps/details?id=me.pickld.app',
  };
}

/** The public origin, for absolute link-preview URLs (og:url, og:image). */
export function siteUrl(): string {
  return optionalUrl.parse(process.env.SITE_URL || undefined) ?? 'https://pickld.me';
}

/** App identity for universal links / app links (M4-15); null until the founders set them. */
export function appIdentity() {
  const team = z
    .string()
    .regex(/^[A-Z0-9]{10}$/)
    .safeParse(process.env.APPLE_TEAM_ID);
  const certs = (process.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  return { appleTeamId: team.success ? team.data : null, androidCerts: certs };
}

export const APP_ID = 'me.pickld.app';
