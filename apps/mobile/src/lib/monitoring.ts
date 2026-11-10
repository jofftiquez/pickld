import * as Sentry from '@sentry/react-native';

import { readMonitoringEnv } from './env';

// Crash and error reporting (NFR-REL-01). Off locally and whenever no DSN is configured, so every
// function here is a safe no-op until the founders add the Sentry keys (D-14).

let enabled = false;

// Touch and console breadcrumbs can carry accessibility labels or logged captions; never send them.
const DROPPED_BREADCRUMBS = new Set(['touch', 'console', 'ui.click']);

export function initMonitoring(): boolean {
  const env = readMonitoringEnv();
  if (!env.EXPO_PUBLIC_SENTRY_DSN || env.EXPO_PUBLIC_APP_ENV === 'local') return false;
  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    environment: env.EXPO_PUBLIC_APP_ENV,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: (crumb) => (crumb.category && DROPPED_BREADCRUMBS.has(crumb.category) ? null : crumb),
  });
  enabled = true;
  return true;
}

export function captureError(error: unknown, context?: Record<string, string | number | boolean>): void {
  if (enabled) Sentry.captureException(error, context ? { extra: context } : undefined);
  else if (__DEV__) console.error(error);
}

/** Tags errors with the user id only. */
export function setMonitoringUser(userId: string | null): void {
  if (enabled) Sentry.setUser(userId ? { id: userId } : null);
}
