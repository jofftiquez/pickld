import { identifyUser, initAnalytics, resetAnalytics } from './analytics';
import { useAuthStore } from './authStore';
import { initMonitoring, setMonitoringUser } from './monitoring';

/** Starts Sentry and PostHog (each a no-op without keys) and keeps their user id in sync with auth. */
export function startTelemetry(): () => void {
  initMonitoring();
  initAnalytics();
  return useAuthStore.subscribe((state, prev) => {
    const id = state.session?.user.id ?? null;
    if (id === (prev.session?.user.id ?? null)) return;
    setMonitoringUser(id);
    if (id) identifyUser(id);
    else resetAnalytics();
  });
}
