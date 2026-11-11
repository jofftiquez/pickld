import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { retryItem } from '@/lib/queue/store';

/**
 * The Retry button on a failed tile (NFR-OFF-01): the item starts again from attempt 0 and the worker
 * is asked to drain now. The queue notifies Today of each state change, so the tile follows by itself.
 */
export async function retryUpload(queueId: number): Promise<void> {
  try {
    await retryItem(queueId);
  } catch (error) {
    // Already retried or uploaded from another tap: nothing to do, the tile updates from the queue.
    captureError(error, { area: 'retry-upload' });
    return;
  }
  await requestUploads();
}
