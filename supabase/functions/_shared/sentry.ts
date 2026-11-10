// Crash reporting for Edge Functions (M1-17, built with M1-15). A no-op unless SENTRY_DSN is set:
// without it the Sentry SDK isn't even loaded. Only the error and the function name are sent, never
// request bodies, photos or captions (AGENTS rules 9 and 10).
import { fail } from './http.ts';

type Handler = (req: Request) => Response | Promise<Response>;

interface SentryLike {
  init(options: Record<string, unknown>): void;
  withScope(fn: (scope: { setTag(key: string, value: string): void }) => void): void;
  captureException(error: unknown): void;
  flush(timeout: number): Promise<boolean>;
}

let loaded: Promise<SentryLike | null> | undefined;

function loadSentry(): Promise<SentryLike | null> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return Promise.resolve(null);
  return import('npm:@sentry/deno@11.12.0').then((sentry) => {
    const s = sentry as unknown as SentryLike;
    s.init({
      dsn,
      environment: Deno.env.get('APP_ENV') ?? 'local',
      defaultIntegrations: false, // the Edge runtime shares globals between requests
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    return s;
  });
}

/** Reports an error to Sentry when configured. Never throws. */
export async function reportError(fn: string, error: unknown): Promise<void> {
  try {
    const sentry = await (loaded ??= loadSentry());
    if (!sentry) return;
    sentry.withScope((scope) => {
      scope.setTag('function', fn);
      sentry.captureException(error);
    });
    await sentry.flush(2000);
  } catch {
    // Monitoring must never break a request.
  }
}

/** Wraps a handler: an unexpected error becomes a 500 `{ error }` and is reported. */
export function withSentry(fn: string, handler: Handler): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error(`${fn}:`, error);
      await reportError(fn, error);
      return fail(500, 'internal', 'Something went wrong. Please try again.');
    }
  };
}
