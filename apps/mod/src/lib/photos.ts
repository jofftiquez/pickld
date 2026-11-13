import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const Reply = z.object({
  data: z.object({
    moments: z.array(
      z.object({
        id: z.uuid(),
        full: z.string().nullable(),
        thumb: z.string().nullable(),
        pendingFull: z.string().optional(),
        pendingThumb: z.string().optional(),
      }),
    ),
  }),
});

export interface PhotoPair {
  thumb: string | null;
  full: string | null;
}

/**
 * 15-minute photo URLs for queued moments from fn:photo-urls, which signs them for moderators (M1-16).
 * A proposed replacement is what's being reviewed, so it wins. Empty when the function can't be reached;
 * the queue still works, with placeholders.
 */
export async function photoUrls(client: SupabaseClient, momentIds: string[]): Promise<Map<string, PhotoPair>> {
  const out = new Map<string, PhotoPair>();
  if (momentIds.length === 0) return out;
  const { data, error } = await client.functions.invoke('photo-urls', { body: { momentIds: momentIds.slice(0, 100) } });
  const parsed = Reply.safeParse(data);
  if (error || !parsed.success) return out;
  for (const m of parsed.data.data.moments) {
    out.set(m.id, { thumb: m.pendingThumb ?? m.thumb, full: m.pendingFull ?? m.full });
  }
  return out;
}
