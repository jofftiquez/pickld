import { z } from 'zod';

// Only public values may reach the app bundle (AGENTS rule 2). The anon/publishable key is safe because
// RLS decides what it can read; a service key would bypass RLS, so it is refused here and by
// scripts/scan-secrets.mjs in CI.

function jwtRole(token: string): string | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const parsed = z.object({ role: z.string() }).safeParse(json);
    return parsed.success ? parsed.data.role : undefined;
  } catch {
    return undefined;
  }
}

export function isServiceKey(key: string): boolean {
  return key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
}

export const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20)
    .refine((key) => !isServiceKey(key), 'must be the anon (publishable) key, never a service key'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid app environment (${problems}). Copy apps/mobile/.env.example to .env.`);
  }
  return result.data;
}

// Expo inlines EXPO_PUBLIC_* only when read as literal `process.env.NAME` expressions.
export function readEnv(): Env {
  return parseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}
