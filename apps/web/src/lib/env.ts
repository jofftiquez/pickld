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
