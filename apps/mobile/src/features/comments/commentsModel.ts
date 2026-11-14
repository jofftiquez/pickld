// The Comments thread for one jar (FR-SOC-06; design: Comments). Rows come back through RLS as the
// viewer: checked comments of a jar they may see, minus blocked users, plus their own comments still
// being checked (0001 comments_select). The thread is one level deep (0005 comments_check_parent).
import { z } from 'zod';

/** FR-SOC-06; the database checks it too (comments.body). */
export const COMMENT_MAX = 300;
/** The counter shows once this few characters are left. */
export const COUNTER_FROM = 30;

export const commentRow = z.object({
  id: z.string(),
  jar_id: z.string(),
  user_id: z.string(),
  parent_id: z.string().nullable(),
  body: z.string(),
  is_hidden: z.boolean(),
  created_at: z.string(),
  author: z
    .object({
      display_name: z.string(),
      username: z.string(),
      /** For the avatar (D-93); missing in caches from before it. */
      avatar_path: z.string().nullish(),
    })
    .nullable(),
});
export type CommentRow = z.infer<typeof commentRow>;

export type ThreadComment = CommentRow & {
  /** The author's own comment, still being checked: only they can see it (D-22: for a moment). */
  pending: boolean;
  canDelete: boolean;
  /** Someone else's comment: Report (M3-21). */
  canReport: boolean;
  /** Replies only go on top-level comments. */
  canReply: boolean;
};
export type ThreadEntry = ThreadComment & { replies: ThreadComment[] };

const byTime = (a: CommentRow, b: CommentRow) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * Top-level comments oldest first, each with its replies oldest first. A reply whose parent the viewer
 * can't see (deleted, still being checked, or from someone they blocked) is shown on its own.
 */
export function buildThread(rows: CommentRow[], viewerId: string, jarOwnerId: string): ThreadEntry[] {
  const decorate = (c: CommentRow, topLevel: boolean): ThreadComment => ({
    ...c,
    pending: c.is_hidden && c.user_id === viewerId,
    canDelete: c.user_id === viewerId || jarOwnerId === viewerId,
    canReport: c.user_id !== viewerId,
    canReply: topLevel && !c.is_hidden,
  });
  const sorted = [...rows].sort(byTime);
  const ids = new Set(sorted.map((c) => c.id));
  const top = sorted.filter((c) => c.parent_id === null || !ids.has(c.parent_id));
  return top.map((c) => ({
    ...decorate(c, c.parent_id === null),
    replies: sorted.filter((r) => r.parent_id === c.id).map((r) => decorate(r, false)),
  }));
}

/** What the send button may send: trimmed, not empty, within the limit. */
export function sendable(body: string): string | null {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= COMMENT_MAX ? trimmed : null;
}
