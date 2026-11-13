// Moderation thresholds (M2-20, M5-05; FR-SAF-03; architecture §Moderation "Decision by score"). Versioned:
// every change bumps THRESHOLDS.version and adds a line to the history below, and the replay test
// (tests/moderate_replay_test.ts) must still pass over the labelled items in tests/fixtures/moderation/.
// The version is stored with every queued or removed item (scores.thresholds), so a decision can be
// traced to the rules that made it.
//
// Scores come from OpenAI's omni-moderation (0–1 per category). A photo is scored as its 480 px thumbnail
// together with its caption, so text categories (harassment, hate) apply to photos too.
//
//   remove  any score at or above its remove threshold: removed automatically, the owner can appeal.
//   review  otherwise, any score at or above its review threshold: hidden, queued as Auto-check, and a
//           vision second opinion is asked (every review score is borderline by construction: between
//           review and remove).
//   approve everything below review: live within seconds.
//
// History
//   2026-11-12.1  Starting values (conservative, before beta data): remove only very confident sexual and
//                 graphic-violence scores; queue anything moderately likely in any category; never
//                 auto-remove sexual/minors, self-harm or text-only categories, a human decides those;
//                 queue sexual/minors at a very low score because a miss is the costliest mistake.

/** OpenAI omni-moderation categories (category_scores keys). */
export const CATEGORIES = [
  'harassment',
  'harassment/threatening',
  'hate',
  'hate/threatening',
  'illicit',
  'illicit/violent',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
] as const;
export type Category = typeof CATEGORIES[number];
export type Scores = Partial<Record<Category, number>>;

export interface ThresholdSet {
  /** Bumped on every change; stored with each queued or removed item. */
  version: string;
  /** The dated model these values were tuned on. A response from another model is reported (M5-05). */
  model: string;
  /** Photo (thumbnail + caption). */
  photo: { remove: Scores; review: Scores };
  /** Comment text. */
  text: { remove: Scores; review: Scores };
}

export const THRESHOLDS: ThresholdSet = {
  version: '2026-11-12.1',
  model: 'omni-moderation-2024-09-26',
  photo: {
    remove: { 'sexual': 0.9, 'violence/graphic': 0.9 },
    review: {
      'sexual': 0.4,
      'sexual/minors': 0.05,
      'violence': 0.5,
      'violence/graphic': 0.4,
      'self-harm': 0.3,
      'self-harm/intent': 0.3,
      'self-harm/instructions': 0.3,
      'harassment': 0.6,
      'harassment/threatening': 0.5,
      'hate': 0.5,
      'hate/threatening': 0.4,
      'illicit/violent': 0.5,
    },
  },
  text: {
    remove: {},
    review: {
      'sexual': 0.6,
      'sexual/minors': 0.05,
      'violence': 0.7,
      'violence/graphic': 0.6,
      'self-harm': 0.4,
      'self-harm/intent': 0.3,
      'self-harm/instructions': 0.3,
      'harassment': 0.6,
      'harassment/threatening': 0.4,
      'hate': 0.5,
      'hate/threatening': 0.4,
      'illicit/violent': 0.5,
    },
  },
};

export type ScoreDecision =
  | { decision: 'approve' }
  | { decision: 'review' | 'remove'; reason: Category };

/**
 * The decision for one set of scores. The reason is the category that crossed its threshold by the widest
 * margin (relative to that threshold), so the removed notice and the console show the main concern.
 */
export function decide(scores: Scores, rules: { remove: Scores; review: Scores }): ScoreDecision {
  const worst = (limits: Scores): Category | null => {
    let best: Category | null = null;
    let bestRatio = 0;
    for (const [category, limit] of Object.entries(limits) as [Category, number][]) {
      const score = scores[category] ?? 0;
      if (score >= limit && score / limit > bestRatio) {
        best = category;
        bestRatio = score / limit;
      }
    }
    return best;
  };
  const remove = worst(rules.remove);
  if (remove) return { decision: 'remove', reason: remove };
  const review = worst(rules.review);
  if (review) return { decision: 'review', reason: review };
  return { decision: 'approve' };
}
