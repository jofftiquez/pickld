// Camera or gallery photo → offline queue (FR-CAP-01, FR-CAP-02; AGENTS rules 3, 5, 6, 7). A photo is queued
// raw with its slot, jar date and zone (and the Crop screen's choices for a gallery photo), then prepared
// (crop to 3:4, WebP without location) and handed to the upload worker. It is queued held for the editor
// (M2-12), which opens next: the upload waits until the editor saves or closes.
import { File } from 'expo-file-system';

import { captureInfo } from '@/lib/image/captureTime';
import type { CropSpec } from '@/lib/image/crop';
import { flipPhoto } from '@/lib/image/pipeline';
import { chooseJar, localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { prepareItem } from '@/lib/queue/prepare';
import { requestUploads } from '@/lib/queue/runner';
import { enqueue, type QueueItem } from '@/lib/queue/store';
import type { Slot } from '@/theme/tokens';

import type { FillTarget } from './fillTarget';

export type OpenJar = { id: string; localDate: string; tz: string };

export type SaveCaptureInput = {
  /** The camera's photo file (deleted once queued). */
  uri: string;
  slot: Slot;
  userId: string;
  /** The phone's IANA zone (rule 7). */
  tz: string;
  /** When the shutter was pressed. Only the capture time; the server decides "Added later" (rule 6). */
  shotAt: Date;
  /** The open jar from Today, if known: a moment joins it even after a zone change (travel rule). */
  openJar: OpenJar | null;
  /** Fill this jar: queue under this past date and zone instead of the open jar (FR-DAY-02). */
  fill?: FillTarget | null;
  /** The slot is filled and the user chose Replace (M2-22): upload as a replacement of its moment. */
  replace?: boolean;
  /** Mirror selfies is off and this is a front-camera photo (D-66): flip it left to right first. */
  flip?: boolean;
};

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file wastes space but loses nothing.
  }
}

/**
 * The jar date and zone a camera photo is queued under: the open jar's, else today's in the phone zone.
 * Joining the open jar keeps that jar's zone: after flying west its date can be ahead of the phone's, and
 * ensure_jar refuses a date that is still in the future in the zone it is given.
 */
export function captureJarDate(input: { tz: string; shotAt: Date; openJar: OpenJar | null }): {
  localDate: string;
  tz: string;
  capturedAt: string;
} {
  const { tz, shotAt, openJar } = input;
  // A camera photo has no EXIF time to trust here: it was taken now.
  const info = captureInfo(null, tz, shotAt);
  const jars = openJar ? [{ id: openJar.id, local_date: openJar.localDate, tz: openJar.tz }] : [];
  // No targetDate: a photo taken now joins the open jar even when the phone's date differs (travel rule).
  const decision = chooseJar({ jars, phoneTz: tz, now: shotAt });
  if (decision.action === 'use')
    return { localDate: decision.jar.local_date, tz: decision.jar.tz, capturedAt: info.capturedAt };
  return {
    localDate: decision.action === 'create' ? decision.localDate : decision.jar.local_date,
    tz: decision.tz,
    capturedAt: info.capturedAt,
  };
}

/**
 * The queue row's jar date and zone. Fill this jar uses its past date and that jar's zone (the server sets
 * is_backfilled); a normal capture goes through `captureJarDate`.
 */
export function queueTarget(input: Pick<SaveCaptureInput, 'tz' | 'shotAt' | 'openJar' | 'fill'>): {
  localDate: string;
  tz: string;
  capturedAt: string;
} {
  const target = captureJarDate(input);
  return input.fill ? { localDate: input.fill.localDate, tz: input.fill.tz, capturedAt: target.capturedAt } : target;
}

export type QueueTarget = ReturnType<typeof queueTarget>;

