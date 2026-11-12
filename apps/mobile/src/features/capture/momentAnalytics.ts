// `moment_added` and `first_moment` (NFR-ANL-01; AGENTS rules 9 and 10). A new moment is added when the
// editor that opens after capture is left (Add to #slot, or closed as it is): only then is its privacy
// known. Private moments send nothing at all; a Replace is not a new moment. Slot, privacy and the
// backfill flag are the only properties: never the photo, caption, ids or dates.
import Storage from 'expo-sqlite/kv-store';

import { track } from '@/lib/analytics';
import { localDateIn } from '@/lib/jars';
import { listQueue, type QueueItem } from '@/lib/queue/store';
import { getSupabase } from '@/lib/supabase';

type AddedItem = Pick<QueueItem, 'id' | 'userId' | 'slot' | 'localDate' | 'tz' | 'replace'>;

const decidedKey = (userId: string) => `firstMomentDecided:${userId}`;

/**
 * Whether this is the account's very first moment: the server has no moment of theirs (any status or
 * privacy) and nothing else is waiting in this phone's queue. Asked once per account on this phone; the
 * answer is kept, so later moments never ask again. Throws when it can't tell (offline), so the next
 * moment asks instead.
 */
async function isFirstMoment(item: AddedItem): Promise<boolean> {
  if ((await Storage.getItem(decidedKey(item.userId))) !== null) return false;
  const othersQueued = (await listQueue(item.userId)).some((queued) => queued.id !== item.id);
  const { count, error } = await getSupabase()
    .from('moments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', item.userId);
  if (error || count === null) throw new Error(error?.message ?? 'no moment count');
  await Storage.setItem(decidedKey(item.userId), new Date().toISOString());
  return !othersQueued && count === 0;
}

/** Sends the events for a moment the user just added. Never throws: analytics can't break capture. */
export async function trackMomentAdded(item: AddedItem, isPrivate: boolean, now: Date = new Date()): Promise<void> {
  if (item.replace) return;
  // Decided for private moments too, so a public second moment isn't taken for the first.
  const first = await isFirstMoment(item).catch(() => false);
  if (isPrivate) return;
  // The server sets is_backfilled; a moment queued under a date already past in its zone is one.
  const props = { slot: item.slot, is_private: false, backfilled: item.localDate < localDateIn(now, item.tz) } as const;
  if (first) track('first_moment', props);
  track('moment_added', props);
}
