import { s3ServerConfigFromEnv, serviceClient, userClient } from '../_shared/env.ts';
import { fail } from '../_shared/http.ts';
import { reportError, withSentry } from '../_shared/sentry.ts';
import { selectProvider } from './config.ts';
import { handleModerate } from './handler.ts';

// The full check when OPENAI_API_KEY is set, auto-approve locally without it; production refuses
// anything short of the full check with an approved matcher (config.ts).
let drift = false;
const provider = (() => {
  try {
    return selectProvider(Deno.env, s3ServerConfigFromEnv, (expected, actual) => {
      // M5-05: OpenAI moved the model under omni-moderation-latest; thresholds need re-checking.
      if (drift) return;
      drift = true;
      void reportError('moderate', new Error(`moderation model changed: tuned on ${expected}, got ${actual}`));
    });
  } catch (error) {
    void reportError('moderate', error);
    console.error('moderate: not configured', error instanceof Error ? error.message : '');
    return null;
  }
})();

Deno.serve(
  withSentry(
    'moderate',
    (req) =>
      provider
        ? handleModerate(req, { userClient, serviceClient, provider })
        : fail(503, 'not_configured', 'Photo checks are not available right now.'),
  ),
);