/**
 * The queue row's jar date and zone for a gallery photo (FR-CAP-02; AGENTS "Which jar" point 3). Its capture
 * time comes from its EXIF (`captureInfo`). Fill this jar wins: the photo goes to that past date. Otherwise a
 * photo taken on an earlier day than today in the phone zone goes to that day's jar, in the phone zone
 * (ensure_jar returns an existing jar for that date unchanged; the server sets is_backfilled). A photo from
 * today, from the future (a wrong camera clock) or without an EXIF time joins the open jar exactly as a
 * camera photo would (`captureJarDate`, travel rule): comparing with the phone's today rather than the open
 * jar's date keeps a photo taken today after flying west out of yesterday's jar.
 */
export function galleryTarget(input: {
  exif: unknown;
  tz: string;
  now: Date;
  openJar: OpenJar | null;
  fill?: FillTarget | null;
}): QueueTarget {
  const { exif, tz, now, openJar, fill } = input;
  const info = captureInfo(exif, tz, now);
  if (fill) return { localDate: fill.localDate, tz: fill.tz, capturedAt: info.capturedAt };
  if (info.localDate < localDateIn(now, tz)) return { localDate: info.localDate, tz, capturedAt: info.capturedAt };
  return { ...captureJarDate({ tz, shotAt: now, openJar }), capturedAt: info.capturedAt };
}

/** Copies the raw photo into the queue (one file copy and one SQLite row), then prepares it in the
 * background and wakes the upload worker. */
async function queueRaw(
  uri: string,
  row: { userId: string; slot: Slot; target: QueueTarget; crop: CropSpec | null; replace?: boolean },
): Promise<QueueItem> {
  const item = await enqueue({
    userId: row.userId,
    photoUri: uri,
    thumbUri: null,
    slot: row.slot,
    ...row.target,
    prepared: false,
    editing: true,
    ...(row.crop ? { crop: row.crop } : null),
    replace: row.replace ?? false,
  });
  // The queue holds its own copy now.
  deleteQuietly(uri);
  void prepareItem(item)
    .catch((error: unknown) => captureError(error, { area: 'capture' }))
    .finally(() => void requestUploads());
  return item;
}

/** The photo flipped left to right, the original deleted; if flipping fails, the original as it is, so the
 * photo is still queued (rule 3). */
async function flippedOrOriginal(uri: string): Promise<string> {
  try {
    const flipped = await flipPhoto(uri);
    deleteQuietly(uri);
    return flipped;
  } catch (error) {
    captureError(error, { area: 'capture' });
    return uri;
  }
}

/**
 * Queues the raw camera photo at once (a file copy and one SQLite row, so a photo is never lost if the app
 * is killed right after the shutter: rule 3), then prepares it in the background and kicks the upload
 * worker. Resolves as soon as the raw photo is queued; never waits for preparation or the network. If the
 * background preparation is interrupted, the upload worker prepares the item before uploading it.
 * With `flip`, the file is mirrored before it is queued, so the queued photo, the editor, the upload and an
 * offline retry all see the same picture.
 */
export async function saveCapture(input: SaveCaptureInput): Promise<QueueItem> {
  const uri = input.flip ? await flippedOrOriginal(input.uri) : input.uri;
  return queueRaw(uri, {
    userId: input.userId,
    slot: input.slot,
    target: queueTarget(input),
    crop: null,
    replace: input.replace,
  });
}

export type SaveGalleryPhotoInput = {
  /** The picked photo's local file (deleted once queued). */
  uri: string;
  slot: Slot;
  userId: string;
  /** From `galleryTarget`. */
  target: QueueTarget;
  /** The Crop screen's choices; null for an exactly 3:4 photo that skipped it. */
  crop: CropSpec | null;
};

/**
 * Queues a gallery photo the same way as a camera photo (rule 3): the raw file goes into the queue before
 * anything else, with the crop stored so preparation applies it; it cannot upload before it is prepared.
 * Resolves once queued.
 */
export async function saveGalleryPhoto(input: SaveGalleryPhotoInput): Promise<QueueItem> {
  return queueRaw(input.uri, input);
}
