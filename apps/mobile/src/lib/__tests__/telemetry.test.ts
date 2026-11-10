import type { Session } from '@supabase/supabase-js';

const mockSentry = { init: jest.fn(), captureException: jest.fn(), setUser: jest.fn() };
jest.mock('@sentry/react-native', () => mockSentry);
const mockPostHog = { capture: jest.fn(), identify: jest.fn(), reset: jest.fn() };
const mockPostHogCtor = jest.fn((..._args: unknown[]) => mockPostHog);
jest.mock('posthog-react-native', () => ({ __esModule: true, default: mockPostHogCtor }));

const ENV_KEYS = ['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_SENTRY_DSN', 'EXPO_PUBLIC_POSTHOG_KEY'] as const;
const session = (id: string) => ({ user: { id } }) as unknown as Session;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  for (const k of ENV_KEYS) delete process.env[k];
});

function load() {
  /* eslint-disable @typescript-eslint/no-require-imports */
  return {
    telemetry: require('../telemetry') as typeof import('../telemetry'),
    monitoring: require('../monitoring') as typeof import('../monitoring'),
    analytics: require('../analytics') as typeof import('../analytics'),
    auth: require('../authStore') as typeof import('../authStore'),
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
}

describe('telemetry', () => {
  it('stays off locally and without keys', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    const { telemetry, monitoring, analytics, auth } = load(); // APP_ENV defaults to local
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stop = telemetry.startTelemetry();
    monitoring.captureError(new Error('boom'));
    analytics.track('follow', {});
    auth.useAuthStore.getState().setSession(session('u1'));
    expect(mockSentry.init).not.toHaveBeenCalled();
    expect(mockSentry.captureException).not.toHaveBeenCalled();
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    stop();
    errorSpy.mockRestore();
  });

  it('reports to Sentry and PostHog in staging and follows the signed-in user id only', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'staging';
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    const { telemetry, monitoring, analytics, auth } = load();
    const stop = telemetry.startTelemetry();
    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'staging', sendDefaultPii: false }),
    );
    const { beforeBreadcrumb } = mockSentry.init.mock.calls[0][0];
    expect(beforeBreadcrumb({ category: 'touch', message: '#ootd, beach day' })).toBeNull();
    expect(beforeBreadcrumb({ category: 'navigation' })).toEqual({ category: 'navigation' });

    const err = new Error('boom');
    monitoring.captureError(err);
    expect(mockSentry.captureException).toHaveBeenCalledWith(err, undefined);
    analytics.track('notification_opt_in', { granted: true });
    expect(mockPostHog.capture).toHaveBeenCalledWith('notification_opt_in', { granted: true });

    auth.useAuthStore.getState().setSession(session('u1'));
    expect(mockSentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' });
    expect(mockPostHog.identify).toHaveBeenCalledWith('u1');
    auth.useAuthStore.getState().setSession(null);
    expect(mockSentry.setUser).toHaveBeenLastCalledWith(null);
    expect(mockPostHog.reset).toHaveBeenCalled();
    stop();
  });
});
