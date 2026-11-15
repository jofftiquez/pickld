// Pending uploads (FR-CAP-04, NFR-OFF-01): every moment still on the phone, across all days, from the local
// queue. Pure, so the page, its entry badges and the tests read the same rules.
import { isHeldForEditing, type QueueItem } from '@/lib/queue/store';
import { slots, type Slot } from '@/theme/tokens';

/**
 * Where a moment on the phone stands. `draft`: saved unfinished, never uploads until it is finished;
 * `waiting`: will upload on its own (offline, or between retries); `uploading`; `failed`: Didn't upload, needs
 * Retry; `conflict`: its slot already had a moment on the server.
 */
export type PendingStatus = 'draft' | 'waiting' | 'uploading' | 'failed' | 'conflict';

export type PendingItem = Pick<
  QueueItem,
  'id' | 'slot' | 'localDate' | 'tz' | 'photoUri' | 'thumbUri' | 'state' | 'draft' | 'editingSince'
>;

export type PendingRow = { id: number; slot: Slot; localDate: string; tz: string; uri: string; status: PendingStatus };
export type PendingDay = { localDate: string; tz: string; rows: PendingRow[] };

/** Null once uploaded: the row only waits to be cleared, so it isn't pending. */
export function pendingStatus(item: PendingItem): PendingStatus | null {
  // A photo still held by the editor is unfinished like a draft (it becomes one at the next launch).
  if (isHeldForEditing(item)) return 'draft';
  switch (item.state) {
    case 'queued':
      return 'waiting';
    case 'uploading':
      return 'uploading';
    case 'failed':
      return 'failed';
    case 'conflict':
      return 'conflict';
    case 'uploaded':
      return null;
  }
}

/** How many moments are pending, for the entry badges. */
export function pendingCount(queue: readonly PendingItem[]): number {
  return queue.filter((item) => pendingStatus(item) !== null).length;
}

/** Pending moments grouped by day, newest day first, each day's rows in slot order. */
export function groupPending(queue: readonly PendingItem[]): PendingDay[] {
  const days = new Map<string, PendingDay>();
  for (const item of queue) {
    const status = pendingStatus(item);
    if (status === null) continue;
    const day = days.get(item.localDate) ?? { localDate: item.localDate, tz: item.tz, rows: [] };
    day.rows.push({
      id: item.id,
      slot: item.slot,
      localDate: item.localDate,
      tz: item.tz,
      uri: item.thumbUri ?? item.photoUri,
      status,
    });
    days.set(item.localDate, day);
  }
  return [...days.values()]
    .sort((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0))
    .map((day) => ({
      ...day,
      rows: day.rows.sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot) || a.id - b.id),
    }));
}
