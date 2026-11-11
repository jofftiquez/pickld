// Prepares a raw queued camera or gallery photo (AGENTS rules 3 and 5): apply the Crop screen's choices if
// any (else the centred 3:4 crop), write the full and thumbnail
// WebP files without location metadata, and swap them into the queue row. Safe to call twice.
import { File } from 'expo-file-system';

import { preparePhoto } from '@/lib/image/pipeline';

import { getItem, savePrepared, type QueueItem } from './store';

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file wastes space but loses nothing.
  }
}

export async function prepareItem(item: QueueItem): Promise<QueueItem> {
  if (item.prepared) return item;
  const prepared = await preparePhoto(item.photoUri, item.crop ?? {});
  try {
    return await savePrepared(item.id, { photoUri: prepared.full.uri, thumbUri: prepared.thumb.uri });
  } finally {
    // The queue holds its own copies (or the row was already prepared).
    deleteQuietly(prepared.full.uri);
    deleteQuietly(prepared.thumb.uri);
  }
}

/** Prepares an item by id, if it still exists and is raw. */
export async function prepareQueued(id: number): Promise<QueueItem | null> {
  const item = await getItem(id);
  return item ? prepareItem(item) : null;
}
