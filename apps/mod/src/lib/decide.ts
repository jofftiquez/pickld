import { z } from 'zod';

import type { QueueItem } from './queue';

// What fn:mod-action accepts (supabase/functions/mod-action/handler.ts).
export const GUIDELINES = ['sexual', 'harassment', 'violence', 'hate', 'spam', 'under_13', 'other'] as const;
export type Guideline = (typeof GUIDELINES)[number];
export const ACTIONS = ['keep', 'remove', 'remove_warn', 'escalate'] as const;
export type Action = (typeof ACTIONS)[number];

export const DecisionInput = z.object({
  itemId: z.uuid(),
  action: z.enum(ACTIONS),
  guideline: z.enum(GUIDELINES).optional(),
});
export type DecisionInput = z.infer<typeof DecisionInput>;

export const ERROR_CODES = [
  'not_found',
  'already_decided',
  'same_moderator',
  'own_content',
  'unsupported',
  'not_moderator',
] as const;
export type DecisionResult = { ok: true } | { ok: false; code: (typeof ERROR_CODES)[number] | 'unknown' };

/**
 * The guideline Remove starts on. Report and appeal reasons are guidelines already; an auto-check reason is
 * an omni-moderation category, mapped to the guideline it falls under. The moderator can always change it.
 */
export function defaultGuideline(item: Pick<QueueItem, 'reason'>): Guideline | null {
  const r = item.reason;
  if (!r) return null;
  if ((GUIDELINES as readonly string[]).includes(r)) return r as Guideline;
  const head = r.split('/')[0];
  if (head === 'sexual' || head === 'harassment' || head === 'violence' || head === 'hate') return head;
  return null;
}

/** Which buttons apply: escalated items can't be escalated again; jar and profile reports can't be removed. */
export function allowed(item: Pick<QueueItem, 'status' | 'kind'>): Record<Action, boolean> {
  const removable = item.kind === 'moment' || item.kind === 'comment';
  return { keep: true, remove: removable, remove_warn: removable, escalate: item.status === 'pending' };
}
