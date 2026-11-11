// Replace (M2-22; FR-JAR-03): what the Replace dialog does with a queued photo whose slot was taken.
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { removeItem, replaceItem, type QueueItem } from '@/lib/queue/store';

/**
 * Replace: the conflict item is queued again as a replacement and the worker is asked to drain now. The
 * server keeps the old photo visible until fn:moderate approves the new one (0013).
 */
export async function replaceUpload(queueId: number): Promise<void> {
  try {
    await replaceItem(queueId);
  } catch (error) {
    // Already chosen from another tap, or gone: the queue tells Today what it is now.
    captureError(error, { area: 'replace-upload' });
    return;
  }
  await requestUploads();
}

/** Keep current photo: the user chose to drop the new photo, so its row and files go. */
export async function keepCurrentPhoto(queueId: number): Promise<void> {
  try {
    await removeItem(queueId);
  } catch (error) {
    captureError(error, { area: 'replace-upload' });
  }
}

/** The conflict the Replace dialog asks about next: the oldest one not dismissed with Not now. */
export function nextConflict<T extends Pick<QueueItem, 'id' | 'state'>>(
  queue: readonly T[],
  dismissed: ReadonlySet<number>,
): T | null {
  return (
    queue.filter((item) => item.state === 'conflict' && !dismissed.has(item.id)).sort((a, b) => a.id - b.id)[0] ?? null
  );
}
