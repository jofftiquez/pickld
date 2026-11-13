// Today grid model (FR-JAR-01, FR-JAR-02). Pure: merges the jar's server moments with the offline
// queue into the 8 tiles of the Today screen, in the fixed slot order.
import type { MomentTileState } from '@/components/MomentTile';
import { DEFAULT_EDITS, parseEdits, type Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import type { DaySlot } from '@/lib/jars';
import type { Tables } from '@/lib/database.types';
import type { QueueItem } from '@/lib/queue/store';
import type { Visibility } from '@/lib/visibility';
import { slots, type Slot } from '@/theme/tokens';

/** The moment fields the grid reads, plus a signed thumbnail URL from `fn:photo-urls` (null until known). */
export type ServerMoment = Pick<
  Tables<'moments'>,
  'id' | 'slot' | 'status' | 'visibility' | 'is_backfilled' | 'captured_at' | 'added_at'
> &
  // `edits` is optional: caches persisted before M2-18 lack it; `replaces` (0013): caches from before M2-22.
  Partial<Pick<Tables<'moments'>, 'edits' | 'replaces'>> & { thumbUrl: string | null };

export type QueuedMoment = Pick<
  QueueItem,
  'id' | 'slot' | 'state' | 'localDate' | 'photoUri' | 'thumbUri' | 'capturedAt' | 'visibility'
> &
  // What the tile needs to draw the edits (M2-18); optional so callers that don't draw them can leave them out.
  Partial<Pick<QueueItem, 'tz' | 'createdAt' | 'edits' | 'replace'>>;

export type GridTile = {
  slot: Slot;
  state: MomentTileState;
  uri: string | null;
  /** ISO capture time (or server `added_at`), null for empty and Now tiles. */
  time: string | null;
  /** Who can see the moment (D-48); null for empty and Now tiles, and for a queued photo left at the owner's default. */
  visibility: Visibility | null;
  addedLater: boolean;
  /** Set when the tile shows a server moment. */
  momentId: string | null;
  /** Set when the tile shows a queued item. */
  queueId: number | null;
  /** A failed queued item: the tile offers Retry (a conflict waits for Replace instead, M2-22). */
  canRetry: boolean;
  /** The moment's filter and overlays (FR-CAP-08), drawn over the photo; the plain photo when none. */
  edits: Edits;
  /** What its auto stamps show: capture time in the jar's zone. Null for empty, Now and removed tiles. */
  stamp: StampMoment | null;
};

const queueTileState = {
  queued: 'waiting',
  uploading: 'uploading',
  failed: 'failed',
  // Uploaded but the server moment isn't loaded yet: it is being checked (rule 4).
  uploaded: 'checking',
  // The slot already had a server moment: Today asks whether to Replace it (M2-22). Shown as failed only
  // if that moment is gone, so the photo stays reachable.
  conflict: 'failed',
} as const satisfies Record<QueueItem['state'], MomentTileState>;

/** A queued photo's auto stamps, as the editor shows them: its capture time, or when it was queued. */
function queueStamp({ capturedAt, createdAt, tz }: QueuedMoment): StampMoment | null {
  const at = capturedAt !== null ? new Date(capturedAt) : createdAt !== undefined ? new Date(createdAt) : null;
  return at !== null && tz !== undefined ? { capturedAt: at, tz } : null;
}

function emptyTile(slot: Slot, isNow: boolean): GridTile {
  return {
    slot,
    state: isNow ? 'now' : 'empty',
    uri: null,
    time: null,
    visibility: null,
    addedLater: false,
    momentId: null,
    queueId: null,
    canRetry: false,
    edits: DEFAULT_EDITS,
    stamp: null,
  };
}

/**
 * The 8 tiles in slot order.
 * - A queued, uploading or failed item wins: it is the newest photo for the slot and must stay visible
 *   until it reaches the server (rule 3), even over an older server moment it replaces (FR-JAR-03).
 * - Otherwise the server moment wins (live → filled, checking/uploading → checking).
 * - A removed moment shows as removed (it opens the notice, FR-PUB-07) but doesn't hold the slot: a new
 *   queued photo for the slot wins over it, it isn't counted, and the camera may fill the slot again
 *   (D-27: the server's one-moment-per-slot index ignores removed moments, 0013).
 * - An uploaded queue item whose server moment hasn't loaded yet shows as checking with the local photo.
 * - A conflict item (the slot already had a moment) leaves the server moment showing until Replace (M2-22).
 * - Replace keeps the old photo until the new one is live (FR-JAR-03): a replacement queue item that hasn't
 *   failed leaves the server moment showing, and a server moment with `replaces` set (uploaded, waiting
 *   for fn:moderate) never shows; when fn:moderate approves it the old moment is gone and it holds the slot.
 * - Only queue items for `localDate` (the jar's date) count; the newest item per slot wins.
 * - The Now tile is the current slot (`nowSlot`, from `currentSlot`) when it is still empty.
 */
export function buildTodayGrid(input: {
  localDate: string;
  moments: readonly ServerMoment[];
  queue: readonly QueuedMoment[];
  nowSlot: DaySlot | null;
  /** The open jar's IANA zone, for the auto stamps of its server moments (null before the jar exists). */
  jarTz?: string | null;
}): GridTile[] {
  const { localDate, moments, queue, nowSlot, jarTz = null } = input;
  return slots.map((slot) => {
    const queued = queue
      .filter((item) => item.slot === slot && item.localDate === localDate)
      .reduce<QueuedMoment | null>((newest, item) => (!newest || item.id > newest.id ? item : newest), null);
    const moment = moments.find((m) => m.slot === slot && m.status !== 'removed' && !m.replaces) ?? null;
    const removed = moments.find((m) => m.slot === slot && m.status === 'removed') ?? null;

    const settled =
      queued?.state === 'uploaded' ||
      queued?.state === 'conflict' ||
      (queued?.replace === true && queued.state !== 'failed');
    if (queued && (!settled || !moment)) {
      return {
        slot,
        state: queueTileState[queued.state],
        uri: queued.thumbUri ?? queued.photoUri,
        time: queued.capturedAt,
        visibility: queued.visibility,
        addedLater: false,
        momentId: null,
        queueId: queued.id,
        canRetry: queued.state === 'failed',
        edits: parseEdits(queued.edits),
        // As the editor shows them: the capture time, or when it was queued if the photo had none.
        stamp: queueStamp(queued),
      };
    }
    if (moment) {
      return {
        slot,
        state: moment.status === 'live' ? 'filled' : 'checking',
        uri: moment.thumbUrl,
        time: moment.captured_at ?? moment.added_at,
        visibility: moment.visibility,
        addedLater: moment.is_backfilled,
        momentId: moment.id,
        queueId: null,
        canRetry: false,
        edits: parseEdits(moment.edits),
        stamp: jarTz === null ? null : { capturedAt: new Date(moment.captured_at ?? moment.added_at), tz: jarTz },
      };
    }
    if (removed) {
      return { ...emptyTile(slot, false), state: 'removed', uri: removed.thumbUrl, momentId: removed.id };
    }
    return emptyTile(slot, slot === nowSlot);
  });
}

/** Whether a tile holds the slot (server or queued photo); empty, Now and removed tiles leave it free. */
export function holdsSlot(tile: Pick<GridTile, 'state'>): boolean {
  return tile.state !== 'empty' && tile.state !== 'now' && tile.state !== 'removed';
}

/** Tiles holding a photo (server or queued): the "n of 8 moments" count and the jar fill. Removed
 * moments don't count, like the server's moment_count (D-9). */
export function momentCount(tiles: readonly GridTile[]): number {
  return tiles.filter(holdsSlot).length;
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
