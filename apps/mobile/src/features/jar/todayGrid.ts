// Today grid model (FR-JAR-01, FR-JAR-02). Pure: merges the jar's server moments with the offline
// queue into the 8 tiles of the Today screen, in the fixed slot order.
import type { MomentTileState } from '@/components/MomentTile';
import type { DaySlot } from '@/lib/jars';
import type { Tables } from '@/lib/database.types';
import type { QueueItem } from '@/lib/queue/store';
import { slots, type Slot } from '@/theme/tokens';

/** The moment fields the grid reads, plus a signed thumbnail URL from `fn:photo-urls` (null until known). */
export type ServerMoment = Pick<
  Tables<'moments'>,
  'id' | 'slot' | 'status' | 'is_private' | 'is_backfilled' | 'captured_at' | 'added_at'
> & { thumbUrl: string | null };

export type QueuedMoment = Pick<
  QueueItem,
  'id' | 'slot' | 'state' | 'localDate' | 'photoUri' | 'thumbUri' | 'capturedAt' | 'isPrivate'
>;

export type GridTile = {
  slot: Slot;
  state: MomentTileState;
  uri: string | null;
  /** ISO capture time (or server `added_at`), null for empty and Now tiles. */
  time: string | null;
  isPrivate: boolean;
  addedLater: boolean;
  /** Set when the tile shows a server moment. */
  momentId: string | null;
  /** Set when the tile shows a queued item. */
  queueId: number | null;
  /** A failed queued item: the tile offers Retry (a conflict waits for Replace instead, M2-22). */
  canRetry: boolean;
};

const queueTileState = {
  queued: 'waiting',
  uploading: 'uploading',
  failed: 'failed',
  // Uploaded but the server moment isn't loaded yet: it is being checked (rule 4).
  uploaded: 'checking',
  // The slot already had a server moment; the Replace choice lands with M2-22. Shown as failed only if
  // that moment is gone, so the photo stays reachable.
  conflict: 'failed',
} as const satisfies Record<QueueItem['state'], MomentTileState>;

function emptyTile(slot: Slot, isNow: boolean): GridTile {
  return {
    slot,
    state: isNow ? 'now' : 'empty',
    uri: null,
    time: null,
    isPrivate: false,
    addedLater: false,
    momentId: null,
    queueId: null,
    canRetry: false,
  };
}

/**
 * The 8 tiles in slot order.
 * - A queued, uploading or failed item wins: it is the newest photo for the slot and must stay visible
 *   until it reaches the server (rule 3), even over an older server moment it replaces (FR-JAR-03).
 * - Otherwise the server moment wins (live → filled, checking/uploading → checking). Removed moments
 *   leave the slot empty.
 * - An uploaded queue item whose server moment hasn't loaded yet shows as checking with the local photo.
 * - A conflict item (the slot already had a moment) leaves the server moment showing until Replace (M2-22).
 * - Only queue items for `localDate` (the jar's date) count; the newest item per slot wins.
 * - The Now tile is the current slot (`nowSlot`, from `currentSlot`) when it is still empty.
 */
export function buildTodayGrid(input: {
  localDate: string;
  moments: readonly ServerMoment[];
  queue: readonly QueuedMoment[];
  nowSlot: DaySlot | null;
}): GridTile[] {
  const { localDate, moments, queue, nowSlot } = input;
  return slots.map((slot) => {
    const queued = queue
      .filter((item) => item.slot === slot && item.localDate === localDate)
      .reduce<QueuedMoment | null>((newest, item) => (!newest || item.id > newest.id ? item : newest), null);
    const moment = moments.find((m) => m.slot === slot && m.status !== 'removed') ?? null;

    const settled = queued?.state === 'uploaded' || queued?.state === 'conflict';
    if (queued && (!settled || !moment)) {
      return {
        slot,
        state: queueTileState[queued.state],
        uri: queued.thumbUri ?? queued.photoUri,
        time: queued.capturedAt,
        isPrivate: queued.isPrivate,
        addedLater: false,
        momentId: null,
        queueId: queued.id,
        canRetry: queued.state === 'failed',
      };
    }
    if (moment) {
      return {
        slot,
        state: moment.status === 'live' ? 'filled' : 'checking',
        uri: moment.thumbUrl,
        time: moment.captured_at ?? moment.added_at,
        isPrivate: moment.is_private,
        addedLater: moment.is_backfilled,
        momentId: moment.id,
        queueId: null,
        canRetry: false,
      };
    }
    return emptyTile(slot, slot === nowSlot);
  });
}

/** Tiles holding a photo (server or queued): the "n of 8 moments" count and the jar fill. */
export function momentCount(tiles: readonly GridTile[]): number {
  return tiles.filter((tile) => tile.state !== 'empty' && tile.state !== 'now').length;
}

/**
 * The number in the offline banner ("N moments are saved on your phone and will upload when you're
 * back"), or null when the banner is hidden. Counts the user's queued moments of any date that will
 * upload on their own: waiting and uploading. Failed items need Retry, conflicts need Replace, and
 * uploaded ones are already on the server. Hidden while online and when nothing is waiting.
 */
export function offlineBannerCount(queue: readonly Pick<QueuedMoment, 'state'>[], offline: boolean): number | null {
  if (!offline) return null;
  const saved = queue.filter((item) => item.state === 'queued' || item.state === 'uploading').length;
  return saved > 0 ? saved : null;
}

export type Greeting = 'morning' | 'afternoon' | 'evening';

/** Greeting by time of day, following the Now windows; 00:00–04:59 is still evening. */
export function greetingFor(nowSlot: DaySlot | null): Greeting {
  return nowSlot ?? 'evening';
}
