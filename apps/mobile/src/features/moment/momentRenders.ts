// What a moment preview needs to draw its edits (QA round 3 item 3, D-96): the stored edits, the capture
// time and the jar's zone for auto stamps. Timeline cards, Explore and Memories get moment ids and signed
// thumbnails only, so they read these from `moments` as the viewer: RLS decides, and a moment the viewer
// can't read (or a failed read) keeps its plain thumbnail. Raw rows, so the persisted query cache holds them.
import { z } from 'zod';

import { parseEdits, type Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import { getSupabase } from '@/lib/supabase';

import { hasVisibleEdits } from './momentRender';

/** One batch per request, like fn:photo-urls. */
const BATCH = 100;

export const momentRenderRow = z.object({
  edits: z.unknown(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  /** The jar's IANA zone; null when the viewer can't read the jar row (stamps then show their art). */
  tz: z.string().nullable(),
});
export type MomentRenderRow = z.infer<typeof momentRenderRow>;

const fetchedRow = z.object({
  id: z.string(),
  edits: z.unknown(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  jars: z.object({ tz: z.string() }).nullable(),
});

/** Edits rows for `momentIds`, read in batches with `.in('id', …)`; a failed batch leaves its moments plain. */
export async function fetchMomentRenders(momentIds: readonly string[]): Promise<Map<string, MomentRenderRow>> {
  const ids = [...new Set(momentIds)];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const { data, error } = await getSupabase()
          .from('moments')
          .select('id, edits, captured_at, added_at, jars(tz)')
          .in('id', batch);
        const parsed = z.array(fetchedRow).safeParse(data);
        return error || !parsed.success ? [] : parsed.data;
      } catch {
        return [];
      }
    }),
  );
  return new Map(
    results
      .flat()
      .map((r) => [r.id, { edits: r.edits, captured_at: r.captured_at, added_at: r.added_at, tz: r.jars?.tz ?? null }]),
  );
}

/** The edits and stamp to draw, or null when the row is missing or its edits leave the photo plain. */
export function momentRender(
  row: MomentRenderRow | null | undefined,
): { edits: Edits; stamp: StampMoment | null } | null {
  if (!row) return null;
  const edits = parseEdits(row.edits);
  if (!hasVisibleEdits(edits)) return null;
  const stamp = row.tz === null ? null : { capturedAt: new Date(row.captured_at ?? row.added_at), tz: row.tz };
  return { edits, stamp };
}
