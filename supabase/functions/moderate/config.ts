// Which provider fn:moderate uses (M2-20; D-22, D-41). From the environment:
//
//   OPENAI_API_KEY        set → the full check (pipeline.ts); empty → auto-approve (D-22's early version).
//   OPENAI_BASE_URL       tests and local stand-ins only; empty means api.openai.com.
//   OPENAI_VISION_MODEL   the second-opinion model (D-13); default gpt-4.1-mini. "off" asks none.
//   CSAM_MATCHER          hash-list (the local stand-in; PhotoDNA once approved).
//   CSAM_HASH_LIST        hash-list only: comma-separated SHA-256 hashes that count as a match.
//
// Production (APP_ENV=production) refuses auto-approve and the hash-list stand-in: selectProvider()
// throws, every call answers 500, and photos stay in Checking (fail closed, rule 4) until the real keys
// and an approved matcher are configured. This is the "must not open to the public" guard of D-22.
import { getObject } from '../_shared/bucket.ts';
import type { S3Config } from '../_shared/sigv4.ts';
import { openAIModeration, openAISecondOpinion } from './openai.ts';
import { type CsamMatcher, fullCheck, hashListMatcher } from './pipeline.ts';
import { autoApprove, type ModerationProvider } from './provider.ts';
import { THRESHOLDS } from './thresholds.ts';

export interface ProviderEnv {
  get(name: string): string | undefined;
}

export class ModerationConfigError extends Error {}

function matcherFrom(env: ProviderEnv, production: boolean): CsamMatcher {
  const kind = env.get('CSAM_MATCHER') || 'hash-list';
  if (kind !== 'hash-list') throw new ModerationConfigError(`unknown CSAM_MATCHER: ${kind}`);
  if (production) {
    throw new ModerationConfigError(
      'the hash-list matcher is a local stand-in; production needs an approved CSAM matcher',
    );
  }
  return hashListMatcher((env.get('CSAM_HASH_LIST') || '').split(',').map((h) => h.trim()).filter(Boolean));
}

export function selectProvider(
  env: ProviderEnv,
  s3: () => S3Config,
  onModelDrift?: (expected: string, actual: string) => void,
): ModerationProvider {
  const production = env.get('APP_ENV') === 'production';
  const apiKey = env.get('OPENAI_API_KEY');
  if (!apiKey) {
    if (production) throw new ModerationConfigError('OPENAI_API_KEY is required in production');
    return autoApprove;
  }
  const baseUrl = env.get('OPENAI_BASE_URL') || undefined;
  const vision = env.get('OPENAI_VISION_MODEL') || 'gpt-4.1-mini';
  const config = s3();
  return fullCheck({
    matcher: matcherFrom(env, production),
    scorer: openAIModeration({ apiKey, baseUrl, model: 'omni-moderation-latest' }),
    secondOpinion: vision === 'off' ? null : openAISecondOpinion({ apiKey, baseUrl, model: vision }),
    read: (key) => getObject(config, key),
    thresholds: THRESHOLDS,
    onModelDrift,
  });
}
