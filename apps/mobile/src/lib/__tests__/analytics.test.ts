import { sanitizeEvent, setAnalyticsSink, track, type AnalyticsSink } from '../analytics';
import { parseMonitoringEnv } from '../env';

jest.mock('posthog-react-native', () => jest.fn());

function fakeSink() {
  const sink: AnalyticsSink & { events: [string, object][] } = {
    events: [],
    capture: (e, p) => sink.events.push([e, p]),
    identify: jest.fn(),
    reset: jest.fn(),
  };
  return sink;
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  setAnalyticsSink(null);
  warn.mockRestore();
});

describe('analytics allowlist', () => {
  it('sends allowed events with their properties', () => {
    const sink = fakeSink();
    setAnalyticsSink(sink);
    expect(track('moment_added', { slot: 'ootd', is_private: false, backfilled: false })).toBe(true);
    expect(track('jar_full', {})).toBe(true);
    expect(sink.events).toEqual([
      ['moment_added', { slot: 'ootd', is_private: false, backfilled: false }],
      ['jar_full', {}],
    ]);
  });

  it('rejects photo, caption and extra properties at compile time and drops them at runtime', () => {
    const sink = fakeSink();
    setAnalyticsSink(sink);
    // @ts-expect-error caption is not an allowed property
    expect(track('moment_added', { slot: 'ootd', is_private: false, backfilled: false, caption: 'beach day' })).toBe(
      false,
    );
    // @ts-expect-error photo URLs are not allowed
    expect(track('jar_published', { visibility: 'everyone', photo_url: 'https://x/y.webp' })).toBe(false);
    // @ts-expect-error moment ids are not allowed
    expect(track('first_moment', { slot: 'selfie', is_private: false, backfilled: false, moment_id: 'm1' })).toBe(
      false,
    );
    expect(sink.events).toEqual([]);
  });

  it('never sends private moments', () => {
    const sink = fakeSink();
    setAnalyticsSink(sink);
    // @ts-expect-error private moments can't be tracked
    expect(track('moment_added', { slot: 'evening', is_private: true, backfilled: false })).toBe(false);
    expect(sanitizeEvent('first_moment', { slot: 'evening', backfilled: false })).toBeNull(); // must say not private
    expect(sink.events).toEqual([]);
  });

  it('drops unknown events and invalid values from untyped callers', () => {
    expect(sanitizeEvent('photo_viewed', {})).toBeNull();
    expect(sanitizeEvent('toString', {})).toBeNull();
    expect(sanitizeEvent('moment_added', { slot: 'lunch', is_private: false, backfilled: false })).toBeNull();
    expect(sanitizeEvent('report_submitted', { target: 'moment', reason: 'free text' })).toBeNull();
  });

  it('is a no-op without a PostHog key', () => {
    expect(track('follow', {})).toBe(false);
    const env = parseMonitoringEnv({});
    expect(env.EXPO_PUBLIC_APP_ENV).toBe('local');
    expect(env.EXPO_PUBLIC_POSTHOG_KEY).toBeUndefined();
    expect(parseMonitoringEnv({ EXPO_PUBLIC_POSTHOG_KEY: 'not-a-key' }).EXPO_PUBLIC_POSTHOG_KEY).toBeUndefined();
  });
});
