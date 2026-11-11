// An uploaded moment opened in the editor from Moment options (M2-23, FR-CAP-10): Edit caption, Edit
// stickers and filters. Read as the owner (RLS); the query also asks for user_id = me, so another user's
// moment or a removed one is "not found". The photo is the signed full-size URL from fn:photo-urls.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { slots, type Slot } from '@/theme/tokens';

import { photoUrls } from './useOwnMoment';

export type EditableMoment = {
  id: string;
  jarId: string;
  slot: Slot;
  /** The live caption and edits: a proposal still waiting for fn:moderate isn't shown (pending_* is the server's). */
  caption: string | null;
  edits: unknown;
  isPrivate: boolean;
  /** ISO capture time (or server added_at). A string, as the query cache is persisted as JSON. */
  shotAt: string;
  /** The jar's IANA zone, for the time label and auto stamps. */
  tz: string;
  photoUrl: string;
};

const row = z.object({
  id: z.string(),
  jar_id: z.string(),
  slot: z.enum(slots),
  status: z.enum(['uploading', 'checking', 'live', 'removed']),
  caption: z.string().nullable(),
  edits: z.unknown(),
  is_private: z.boolean(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  jars: z.object({ tz: z.string() }),
});

export const editableMomentQueryKey = (userId: string, momentId: string) => ['editMoment', userId, momentId] as const;

async function fetchEditableMoment(userId: string, momentId: string): Promise<EditableMoment | null> {
  const { data, error } = await getSupabase()
    .from('moments')
    .select('id, jar_id, slot, status, caption, edits, is_private, captured_at, added_at, jars(tz)')
    .eq('id', momentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const parsed = row.safeParse(data);
  if (!parsed.success || parsed.data.status === 'removed') return null;
  const { full } = await photoUrls(momentId);
  if (full === null) throw new Error('no photo URL');
  const m = parsed.data;
  return {
    id: m.id,
    jarId: m.jar_id,
    slot: m.slot,
    caption: m.caption,
    edits: m.edits,
    isPrivate: m.is_private,
    shotAt: m.captured_at ?? m.added_at,
    tz: m.jars.tz,
    photoUrl: full,
  };
}

export function useEditableMoment(momentId: string | null): {
  userId: string | null;
  moment: EditableMoment | null | undefined;
  isError: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: editableMomentQueryKey(userId ?? '', momentId ?? ''),
    queryFn: () => fetchEditableMoment(userId ?? '', momentId ?? ''),
    enabled: userId !== null && momentId !== null,
    staleTime: 0,
    gcTime: 0,
  });
  // The editor reads its starting point once, so it waits for this opening's fetch: a cached copy could be
  // from before the last edit, and its signed photo URL may have expired.
  return { userId, moment: query.isFetchedAfterMount ? query.data : undefined, isError: query.isError };
}
