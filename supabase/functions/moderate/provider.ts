// The moderation provider seam (M2-19; D-22, T-105). fn:moderate asks a provider about the content a
// moment would show (its photo, thumbnail and caption) and applies the verdict. The early version uses
// autoApprove, which calls nothing. The full pipeline (CSAM gate, OpenAI omni-moderation on the
// thumbnail and caption, thresholds, second opinion) is another ModerationProvider, swapped in at
// moderate/index.ts without changing the handler, the schema or the app.

/** The content being checked: the pending proposal when there is one, otherwise the moment itself. */
export interface ModerationContent {
  momentId: string;
  userId: string;
  photoPath: string | null;
  thumbPath: string | null;
  caption: string | null;
}

/**
 * approve: the content goes live (a pending proposal is swapped in).
 * review:  the content stays hidden and a `moderation_items` row joins the queue.
 * remove:  the content is refused (a new moment becomes `removed`; a proposal is discarded).
 */
export type ModerationVerdict =
  | { decision: 'approve'; scores?: Record<string, number> }
  | { decision: 'review' | 'remove'; scores: Record<string, number>; reason: string };

export interface ModerationProvider {
  /** Stable name, recorded with queued and removed items. */
  readonly name: string;
  check(content: ModerationContent): Promise<ModerationVerdict>;
}

/** Early version (D-22): no provider is called and everything is approved. Not for public launch. */
export const autoApprove: ModerationProvider = {
  name: 'auto-approve',
  check: () => Promise.resolve({ decision: 'approve' }),
};
