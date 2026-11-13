// The moderation provider seam (M2-19, M2-20; D-22, T-105). fn:moderate asks a provider about the content a
// moment would show (its photo, thumbnail and caption) and applies the verdict. The full check
// (pipeline.ts: CSAM hash match, OpenAI omni-moderation on the thumbnail and caption, thresholds, a vision
// second opinion on borderline scores) is chosen in config.ts; autoApprove, which calls nothing, is kept
// for local work and refused in production. Text (comments; M3-10) goes through the same provider.

/** The content being checked: the pending proposal when there is one, otherwise the moment itself. */
export interface ModerationContent {
  momentId: string;
  userId: string;
  photoPath: string | null;
  thumbPath: string | null;
  caption: string | null;
}

/** Text someone wrote that others will read. Only comments are held back while checked (0016). */
export interface TextContent {
  kind: 'comment' | 'username' | 'bio';
  userId: string;
  text: string;
}

/** A vision model's short opinion on a borderline photo (D-13). Shown in the console; never decides. */
export interface SecondOpinion {
  model: string;
  verdict: 'allow' | 'remove' | 'unsure';
  reason: string;
}

/**
 * approve: the content goes live (a pending proposal is swapped in).
 * review:  the content stays hidden and a `moderation_items` row joins the queue.
 * remove:  the content is refused (a new moment becomes `removed`; a proposal is discarded).
 * block:   a child-safety hash match (FR-SAF-04): removed, owner suspended, csam_incidents row, never
 *          queued. Photos only.
 */
export type ModerationVerdict =
  | { decision: 'approve'; scores?: Record<string, number> }
  | {
    decision: 'review' | 'remove';
    scores: Record<string, number>;
    reason: string;
    secondOpinion?: SecondOpinion;
  }
  | { decision: 'block'; matcher: string; match: Record<string, unknown> };

/** Text verdicts: a hash match only applies to photos. */
export type TextVerdict = Exclude<ModerationVerdict, { decision: 'block' }>;

export interface ModerationProvider {
  /** Stable name, recorded with queued and removed items. */
  readonly name: string;
  check(content: ModerationContent): Promise<ModerationVerdict>;
  /** The same verdicts for text: approve shows it, review queues it, remove refuses it. */
  checkText(content: TextContent): Promise<TextVerdict>;
}

/**
 * The early version's provider (D-22): nothing is called and everything is approved, text included
 * (reserved usernames are refused by the database, 0016). config.ts refuses it in production.
 */
export const autoApprove: ModerationProvider = {
  name: 'auto-approve',
  check: () => Promise.resolve({ decision: 'approve' }),
  checkText: () => Promise.resolve({ decision: 'approve' }),
};
