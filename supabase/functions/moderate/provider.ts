// The moderation provider seam (M2-19; D-22, T-105). fn:moderate asks a provider about the content a
// moment would show (its photo, thumbnail and caption) and applies the verdict. The early version uses
// autoApprove, which calls nothing. The full pipeline (CSAM gate, OpenAI omni-moderation on the
// thumbnail and caption, thresholds, second opinion) is another ModerationProvider, swapped in at
// moderate/index.ts without changing the handler, the schema or the app. Text (comments, usernames,
// bios; M3-10) goes through the same provider, so the full check covers it too.

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
  /** The same verdicts for text: approve shows it, review queues it, remove refuses it. */
  checkText(content: TextContent): Promise<ModerationVerdict>;
}

/**
 * Early version (D-22): no provider is called and everything is approved, text included (reserved
 * usernames are refused by the database, 0016). Not for public launch.
 */
export const autoApprove: ModerationProvider = {
  name: 'auto-approve',
  check: () => Promise.resolve({ decision: 'approve' }),
  checkText: () => Promise.resolve({ decision: 'approve' }),
};
