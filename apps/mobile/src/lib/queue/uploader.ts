import type { SupabaseClient } from '@supabase/supabase-js';
import { File, UploadTask } from 'expo-file-system';
import { z } from 'zod';

import { isNetworkError } from '../connectivity';
import type { Database, Json } from '../database.types';
import { assertDevOnline } from '../devOffline';
import { conflict, fail, isDue, start, succeed, waitForNetwork } from './machine';
import { getItem, isHeldForEditing, listQueue, removeItem, saveStatus, saveUploadRefs, type QueueItem } from './store';

// Upload worker (M2-04; NFR-OFF-01, NFR-OFF-02, FR-JAR-03; AGENTS "Upload pipeline", rules 3, 4, 6).
// One queued moment: ensure_jar → fn:upload-url → PUT photo and thumbnail → insert the moment as
// `checking` → call fn:moderate → mark uploaded and delete the local files. fn:moderate (M2-19) is
// the only thing that sets `live`. The server stamps added_at and is_backfilled; the app never sends them.

export type UploaderClient = Pick<SupabaseClient<Database>, 'rpc' | 'from' | 'functions'>;

export const signedUploadSchema = z.object({
  key: z.string().min(1),
  url: z.url(),
  method: z.literal('PUT'),
  /** Part of the signature: send exactly these. */
  headers: z.record(z.string(), z.string()),
});
export type SignedUpload = z.infer<typeof signedUploadSchema>;

const uploadUrlResponseSchema = z.object({
  data: z.object({ files: z.object({ photo: signedUploadSchema, thumb: signedUploadSchema }) }),
});

/** PUTs a local file to a signed URL; rejects unless the bucket answers 2xx. */
export type PutFile = (fileUri: string, target: SignedUpload) => Promise<void>;

export interface UploaderDeps {
  client: UploaderClient;
  putFile?: PutFile;
  /** New moment ids; a random UUID v4 by default. */
  newId?: () => string;
  now?: () => number;
  /** Turns a raw camera photo into the uploadable files (prepareItem by default). */
  prepare?: (item: QueueItem) => Promise<QueueItem>;
  /** Keeps an uploaded file in the phone's photo cache under its object key (rememberPhoto by default). */
  remember?: (localUri: string, key: string) => Promise<void>;
}

// Loaded on first use, so this module doesn't pull the native image manipulator in until a raw item needs it.
const prepareRaw = (item: QueueItem) => import('./prepare').then((m) => m.prepareItem(item));
// Best effort: a photo that isn't cached only downloads when it is first shown.
const rememberUploaded = (localUri: string, key: string) =>
  import('../image/photoCache').then((m) => m.rememberPhoto(localUri, key)).catch(() => undefined);

export type UploadOutcome =
  | { kind: 'uploaded'; itemId: number; momentId: string }
  /** The slot already has a moment in `jarId` (FR-JAR-03): offer Replace, don't count it as a failure. */
  | { kind: 'conflict'; itemId: number; jarId: string; slot: QueueItem['slot'] }
  /** Back in the queue until `nextAttemptAt` (backoff 1 s, 5 s, 30 s, 2 min, 10 min). */
  | { kind: 'retrying'; itemId: number; error: string; nextAttemptAt: number }
  /** The 5th failure: waits for the Retry button. */
  | { kind: 'failed'; itemId: number; error: string };

/**
 * Uploads through expo-file-system's native upload task. On iOS the default `background` URL session
 * lets a transfer that has started finish while the app is suspended; the JS promise only resolves if
 * the same JS runtime is still alive, otherwise the item goes back to queued on the next launch.
 */
export const putWithUploadTask: PutFile = async (fileUri, target) => {
  const task = new UploadTask(new File(fileUri), target.url, {
    httpMethod: target.method,
    headers: target.headers,
    sessionType: 'background',
  });
  try {
    const result = await task.uploadAsync();
    if (result.status < 200 || result.status >= 300) throw new Error(`photo upload answered ${result.status}`);
  } finally {
    task.release();
  }
};

/** A random UUID v4. Only uniqueness matters here (it identifies our own insert on a retry). */
export function newMomentId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

const UNIQUE_VIOLATION = '23505';

/**
 * The moment a Replace takes over from: the one holding the slot (not removed, not itself a pending
 * replacement; 0013), or null when the slot is free. On a retry after a lost response it may be this
 * upload's own row; the insert then hits our own primary key, which insertMoment recognises.
 */
