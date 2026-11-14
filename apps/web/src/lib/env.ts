import { z } from 'zod';

// Server-only configuration (see .env.example). The anon key is a public value, but it stays on the
// server anyway: pages are rendered there and the browser only gets HTML and signed photo URLs.
const supabase = z.object({ SUPABASE_URL: z.url(), SUPABASE_ANON_KEY: z.string().min(20) });

export function env() {
  return supabase.parse(process.env);
}

const optionalUrl = z.url().optional().catch(undefined);

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

/**
 * The waitlist form's server settings (INV-12): Supabase Auth on SUPABASE_URL with the anon key, and the
 * Turnstile secret that checks the form's captcha token. Null until TURNSTILE_SECRET_KEY is set, and the form
 * then says try later, so a missing secret never skips the captcha.
 */
export function waitlistEnv() {
  const parsed = supabase
    .extend({
      TURNSTILE_SECRET_KEY: z.string().min(20),
      TURNSTILE_VERIFY_URL: z.url().default('https://challenges.cloudflare.com/turnstile/v0/siteverify'),
    })
    .safeParse({ ...process.env, TURNSTILE_VERIFY_URL: process.env.TURNSTILE_VERIFY_URL || undefined });
  return parsed.success ? parsed.data : null;
}

/**
 * The Turnstile widget's public site key, read when the page renders. Unset, it is Cloudflare's always-pass
 * test key: harmless in production, because tokens from it fail against a real secret.
 */
export function turnstileSiteKey(): string {
  return process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
}
