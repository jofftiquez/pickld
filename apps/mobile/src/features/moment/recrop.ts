// Re-crop (M2-23, FR-CAP-10; FR-CAP-03). The original photo isn't kept once a moment is prepared (the
// queue keeps only the 1440 × 1920 crop, and deletes even that after upload), so Re-crop works on the
// moment's saved 3:4 photo: zoom in, reposition, rotate and flip within it. It can't zoom out past an
// earlier crop. An uploaded moment's photo is downloaded for the Crop screen and deleted afterwards.
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'react-native';

import type { PendingCrop } from '@/features/capture/pendingCrop';
import type { CropSpec } from '@/lib/image/crop';
import { preparePhoto } from '@/lib/image/pipeline';
import { prepareItem } from '@/lib/queue/prepare';
import { getItem } from '@/lib/queue/store';
import type { Slot } from '@/theme/tokens';

import { MomentOptionError, saveRecrop, type MomentsClient, type MomentTarget } from './momentActions';
import { photoUrls } from './useOwnMoment';

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file wastes space but loses nothing.
  }
}

/** The photo for the Crop screen: the queue's own file, or the uploaded photo downloaded to the cache. */
async function cropPhoto(target: MomentTarget): Promise<{ uri: string; temporary: boolean }> {
  if (target.kind === 'queued') {
    const item = await getItem(target.queueId);
    if (!item) throw new MomentOptionError('busy');
    // A raw photo is prepared first, so Re-crop always starts from the 3:4 photo the moment shows.
    const ready = item.prepared ? item : await prepareItem(item);
    return { uri: ready.photoUri, temporary: false };
  }
  const { full } = await photoUrls(target.momentId);
  if (full === null) throw new MomentOptionError('failed');
  const extension = /\.(jpe?g|png|webp)(\?|$)/i.exec(full)?.[1] ?? 'webp';
  const cache = new Directory(Paths.cache, 'recrop');
  cache.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(full, new File(cache, `${target.momentId}-${Date.now()}.${extension}`));
  return { uri: file.uri, temporary: true };
}

/** Gets the moment's photo ready for /crop. Rejects with a MomentOptionError (usually no connection). */
export async function openRecrop(input: { target: MomentTarget; slot: Slot; userId: string }): Promise<PendingCrop> {
  let photo: { uri: string; temporary: boolean } | null = null;
  try {
    photo = await cropPhoto(input.target);
    const size = await Image.getSize(photo.uri);
    return { photo: { ...photo, ...size }, slot: input.slot, userId: input.userId, recrop: input.target };
  } catch (error) {
    if (photo?.temporary) deleteQuietly(photo.uri);
    throw error instanceof MomentOptionError ? error : new MomentOptionError('failed', error);
  }
}

/**
 * Crop's Save crop: prepares the new crop (WebP without location, rule 5) and saves it on the moment
 * (`saveRecrop`). The prepared cache files are always deleted; the downloaded photo too once saved.
 */
export async function finishRecrop(
  client: MomentsClient,
  pending: Extract<PendingCrop, { recrop: MomentTarget }>,
  crop: CropSpec,
): Promise<void> {
  let prepared: Awaited<ReturnType<typeof preparePhoto>> | null = null;
  try {
    prepared = await preparePhoto(pending.photo.uri, crop);
    await saveRecrop(client, pending.recrop, { photoUri: prepared.full.uri, thumbUri: prepared.thumb.uri });
  } catch (error) {
    throw error instanceof MomentOptionError ? error : new MomentOptionError('failed', error);
  } finally {
    if (prepared) {
      deleteQuietly(prepared.full.uri);
      deleteQuietly(prepared.thumb.uri);
    }
  }
  discardRecropPhoto(pending);
}

/** Deletes a photo downloaded for Re-crop (Cancel, or after saving). The queue's own file is never deleted. */
export function discardRecropPhoto(pending: PendingCrop): void {
  if (pending.recrop && pending.photo.temporary) deleteQuietly(pending.photo.uri);
}
