// Data for /moment/[id] (M2-21; FR-PUB-07, FR-SAF-03): one of the signed-in user's own moments and its
// signed photo URLs. Read as the user, so RLS decides what comes back; the query also asks for
// user_id = me, so another user's moment is "not found" here. A live one opens Moment detail (M3-08)
// through its jar.
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
  jarId: string;
  /** The jar's local date (YYYY-MM-DD), for "#evening · Sat, Nov 7". */
  localDate: string;
  photoUrl: string | null;
  thumbUrl: string | null;
  /** The guideline a removed moment broke (from `my_removal`), or null to say only "our community guidelines". */
  guideline: GuidelineKey | null;
  /** What Request a review can do for a removed moment (M3-24); `none` when nothing can be asked. */
  review: ReviewState;
  /** The removal decision to appeal, or null when there is none to appeal. */
  removalItemId: string | null;
};

/**
 * `available`: no appeal yet and one is allowed. `sent`: an appeal is waiting for a person. `upheld`: a person
 * looked again and kept the removal. `none`: no appeal is possible (an appeal decision, or no removal row).
 */
export type ReviewState = 'available' | 'sent' | 'upheld' | 'none';

export type OwnMomentResult =
  { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'found'; moment: OwnMoment };

const momentRow = z.object({
  id: z.string(),
  slot: z.enum(slots),
  status: z.enum(['uploading', 'checking', 'live', 'removed']),
  jar_id: z.string(),
  jars: z.object({ local_date: z.string() }),
});

const guidelineKeys = [
  'sexual',
  'harassment',
  'violence',
  'hate',
  'spam',
  'under_13',
] as const satisfies readonly GuidelineKey[];
const removalRow = z.object({
  item_id: z.string(),
  guideline: z.enum(guidelineKeys).nullable().catch(null),
  can_appeal: z.boolean(),
  appeal_status: z.string().nullable(),
});

type Removal = { itemId: string | null; guideline: GuidelineKey | null; review: ReviewState };

/** The owner's own removal reason and appeal state (`my_removal`, M3-23). Nothing found means no appeal. */
async function fetchRemoval(momentId: string): Promise<Removal> {
  const { data, error } = await getSupabase().rpc('my_removal', { p_moment: momentId });
  if (error) throw new Error(error.message);
  const row = z.array(removalRow).safeParse(data);
  const first = row.success ? row.data[0] : undefined;
  if (!first) return { itemId: null, guideline: null, review: 'none' };
  const review: ReviewState =
    first.appeal_status === 'open'
      ? 'sent'
      : first.appeal_status === 'upheld'
        ? 'upheld'
        : first.can_appeal
          ? 'available'
          : 'none';
  return { itemId: first.item_id, guideline: first.guideline, review };
}

export type RequestReviewResult = 'sent' | 'alreadySent' | 'error';

/**
 * Request a review (FR-SAF-05): one appeal per removal. The database refuses a second one (unique item and
 * the can_appeal policy); that is reported as `alreadySent`.
 */
export async function requestReview(userId: string, itemId: string, message: string): Promise<RequestReviewResult> {
  const trimmed = message.trim();
  const { error } = await getSupabase()
    .from('appeals')
    .insert({ moderation_item_id: itemId, user_id: userId, message: trimmed === '' ? null : trimmed });
  if (!error) return 'sent';
  // 23505: an appeal for this removal exists. 42501: RLS refused it (no longer appealable).
  return error.code === '23505' || error.code === '42501' ? 'alreadySent' : 'error';
}

/** Longest appeal message (appeals.message check). */
export const APPEAL_MAX = 500;

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
    .select('id, slot, status, jar_id, jars!moments_jar_id_fkey(local_date)')
    .eq('id', momentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = momentRow.safeParse(data);
  if (!row.success) return null;
  const status = row.data.status === 'uploading' ? 'checking' : row.data.status;
  const [{ full, thumb }, removal] = await Promise.all([
    photoUrls(momentId),
    status === 'removed'
      ? fetchRemoval(momentId)
      : Promise.resolve<Removal>({ itemId: null, guideline: null, review: 'none' }),
  ]);
  return {
    id: row.data.id,
    slot: row.data.slot,
    status,
    jarId: row.data.jar_id,
    localDate: row.data.jars.local_date,
    photoUrl: full,
    thumbUrl: thumb,
    guideline: removal.guideline,
    review: removal.review,
    removalItemId: removal.itemId,
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
