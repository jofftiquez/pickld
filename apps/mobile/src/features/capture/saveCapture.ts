// Camera photo → offline queue (FR-CAP-01; AGENTS rules 3, 5, 6, 7). Until the editor exists (M2-11) a
// camera photo goes straight to the queue: queued raw with its slot, jar date and phone zone, then
// prepared (crop to 3:4, WebP without location) and handed to the upload worker.
import { File } from 'expo-file-system';

import { captureInfo } from '@/lib/image/captureTime';
import { chooseJar } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { prepareItem } from '@/lib/queue/prepare';
import { requestUploads } from '@/lib/queue/runner';
import { enqueue, type QueueItem } from '@/lib/queue/store';
import type { Slot } from '@/theme/tokens';

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
};

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file wastes space but loses nothing.
  }
}

/** The jar date a camera photo is queued under: the open jar's, else today's in the phone zone. */
export function captureJarDate(input: { tz: string; shotAt: Date; openJar: OpenJar | null }): {
  localDate: string;
  capturedAt: string;
} {
  const { tz, shotAt, openJar } = input;
  // A camera photo has no EXIF time to trust here: it was taken now.
  const info = captureInfo(null, tz, shotAt);
  const jars = openJar ? [{ id: openJar.id, local_date: openJar.localDate, tz: openJar.tz }] : [];
  // No targetDate: a photo taken now joins the open jar even when the phone's date differs (travel rule).
  const decision = chooseJar({ jars, phoneTz: tz, now: shotAt });
  return {
    localDate: decision.action === 'create' ? decision.localDate : decision.jar.local_date,
    capturedAt: info.capturedAt,
  };
}

/**
 * Queues the raw camera photo at once (a file copy and one SQLite row, so a photo is never lost if the app
 * is killed right after the shutter: rule 3), then prepares it in the background and kicks the upload
 * worker. Resolves as soon as the raw photo is queued; never waits for preparation or the network. If the
 * background preparation is interrupted, the upload worker prepares the item before uploading it.
 */
export async function saveCapture(input: SaveCaptureInput): Promise<QueueItem> {
  const { localDate, capturedAt } = captureJarDate(input);
  const item = await enqueue({
    userId: input.userId,
    photoUri: input.uri,
    thumbUri: null,
    slot: input.slot,
    localDate,
    tz: input.tz,
    capturedAt,
    prepared: false,
  });
  // The queue holds its own copy now.
  deleteQuietly(input.uri);
  void prepareItem(item)
    .catch((error: unknown) => captureError(error, { area: 'capture' }))
    .finally(() => void requestUploads());
  return item;
}
