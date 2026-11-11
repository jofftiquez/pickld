// Data for /moment/[id] (M2-21; FR-PUB-07, FR-SAF-03): one of the signed-in user's own moments and its
// signed photo URLs. Read as the user, so RLS decides what comes back; the query also asks for
// user_id = me, so another user's live moment is "not found" here (its detail view is M3-08).
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import type { Enums } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';
import { slots, type Slot } from '@/theme/tokens';

/** The route param: a moment id. Anything else is shown as not found without a request. */
export const momentIdParam = z.uuid();

/** Report reasons double as the guideline names shown on the removed notice (product.md, Report). */
export type GuidelineKey = Exclude<Enums<'report_reason'>, 'other'>;

export type OwnMoment = {
  id: string;
  slot: Slot;
  /** `uploading` on the server is shown like `checking`: neither has been approved yet. */
  status: 'checking' | 'live' | 'removed';
  /** The jar's local date (YYYY-MM-DD), for "#evening · Sat, Nov 7". */
  localDate: string;
  photoUrl: string | null;
  thumbUrl: string | null;
  /**
   * The guideline a removed moment broke, or null to say only "our community guidelines".
   * TODO(M3-23): always null for now. The reason is moderation_items.decision_reason, which only
   * moderators can read (RLS), and fn:moderate's auto-approve never removes. mod-action (M3-23) has to
   * expose the owner's own removal reason before this can be filled in.
   */
  guideline: GuidelineKey | null;
};

export type OwnMomentResult =
  { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'found'; moment: OwnMoment };

const momentRow = z.object({
  id: z.string(),
  slot: z.enum(slots),
  status: z.enum(['uploading', 'checking', 'live', 'removed']),
  jars: z.object({ local_date: z.string() }),
});

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(z.object({ id: z.string(), full: z.string().nullable(), thumb: z.string().nullable() })),
  }),
});

/** Photo URLs from `fn:photo-urls`; a failure leaves the placeholder instead of failing the screen. */
export async function photoUrls(momentId: string): Promise<{ full: string | null; thumb: string | null }> {
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', {
    body: { momentIds: [momentId] },
  });
  const parsed = photoUrlsResponse.safeParse(data);
  const urls = !error && parsed.success ? parsed.data.data.moments.find((m) => m.id === momentId) : undefined;
  return { full: urls?.full ?? null, thumb: urls?.thumb ?? null };
}

async function fetchOwnMoment(userId: string, momentId: string): Promise<OwnMoment | null> {
  const { data, error } = await getSupabase()
    .from('moments')
    .select('id, slot, status, jars(local_date)')
    .eq('id', momentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = momentRow.safeParse(data);
  if (!row.success) return null;
  const { full, thumb } = await photoUrls(momentId);
  return {
    id: row.data.id,
    slot: row.data.slot,
    status: row.data.status === 'uploading' ? 'checking' : row.data.status,
    localDate: row.data.jars.local_date,
    photoUrl: full,
    thumbUrl: thumb,
    guideline: null,
  };
}

/** Checking moments are polled so the screen moves on once moderation decides (most within 10 s). */
export const CHECKING_POLL_MS = 5_000;

export function useOwnMoment(rawId: unknown): OwnMomentResult {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const id = momentIdParam.safeParse(rawId);
  const momentId = id.success ? id.data.toLowerCase() : null;
  const query = useQuery({
    queryKey: ['moment', userId ?? '', momentId ?? ''],
    queryFn: () => fetchOwnMoment(userId ?? '', momentId ?? ''),
    enabled: userId !== null && momentId !== null,
    refetchInterval: (q) => (q.state.data?.status === 'checking' ? CHECKING_POLL_MS : false),
  });
  if (momentId === null) return { kind: 'notFound' };
  if (query.data) return { kind: 'found', moment: query.data };
  if (query.data === null) return { kind: 'notFound' };
  if (query.isError) return { kind: 'error' };
  return { kind: 'loading' };
}
