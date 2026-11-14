import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// public.mod_overview() (0090): counts only, no photos or captions.
const Overview = z.object({
  queue: z.object({
    open: z.number(),
    pending: z.number(),
    escalated: z.number(),
    oldest_seconds: z.number(),
    median_wait_seconds: z.number(),
    over_two_hours: z.number(),
  }),
  today: z.object({
    reports: z.number(),
    appeals_opened: z.number(),
    appeals_decided: z.number(),
    removed_auto: z.number(),
    removed_by_moderators: z.number(),
    kept: z.number(),
    suspensions: z.number(),
    decisions: z.array(z.object({ username: z.string(), count: z.number() })),
  }),
  suspended: z.object({ total: z.number(), child_safety: z.number() }),
  people: z.object({
    signups_today: z.number(),
    signups_week: z.number(),
    posted_today: z.number(),
    posted_week: z.number(),
    moments_today: z.number(),
  }),
  stuck_uploads: z.number(),
});
export type OverviewData = z.infer<typeof Overview>;

export async function loadOverview(client: SupabaseClient): Promise<OverviewData> {
  const { data, error } = await client.rpc('mod_overview');
  if (error) throw new Error(error.message);
  return Overview.parse(data);
}
