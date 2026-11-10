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

// Monitoring keys are optional: without them Sentry and PostHog stay off (D-14). Both are public
// client keys (Sentry DSN, PostHog project key), safe to bundle.
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const monitoringEnvSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  EXPO_PUBLIC_SENTRY_DSN: optional(z.url()),
  EXPO_PUBLIC_POSTHOG_KEY: optional(z.string().startsWith('phc_')),
  EXPO_PUBLIC_POSTHOG_HOST: z.url().default('https://us.i.posthog.com'),
});

export type MonitoringEnv = z.infer<typeof monitoringEnvSchema>;

/** Invalid optional values turn monitoring off instead of crashing the app. */
export function parseMonitoringEnv(source: Record<string, string | undefined>): MonitoringEnv {
  const result = monitoringEnvSchema.safeParse(source);
  return result.success ? result.data : monitoringEnvSchema.parse({});
}

export function readMonitoringEnv(): MonitoringEnv {
  return parseMonitoringEnv({
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  });
}
