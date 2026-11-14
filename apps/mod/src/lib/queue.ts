import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { t } from '~/i18n/t';

export const FILTERS = ['all', 'auto_check', 'report', 'appeal', 'escalated'] as const;
export type Filter = (typeof FILTERS)[number];
export const FilterParam = z.enum(FILTERS).catch('all');

// One row of public.mod_queue() (0042), paged by mod_queue_page() (0120).
const Item = z.object({
  id: z.uuid(),
  source: z.enum(['auto_check', 'report', 'appeal']),
  status: z.enum(['pending', 'escalated', 'kept', 'removed']),
  created_at: z.string(),
  kind: z.enum(['moment', 'comment', 'jar', 'profile']),
  moment_id: z.uuid().nullable(),
  slot: z.string().nullable(),
  local_date: z.string().nullable(),
  caption: z.string().nullable(),
  comment_body: z.string().nullable(),
  reason: z.string().nullable(),
  score: z.number().nullable(),
  report_count: z.number(),
  appeal_message: z.string().nullable(),
  owner_id: z.uuid().nullable(),
  username: z.string().nullable(),
  owner_joined: z.string().nullable(),
  prior_removals: z.number(),
  visible: z.boolean().nullable(),
});
export type QueueItem = z.infer<typeof Item>;

const Stats = z.object({
  pending: z.number(),
  median_wait_seconds: z.number(),
  open_appeals: z.number(),
  all_open: z.number(),
  auto_check: z.number(),
  report: z.number(),
  escalated: z.number(),
});
export type QueueStats = z.infer<typeof Stats>;

/** One page of the queue (0120), oldest first unless `newest`. */
export async function loadQueue(
  client: SupabaseClient,
  filter: Filter,
  page: { size: number; offset: number },
  newest = false,
): Promise<QueueItem[]> {
  const { data, error } = await client.rpc('mod_queue_page', {
    p_filter: filter,
    p_limit: page.size,
    p_offset: page.offset,
    p_newest: newest,
  });
  if (error) throw new Error(error.message);
  return z.array(Item).parse(data);
}

/** How many items a filter holds, from the header counts. */
export function filterTotal(stats: QueueStats, filter: Filter): number {
  switch (filter) {
    case 'all':
      return stats.all_open;
    case 'appeal':
      return stats.open_appeals;
    default:
      return stats[filter];
  }
}

export async function loadStats(client: SupabaseClient): Promise<QueueStats> {
  const { data, error } = await client.rpc('mod_queue_stats').single();
  if (error) throw new Error(error.message);
  return Stats.parse(data);
}

/**
 * The guideline a reason belongs to: report reasons are guidelines already; auto-check reasons are
 * omni-moderation categories ("violence/graphic"), grouped by their first part.
 */
export function reasonLabel(reason: string | null): string {
  if (!reason) return t('reason.unknown');
  const key = reason === 'sexual/minors' ? 'sexual_minors' : (reason.split('/')[0] ?? reason).replace('-', '_');
  try {
    return t(`reason.${key}`);
  } catch {
    return reason;
  }
}

/** "2m", "6m", "1h", "3d": how long an item has waited. */
export function waitLabel(seconds: number): string {
  const m = Math.max(0, Math.floor(seconds / 60));
  if (m < 60) return t('wait.minutes', { n: m });
  const h = Math.floor(m / 60);
  return h < 48 ? t('wait.hours', { n: h }) : t('wait.days', { n: Math.floor(h / 24) });
}

export function waitedSeconds(createdAt: string, now: number): number {
  return (now - Date.parse(createdAt)) / 1000;
}

/** "Sat, Nov 7" for a jar's local date (a plain date, so read in UTC). */
export function dayLabel(localDate: string): string {
  return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