async function slotHolder(client: UploaderClient, jarId: string, item: QueueItem): Promise<string | null> {
  const { data, error } = await client
    .from('moments')
    .select('id')
    .eq('jar_id', jarId)
    .eq('slot', item.slot)
    .neq('status', 'removed')
    .is('replaces', null)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Inserts the moment; 'conflict' when its slot is taken by another moment. A unique violation is either
 * the slot (index moments_slot_holder_key, or moments_one_replacement_key when the moment already has a
 * pending replacement; 0013) or our own primary key from an earlier attempt, told apart by reading our row.
 * A replacement (Replace, M2-22) is inserted with `replaces` set to the slot's holder: the server keeps it
 * hidden and the old photo visible until fn:moderate approves it and retires the old moment.
 */
async function insertMoment(
  client: UploaderClient,
  item: QueueItem,
  row: { id: string; jarId: string; photoKey: string; thumbKey: string },
): Promise<'inserted' | 'conflict'> {
  const replaces = item.replace ? await slotHolder(client, row.jarId, item) : null;
  const { error } = await client.from('moments').insert({
    id: row.id,
    jar_id: row.jarId,
    user_id: item.userId,
    slot: item.slot,
    photo_path: row.photoKey,
    thumb_path: row.thumbKey,
    caption: item.caption,
    captured_at: item.capturedAt,
    // Null leaves it to the server: the owner's default visibility (0066). is_private is derived there.
    ...(item.visibility === null ? {} : { visibility: item.visibility }),
    edits: item.edits as NonNullable<Json>, // an object parsed from JSON by the queue store
    status: 'checking',
    replaces,
  });
  if (!error) return 'inserted';
  if (error.code !== UNIQUE_VIOLATION) throw error;
  // Either the slot is taken, or an earlier attempt inserted this very row and its response was lost.
  const { data: own, error: lookupError } = await client.from('moments').select('id').eq('id', row.id).maybeSingle();
  if (lookupError) throw lookupError;
  return own ? 'inserted' : 'conflict';
}

/** Runs one due queue item through the pipeline and persists the resulting state. */
export async function uploadItem(item: QueueItem, deps: UploaderDeps): Promise<UploadOutcome> {
  const {
    client,
    putFile = putWithUploadTask,
    newId = newMomentId,
    now = Date.now,
    prepare = prepareRaw,
    remember = rememberUploaded,
  } = deps;
  const uploading = start(item, now());
  await saveStatus(uploading);
  try {
    // A raw camera photo (queued at the shutter) is prepared first: location never leaves the phone (rule 5).
    const ready = item.prepared ? item : await prepare(item);
    if (!ready.prepared) throw new Error('queued photo is not prepared');
    if (ready.thumbUri === null) throw new Error('queued moment has no thumbnail');
    const momentId = item.momentId ?? newId();

    await assertDevOnline(); // dev offline switch (M2-30): fail like a lost connection, before any request
    const { data: jar, error: jarError } = await client.rpc('ensure_jar', { local_date: item.localDate, tz: item.tz });
    if (jarError) throw jarError;
    await saveUploadRefs(item.id, { jarId: jar.id, momentId });

    const photo = new File(ready.photoUri);
    const thumb = new File(ready.thumbUri);
    const { data: body, error: urlError } = await client.functions.invoke<unknown>('upload-url', {
      body: {
        kind: 'moment',
        jarId: jar.id,
        photo: { contentType: 'image/webp', size: photo.size },
        thumb: { contentType: 'image/webp', size: thumb.size },
      },
    });
    if (urlError) throw urlError;
    const { files } = uploadUrlResponseSchema.parse(body).data;

    await putFile(photo.uri, files.photo);
    await putFile(thumb.uri, files.thumb);
    // The phone already has both files: showing the new moment never downloads them.
    await Promise.all([remember(photo.uri, files.photo.key), remember(thumb.uri, files.thumb.key)]);

    const inserted = await insertMoment(client, item, {
      id: momentId,
      jarId: jar.id,
      photoKey: files.photo.key,
      thumbKey: files.thumb.key,
    });
    if (inserted === 'conflict') {
      await saveStatus(conflict(uploading, 'slot already has a moment'));
      return { kind: 'conflict', itemId: item.id, jarId: jar.id, slot: item.slot };
    }

    // fn:moderate (M2-19) moves it out of `checking`; it is safe to repeat, so a failed call retries
    // the whole item and the insert above recognises our own row.
    const { error: moderateError } = await client.functions.invoke('moderate', { body: { momentId } });
    if (moderateError) throw moderateError;

    // The moment is on the server: only now may the local copies go (rule 3).
    await saveStatus(succeed(uploading));
    await removeItem(item.id);
    return { kind: 'uploaded', itemId: item.id, momentId };
  } catch (error) {
    // Offline is not a failure (D-24): the photo waits for the connection without using up attempts.
    const next = isNetworkError(error)
      ? waitForNetwork(uploading, message(error), now())
      : fail(uploading, message(error), now());
    await saveStatus(next);
    return next.state === 'failed'
      ? { kind: 'failed', itemId: item.id, error: next.lastError ?? '' }
      : { kind: 'retrying', itemId: item.id, error: next.lastError ?? '', nextAttemptAt: next.nextAttemptAt ?? 0 };
  }
}

/**
 * Uploads the user's due items one at a time, oldest first. `keepGoing` is checked before each item so
 * a sign-out or lost connection stops the drain. Rows left `uploaded` by an interrupted cleanup are removed.
 * A photo still open in the editor waits (M2-12), so its caption, privacy and edits go up with it.
 */
export async function drainQueue(
  userId: string,
  deps: UploaderDeps,
  keepGoing: () => boolean = () => true,
): Promise<UploadOutcome[]> {
  const now = deps.now ?? Date.now;
  const outcomes: UploadOutcome[] = [];
  for (const listed of await listQueue(userId)) {
    if (!keepGoing()) break;
    const item = await getItem(listed.id); // may have changed (Retry, Replace) since the list was read
    if (item?.state === 'uploaded') await removeItem(item.id);
    else if (item && isDue(item, now()) && !isHeldForEditing(item, now())) outcomes.push(await uploadItem(item, deps));
  }
  return outcomes;
}
