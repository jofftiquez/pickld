import PostHog from 'posthog-react-native';
import { z } from 'zod';

import { slots } from '@/theme/tokens';

import { readMonitoringEnv } from './env';

// Product analytics (NFR-ANL-01) behind an allowlist (AGENTS rules 9 and 10, G-19):
// - only the events below, each with a strict property schema; unknown properties drop the event;
// - no photos, captions, moment ids, URLs or free text anywhere;
// - moment events require `is_private: false`, so private moments never reach analytics.
// Typed callers get a compile error for any of these; untyped data is checked again at runtime.

const slot = z.enum(slots);
const notPrivate = z.literal(false);

export const analyticsEvents = {
  signup_step_completed: z.strictObject({
    step: z.enum(['welcome', 'sign_up', 'about', 'day', 'people', 'jar_lid', 'permissions', 'friends', 'promise']),
  }),
  first_moment: z.strictObject({ slot, is_private: notPrivate, backfilled: z.boolean() }),
  moment_added: z.strictObject({ slot, is_private: notPrivate, backfilled: z.boolean() }),
  jar_full: z.strictObject({}),
  jar_published: z.strictObject({ visibility: z.enum(['readers', 'everyone', 'only_me']) }),
  share_card_exported: z.strictObject({ destination: z.enum(['save', 'share']) }),
  follow: z.strictObject({}),
  report_submitted: z.strictObject({ target: z.enum(['jar', 'moment', 'comment', 'profile']) }),
  notification_opt_in: z.strictObject({ granted: z.boolean() }),
} as const;

export type AnalyticsEvent = keyof typeof analyticsEvents;
export type AnalyticsProps<E extends AnalyticsEvent> = z.infer<(typeof analyticsEvents)[E]>;

// Defence in depth: refuse property names that look like content even if a schema is later loosened.
const FORBIDDEN_KEY = /caption|photo|image|uri|url|text|comment_body|moment_id|thumb/i;

export interface AnalyticsSink {
  capture: (event: string, properties: Record<string, string | number | boolean>) => void;
  identify: (distinctId: string) => void;
  reset: () => void;
}

let sink: AnalyticsSink | null = null;

/** Creates the PostHog client when a key is configured; without one every call is a no-op. */
export function initAnalytics(): boolean {
  const env = readMonitoringEnv();
  if (!env.EXPO_PUBLIC_POSTHOG_KEY || env.EXPO_PUBLIC_APP_ENV === 'local') return false;
  const client = new PostHog(env.EXPO_PUBLIC_POSTHOG_KEY, {
    host: env.EXPO_PUBLIC_POSTHOG_HOST,
    personProfiles: 'identified_only',
    disableGeoip: true,
    captureAppLifecycleEvents: false,
  });
  sink = {
    capture: (event, properties) => client.capture(event, properties),
    identify: (id) => client.identify(id),
    reset: () => client.reset(),
  };
  return true;
}

/** For tests and alternative transports. */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

/** Validates an event against the allowlist; returns the properties to send, or null to drop it. */
export function sanitizeEvent(event: string, properties: unknown): Record<string, string | number | boolean> | null {
  if (!Object.hasOwn(analyticsEvents, event)) return null;
  const parsed = analyticsEvents[event as AnalyticsEvent].safeParse(properties ?? {});
  if (!parsed.success) return null;
  const data = parsed.data as Record<string, string | number | boolean>;
  if (Object.keys(data).some((k) => FORBIDDEN_KEY.test(k))) return null;
  return data;
}

export function track<E extends AnalyticsEvent>(event: E, properties: AnalyticsProps<E>): boolean {
  const clean = sanitizeEvent(event, properties);
  if (!clean) {
    if (__DEV__) console.warn(`analytics: dropped "${event}" (not on the allowlist or has disallowed properties)`);
    return false;
  }
  sink?.capture(event, clean);
  return sink !== null;
}

/** Events carry the user id only (architecture §Privacy), never profile fields. */
export function identifyUser(userId: string): void {
  sink?.identify(userId);
}

export function resetAnalytics(): void {
  sink?.reset();
}
