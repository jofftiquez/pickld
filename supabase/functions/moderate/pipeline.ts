// The full check (M2-20; FR-SAF-03, FR-SAF-04; D-13, D-22; docs/csam-scanning.md). For a photo:
//   1. CSAM gate: the full photo goes to the hash matcher. A match returns `block` and nothing else runs.
//   2. Content scores: the thumbnail and caption go to omni-moderation; thresholds.ts decides.
//   3. Second opinion: a review verdict (a borderline score) asks a vision model for a short reason that the
//      console shows. It never changes the decision, and its failure never holds the photo back further:
//      the photo is already hidden and queued.
// Every step fails closed: a matcher or scorer error throws, fn:moderate answers 500, and the moment stays
// in Checking until the app's retry calls again (rule 4: nothing goes public unchecked).
import type { ModerationContent, ModerationProvider, ModerationVerdict, TextVerdict } from './provider.ts';
import type { Scorer, SecondOpinionSource } from './openai.ts';
import { decide, type ThresholdSet } from './thresholds.ts';

export interface CsamMatch {
  matched: boolean;
  /** Matcher-specific details kept on the incident (e.g. the list entry); never the image. */
  details?: Record<string, unknown>;
}

/** A child-safety hash matcher (PhotoDNA Cloud Service once approved; a local hash list until then). */
export interface CsamMatcher {
  readonly name: string;
  match(photo: Uint8Array): Promise<CsamMatch>;
}

/** Reads an object from the photo bucket; null when it doesn't exist. */
export type ReadObject = (key: string) => Promise<Uint8Array | null>;

export interface PipelineDeps {
  matcher: CsamMatcher;
  scorer: Scorer;
  secondOpinion: SecondOpinionSource | null;
  read: ReadObject;
  thresholds: ThresholdSet;
  /** Called when the scorer answers with a model other than the pinned one (M5-05). Never throws. */
  onModelDrift?: (expected: string, actual: string) => void;
}

/** Thrown when a photo the moment names isn't in the bucket yet: fn:moderate retries later. */
export class MissingObjectError extends Error {}

async function readRequired(read: ReadObject, key: string | null): Promise<Uint8Array> {
  if (!key) throw new MissingObjectError('the moment has no photo key');
  const bytes = await read(key);
  if (!bytes) throw new MissingObjectError(`object not found: ${key}`);
  return bytes;
}

export function fullCheck(deps: PipelineDeps): ModerationProvider {
  const { thresholds } = deps;
  const noteModel = (model: string) => {
    if (model !== thresholds.model) {
      try {
        deps.onModelDrift?.(thresholds.model, model);
      } catch { /* reporting must never break a check */ }
    }
  };

  return {
    name: `full-check/${deps.matcher.name}/${deps.scorer.name}`,

    async check(content: ModerationContent): Promise<ModerationVerdict> {
      const photo = await readRequired(deps.read, content.photoPath);
      const csam = await deps.matcher.match(photo);
      if (csam.matched) return { decision: 'block', matcher: deps.matcher.name, match: csam.details ?? {} };

      const thumb = await readRequired(deps.read, content.thumbPath);
      const { model, scores } = await deps.scorer.scoreImage(thumb, content.caption);
      noteModel(model);
      const outcome = decide(scores, thresholds.photo);
      if (outcome.decision === 'approve') return { decision: 'approve' };

      const stored = { ...scores, thresholds: thresholds.version, model } as unknown as Record<string, number>;
      let secondOpinion;
      if (outcome.decision === 'review' && deps.secondOpinion) {
        try {
          secondOpinion = await deps.secondOpinion.ask(thumb, content.caption, outcome.reason);
        } catch (error) {
          console.error('moderate: second opinion failed', error instanceof Error ? error.message : '');
        }
      }
      return { decision: outcome.decision, scores: stored, reason: outcome.reason, secondOpinion };
    },

    async checkText(content): Promise<TextVerdict> {
      const { model, scores } = await deps.scorer.scoreText(content.text);
      noteModel(model);
      const outcome = decide(scores, thresholds.text);
      if (outcome.decision === 'approve') return { decision: 'approve' };
      const stored = { ...scores, thresholds: thresholds.version, model } as unknown as Record<string, number>;
      return { decision: outcome.decision, scores: stored, reason: outcome.reason };
    },
  };
}

/**
 * The local stand-in for the hash matcher until PhotoDNA is approved (docs/csam-scanning.md, decision 1).
 * Matches exact SHA-256 hashes from a list (tests put a fixture's hash in it). It finds nothing real:
 * config.ts refuses it in production.
 */
export function hashListMatcher(sha256Hex: Iterable<string>): CsamMatcher {
  const list = new Set([...sha256Hex].map((h) => h.toLowerCase()));
  return {
    name: 'hash-list',
    async match(photo) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', photo as BufferSource));
      const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
      return list.has(hex) ? { matched: true, details: { sha256: hex } } : { matched: false };
    },
  };
}
