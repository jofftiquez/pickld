// Moment preview model (QA item 3, D-54; FR-JAR-02). Pure: turns Today's tiles, the offline queue and the
// jar page (when loaded) into the moments the preview swipes through, in slot order, and says which actions
// each one offers.
import type { Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import { buildJarPage, isLiked, type JarPageData } from '@/features/jar/jarPage';
import type { GridTile, QueuedMoment } from '@/features/jar/todayGrid';
import type { Visibility } from '@/lib/visibility';
import { slots, type Slot } from '@/theme/tokens';

import type { MomentTarget } from './momentActions';

export type PreviewItem = {
  /** Stable across refreshes: the moment id, or `queue:<id>` for a photo still on the phone. */
  key: string;
  slot: Slot;
  /** `live`: an approved moment on the server. `queued`: a photo on the phone that hasn't uploaded yet. */
  kind: 'live' | 'queued';
  /** A queued photo uploading right now: shown, but nothing may change it until it lands. */
  uploading: boolean;
  /** The Today tile, for Moment options. */
  tile: GridTile;
  target: MomentTarget;
  /** The full photo when known (the jar page's signed URL, or the queued local file), else the thumbnail. */
  uri: string | null;
  edits: Edits;
  stamp: StampMoment | null;
  /** ISO capture time (or server `added_at`). */
  time: string | null;
  visibility: Visibility;
  caption: string | null;
  addedLater: boolean;
  /** Like and comment counts of a live moment (its own thread, D-69) once the jar page has loaded; null otherwise. */
  likeCount: number | null;
  liked: boolean;
  commentCount: number | null;
  /** The jar's cover as the jar page shows it (D-56); false until the jar page has loaded. */
  isCover: boolean;
};

/** Tiles the preview opens on and swipes through: the owner's live moments and photos still on the phone. */
export function opensPreview(tile: Pick<GridTile, 'state' | 'momentId' | 'queueId'>): boolean {
  if (tile.queueId !== null) return tile.state === 'waiting' || tile.state === 'failed';
  return tile.state === 'filled' && tile.momentId !== null;
}

/**
 * The moments to swipe through, in slot order. Checking, removed, empty and Now tiles are left out (checking
 * and removed keep their own screens). An uploading photo stays in the list so it doesn't vanish under the
 * thumb when the phone comes back online, but it offers no actions.
 */
export function buildPreviewItems(input: {
  tiles: readonly GridTile[];
  queue: readonly QueuedMoment[];
  jarId: string | null;
  /** Today's jar read through the jar page (signed full photos, captions, likes); null or undefined until loaded. */
  page?: JarPageData | null;
  /** Shown for a queued photo left at the owner's default. */
  defaultVisibility?: Visibility;
}): PreviewItem[] {
  const { tiles, queue, jarId, page = null, defaultVisibility = 'readers' } = input;
  const items: PreviewItem[] = [];
  const coverId = page ? (buildJarPage(page).cover?.id ?? null) : null;
  for (const tile of tiles) {
    const base = {
      slot: tile.slot,
      tile,
      edits: tile.edits,
      stamp: tile.stamp,
      time: tile.time,
      visibility: tile.visibility ?? defaultVisibility,
      addedLater: tile.addedLater,
    };
    if (tile.queueId !== null && (opensPreview(tile) || tile.state === 'uploading')) {
      const queued = queue.find((q) => q.id === tile.queueId);
      items.push({
        ...base,
        key: `queue:${tile.queueId}`,
        kind: 'queued',
        uploading: tile.state === 'uploading',
        target: { kind: 'queued', queueId: tile.queueId },
        // The prepared full photo; a raw capture not cropped yet shows like its tile does.
        uri: queued && queued.prepared !== false ? queued.photoUri : tile.uri,
        caption: queued?.caption?.trim() ? queued.caption.trim() : null,
        likeCount: null,
        liked: false,
        commentCount: null,
        isCover: false,
      });
    } else if (tile.momentId !== null && jarId !== null && opensPreview(tile)) {
      const momentId = tile.momentId;
      const loaded = page?.moments.find((m) => m.id === momentId);
      items.push({
        ...base,
        key: momentId,
        kind: 'live',
        uploading: false,
        target: { kind: 'server', momentId, jarId },
        uri: loaded?.fullUrl ?? tile.uri,
        caption: loaded?.caption?.trim() ? loaded.caption.trim() : null,
        likeCount: loaded ? loaded.like_count : null,
        liked: page && loaded ? isLiked(page, { kind: 'moment', id: momentId }) : false,
        commentCount: loaded ? (loaded.comment_count ?? 0) : null,
        isCover: momentId === coverId,
      });
    }
  }
  return items;
}

export type PreviewAction = 'edit' | 'share' | 'visibility' | 'cover' | 'more' | 'delete';

/** Set as cover (D-56) is offered (in the bar, D-98, and under More) for a live moment that isn't the cover already. */
export function canSetCover(item: Pick<PreviewItem, 'kind' | 'isCover'>): boolean {
  return item.kind === 'live' && !item.isCover;
}

/**
 * The action bar (D-54): a live moment has Edit, Share, Visibility, Set as cover (D-98; a "Cover" state
 * when it is the cover already) and More (Re-crop, Move, Set as cover, Delete). A photo still on the phone
 * has only Edit and Delete; while it uploads it has none.
 */
export function previewActions(item: Pick<PreviewItem, 'kind' | 'uploading'>): PreviewAction[] {
  if (item.kind === 'live') return ['edit', 'share', 'visibility', 'cover', 'more'];
  return item.uploading ? [] : ['edit', 'delete'];
}

/** Only a live moment that isn't Only me can leave its owner (rule 9, D-48); Share is shown but disabled otherwise. */
export function canShare(item: Pick<PreviewItem, 'kind' | 'visibility'>): boolean {
  return item.kind === 'live' && item.visibility !== 'only_me';
}

/**
 * Which item to show after the list changed (a move, a delete, an upload): the same moment if it's still
 * there, else the one now in its slot, else the next one in slot order, else the last. -1 when empty.
 */
export function resolveIndex(items: readonly Pick<PreviewItem, 'key' | 'slot'>[], key: string, slot: Slot): number {
  if (items.length === 0) return -1;
  const same = items.findIndex((item) => item.key === key);
  if (same !== -1) return same;
  const inSlot = items.findIndex((item) => item.slot === slot);
  if (inSlot !== -1) return inSlot;
  const after = items.findIndex((item) => slots.indexOf(item.slot) > slots.indexOf(slot));
  return after === -1 ? items.length - 1 : after;
}
