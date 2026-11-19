// Not published (FR-DAY-02, FR-PUB-01): the owner's past days from the last week that hold moments but were
// neither published nor kept to themselves (0169 `kept_at`). Days older than a week leave the list on their
// own, so it never piles up for someone who keeps their days private; their day page still has Publish.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { addDays, isJarOpen } from '@/lib/jars';

/** How many days back the list reaches: yesterday through a week ago. */
export const UNPUBLISHED_WINDOW_DAYS = 7;

export type UnpublishedJar = {
  id: string;
  localDate: string;
  momentCount: number;
  coverMomentId: string | null;
  coverUrl: string | null;
};

export type UnpublishedRow = {
  id: string;
  local_date: string;
  tz: string;
  ends_at: string | null;
  moment_count: number;
  resolved_cover_id: string | null;
};

/** The first date the list reads from the server; `pickUnpublished` makes the exact cut. */
export function unpublishedFrom(today: string): string {
  return addDays(today, -UNPUBLISHED_WINDOW_DAYS);
}

/**
 * The rows that belong in the list, newest day first: their day has ended in the jar's own zone (an open jar
 * is still Today's, travel rule) and they're no older than a week before `today` (the phone's date).
 */
export function pickUnpublished(rows: readonly UnpublishedRow[], now: Date, today: string): UnpublishedRow[] {
  const from = unpublishedFrom(today);
  return rows
    .filter((row) => row.moment_count > 0 && row.local_date >= from && !isJarOpen(row, now))
    .sort((a, b) => (a.local_date < b.local_date ? 1 : a.local_date > b.local_date ? -1 : 0));
}

/** Keeps the owner's jars to themselves: one update; the server stamps kept_at and RLS limits it to their own. */
export async function keepJars(
  client: Pick<SupabaseClient<Database>, 'from'>,
  jarIds: readonly string[],
): Promise<void> {
  if (jarIds.length === 0) return;
  const { error } = await client
    .from('jars')
    .update({ kept_at: new Date().toISOString() })
    .in('id', [...jarIds]);
  if (error) throw new Error(error.message);
}
