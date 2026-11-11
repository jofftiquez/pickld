// Camera photo → offline queue (FR-CAP-01; AGENTS rules 3, 5, 6, 7). Until the editor exists
// (M2-11) a camera photo goes straight to the queue: crop to 3:4 and write WebP without location
// (preparePhoto), queue it with its slot, jar date and phone zone, then ask the upload worker to run.
import { File } from 'expo-file-system';

import { captureInfo } from '@/lib/image/captureTime';
import { preparePhoto } from '@/lib/image/pipeline';
import { chooseJar } from '@/lib/jars';
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
 * Prepares and queues a camera photo, then kicks the upload worker without waiting for it. Resolves
 * once the moment is in the queue; the network is never touched before that (rule 3).
 */
export async function saveCapture(input: SaveCaptureInput): Promise<QueueItem> {
  const { localDate, capturedAt } = captureJarDate(input);
  const prepared = await preparePhoto(input.uri);
  const item = await enqueue({
    userId: input.userId,
    photoUri: prepared.full.uri,
    thumbUri: prepared.thumb.uri,
    slot: input.slot,
    localDate,
    tz: input.tz,
    capturedAt,
  });
  // The queue holds its own copies now.
  for (const uri of [input.uri, prepared.full.uri, prepared.thumb.uri]) deleteQuietly(uri);
  void requestUploads();
  return item;
}
