import { z } from 'zod';

// Server-only configuration (see .env.example). No service key: every request uses the moderator's own
// session, and Postgres checks the role.
const schema = z.object({ SUPABASE_URL: z.url(), SUPABASE_ANON_KEY: z.string().min(20) });

export function env() {
  return schema.parse(process.env);
}

/** The origin the browser used (Host header), so redirects keep the session cookie's host. */
export function originOf(h: Headers): string {
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}
