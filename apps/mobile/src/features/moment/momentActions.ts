// Moment options (M2-23; FR-CAP-10, FR-JAR-03, D-3, rule 1). What each option does to one of the owner's
// moments, wherever it is:
// - A queued moment (not uploaded yet) is changed in the offline queue, so every option works offline and
//   the change goes up with the photo.
// - An uploaded moment is changed on the server, as the owner, so RLS and the moments triggers decide
//   (0004, 0013): privacy and slot are plain updates; caption, edits and a re-cropped photo are proposals
//   (pending_*) that readers don't see until fn:moderate approves them (rule 4, D-22 auto-approves). These
//   need a connection; the old version stays if anything fails.
import type { SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { z } from 'zod';

import type { Database, Json } from '@/lib/database.types';
import { requestUploads } from '@/lib/queue/runner';
import {
  discardItem,
  QueueItemBusyError,
  saveEdits,
  saveOptions,
  saveRecropped,
  type SaveEditsInput,
} from '@/lib/queue/store';
import { putWithUploadTask, type PutFile } from '@/lib/queue/uploader';
import type { Visibility } from '@/lib/visibility';
import type { Slot } from '@/theme/tokens';

export type MomentTarget =
  | { kind: 'queued'; queueId: number }
  /** `jarId` is where a re-cropped photo is uploaded (fn:upload-url checks the jar is the owner's). */
  | { kind: 'server'; momentId: string; jarId: string };

export type MomentsClient = Pick<SupabaseClient<Database>, 'from' | 'functions'>;

const CHECK_VIOLATION = '23514';

/**
 * Why an option didn't apply. `slotTaken`: the slot filled up meanwhile (moments_slot_holder_key).
 * `busy`: a queued photo is uploading right now. `refused`: the server said no (a moment being replaced
 * can't move, 0013; the moment is gone or removed). `failed`: anything else, usually no connection.
 */
export type OptionError = 'slotTaken' | 'busy' | 'refused' | 'failed';

export class MomentOptionError extends Error {
  constructor(
    readonly reason: OptionError,
    cause?: unknown,
  ) {
    super(`Moment option failed: ${reason}`, { cause });
    this.name = 'MomentOptionError';
  }
}

const UNIQUE_VIOLATION = '23505';
const INSUFFICIENT_PRIVILEGE = '42501';

function fromPostgres(error: { code?: string } | null): MomentOptionError | null {
  if (!error) return null;
  if (error.code === UNIQUE_VIOLATION) return new MomentOptionError('slotTaken', error);
  if (error.code === INSUFFICIENT_PRIVILEGE) return new MomentOptionError('refused', error);
  return new MomentOptionError('failed', error);
}

/** Runs a queue change, turning "uploading right now" into `busy`. */
async function onQueue<T>(change: () => Promise<T>): Promise<T> {
  try {
    return await change();
  } catch (error) {
    throw new MomentOptionError(error instanceof QueueItemBusyError ? 'busy' : 'failed', error);
  }
}

/** Updates the owner's moment; RLS hides another user's row, so "no row changed" is `refused`. */
async function updateMoment(
  client: MomentsClient,
  momentId: string,
  patch: Database['public']['Tables']['moments']['Update'],
): Promise<void> {
  const { data, error } = await client.from('moments').update(patch).eq('id', momentId).select('id');
  const failure = fromPostgres(error);
  if (failure) throw failure;
  if (!data || data.length === 0) throw new MomentOptionError('refused');
}

/** fn:moderate checks the proposal and swaps it in (D-22: approves). Safe to call again. */
async function moderate(client: MomentsClient, momentId: string): Promise<void> {
  const { error } = await client.functions.invoke('moderate', { body: { momentId } });
  if (error) throw new MomentOptionError('failed', error);
}

/**
 * Visibility (FR-CAP-09, D-48): Readers, Everyone or Only me. It applies at once: others stop seeing an
 * Only me moment straight away (rule 9). The server derives is_private and copies the change to a pending
 * replacement (0066).
 */
export async function setMomentVisibility(
  client: MomentsClient,
  target: MomentTarget,
  visibility: Visibility,
): Promise<void> {
  if (target.kind === 'queued') {
    await onQueue(() => saveOptions(target.queueId, { visibility }));
    return;
  }
  await updateMoment(client, target.momentId, { visibility });
}

/** Move to another empty slot in the same jar (FR-CAP-10, D-3). The server refuses a filled slot. */
export async function moveMoment(client: MomentsClient, target: MomentTarget, slot: Slot): Promise<void> {
  if (target.kind === 'queued') {
    await onQueue(() => saveOptions(target.queueId, { slot }));
    void requestUploads(); // a photo that had stopped on a conflict goes again
    return;
  }
  await updateMoment(client, target.momentId, { slot });
}

/** Delete moment, after the confirmation dialog. A queued photo never reaches the server. */
export async function deleteMoment(client: MomentsClient, target: MomentTarget): Promise<void> {
  if (target.kind === 'queued') {
    await onQueue(() => discardItem(target.queueId));
    return;
  }
  const { data, error } = await client.from('moments').delete().eq('id', target.momentId).select('id');
  const failure = fromPostgres(error);
  if (failure) throw failure;
  if (!data || data.length === 0) throw new MomentOptionError('refused');
}

/**
 * Set as cover (QA item 11, D-56): the moment becomes its jar's cover. A guarded update of the owner's jar
 * (jars_update RLS; the jars_cover_check trigger, 0069, allows only a live moment of that jar). Readers who
 * can't see the moment keep the fallback cover. Only for an uploaded moment.
 */
export async function setJarCover(client: MomentsClient, jarId: string, momentId: string): Promise<void> {
  const { data, error } = await client.from('jars').update({ cover_moment_id: momentId }).eq('id', jarId).select('id');
  if (error?.code === CHECK_VIOLATION) throw new MomentOptionError('refused', error);
  const failure = fromPostgres(error);
  if (failure) throw failure;
  if (!data || data.length === 0) throw new MomentOptionError('refused');
}

/**
 * The editor's Done on a moment (Edit caption, Edit stickers and filters). Edits are data, never burned
 * into the photo (FR-CAP-08). On the server the caption and edits become a proposal that fn:moderate swaps
 * in; visibility changes at once.
 */
export async function saveMomentEdits(
  client: MomentsClient,
  target: MomentTarget,
  input: SaveEditsInput,
): Promise<void> {
  if (target.kind === 'queued') {
    await onQueue(() => saveEdits(target.queueId, input));
    void requestUploads();
    return;
  }
  await updateMoment(client, target.momentId, {
    caption: input.caption,
    edits: input.edits as NonNullable<Json>, // an object (saveEditsInputSchema)
    visibility: input.visibility,
  });
  await moderate(client, target.momentId);
}

const signedUpload = z.object({
  key: z.string().min(1),
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
});
const uploadUrlResponse = z.object({
  data: z.object({ files: z.object({ photo: signedUpload, medium: signedUpload.optional(), thumb: signedUpload }) }),
});

export type RecropDeps = {
  putFile?: PutFile;
  /** Bytes of a local file, for fn:upload-url's size check. */
  sizeOf?: (uri: string) => number;
  /** The new thumbnail's ThumbHash placeholder, or null (makeThumbhash by default). */
  thumbhashOf?: (uri: string) => Promise<string | null>;
};

/**
 * Saves a re-cropped photo (already prepared: 1440 × 1920 and 480 × 640 WebP without location, rule 5, plus
 * the optional 1080 × 1440 feed copy for an uploaded moment; a queued one gets its copy when it uploads).
 * A queued moment swaps its files; an uploaded moment uploads them like a new photo (fn:upload-url, PUT)
 * and proposes them as its new photo, which fn:moderate checks like any photo before readers see it. The
 * moment keeps its id, capture time, "Added later" flag, likes and overlays (placed relative to the photo).
 */
export async function saveRecrop(
  client: MomentsClient,
  target: MomentTarget,
  files: { photoUri: string; thumbUri: string; mediumUri?: string | null },
  deps: RecropDeps = {},
): Promise<void> {
  const { mediumUri, ...queueFiles } = files;
  if (target.kind === 'queued') {
    await onQueue(() => saveRecropped(target.queueId, queueFiles));
    void requestUploads();
    return;
  }
  const {
    putFile = putWithUploadTask,
    sizeOf = (uri: string) => new File(uri).size,
    thumbhashOf = (uri: string) => import('@/lib/image/photoThumbhash').then((m) => m.makeThumbhash(uri)),
  } = deps;
  try {
    const thumbhash = await thumbhashOf(files.thumbUri).catch(() => null);
    const { data: body, error } = await client.functions.invoke<unknown>('upload-url', {
      body: {
        kind: 'moment',
        jarId: target.jarId,
        photo: { contentType: 'image/webp', size: sizeOf(files.photoUri) },
        ...(mediumUri ? { medium: { contentType: 'image/webp', size: sizeOf(mediumUri) } } : {}),
        thumb: { contentType: 'image/webp', size: sizeOf(files.thumbUri) },
        ...(thumbhash ? { thumbhash } : {}),
      },
    });
    if (error) throw error;
    const signed = uploadUrlResponse.parse(body).data.files;
    await putFile(files.photoUri, signed.photo);
    if (mediumUri && signed.medium) await putFile(mediumUri, signed.medium);
    await putFile(files.thumbUri, signed.thumb);
    await updateMoment(client, target.momentId, { photo_path: signed.photo.key, thumb_path: signed.thumb.key });
  } catch (error) {
    throw error instanceof MomentOptionError ? error : new MomentOptionError('failed', error);
  }
  await moderate(client, target.momentId);
}
