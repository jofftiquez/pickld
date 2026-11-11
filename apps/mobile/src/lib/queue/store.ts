import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { cropSpecSchema, type CropSpec } from '@/lib/image/crop';
import { slots } from '@/theme/tokens';

import { INITIAL_STATUS, queueStateSchema, replace, retry, type UploadStatus } from './machine';

// Offline queue (NFR-OFF-01, NFR-OFF-02; AGENTS rule 3). A moment is copied into app storage and written
// here before any network call; the upload worker (M2-04) reads it back and drives the state machine.
// Photos arrive already processed by the image pipeline (M2-09), which strips location EXIF (rule 5);
// only the capture time is kept, in `capturedAt`.

const DB_NAME = 'queue.db';
const DIR_NAME = 'queue';

/** Index i upgrades the schema from user_version i to i + 1. Never edit a shipped entry; append. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    photo_file TEXT NOT NULL,
    thumb_file TEXT,
    slot TEXT NOT NULL,
    local_date TEXT NOT NULL,
    tz TEXT NOT NULL,
    captured_at TEXT,
    caption TEXT,
    is_private INTEGER NOT NULL DEFAULT 0,
    edits TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL
  );`,
  // M2-04: the jar ensure_jar returned and the moment id the uploader inserts with. The id is made once
  // per queued moment, so a retry after an insert whose response was lost finds its own row.
  `ALTER TABLE queue_items ADD COLUMN jar_id TEXT;
   ALTER TABLE queue_items ADD COLUMN moment_id TEXT;`,
  // A camera photo is queued raw the moment the shutter fires (so it survives the app being killed),
  // then prepared (crop, WebP, no location: rule 5). 0 = still raw; the uploader prepares it before any
  // network call. Rows from before this migration were always prepared.
  `ALTER TABLE queue_items ADD COLUMN prepared INTEGER NOT NULL DEFAULT 1;`,
  // M2-12: when the editor opened on a photo just taken (ms since epoch); NULL = not being edited. The
  // uploader holds the item until the editor saves or closes, so the caption, privacy and edits go up
  // with the moment. A hold left by a killed app is cleared on the next launch (openQueue) and expires
  // after EDIT_HOLD_MS regardless, so a photo is never stuck.
  `ALTER TABLE queue_items ADD COLUMN editing_since INTEGER;`,
  // M2-10: the Crop screen's choices for a raw gallery photo (JSON CropSpec), applied when it is prepared.
  // NULL = the default centred 3:4 crop (camera photos, exactly 3:4 gallery photos).
  `ALTER TABLE queue_items ADD COLUMN crop TEXT;`,
  // M2-22: 1 = the user chose Replace for this photo's slot. The uploader inserts it as a replacement of
  // the moment holding the slot (0013): the old photo stays visible until fn:moderate approves the new one.
  `ALTER TABLE queue_items ADD COLUMN replace INTEGER NOT NULL DEFAULT 0;`,
];

/** After this long an editing hold no longer stops the upload (see MIGRATIONS[3]). */
export const EDIT_HOLD_MS = 60 * 60_000;

const ianaTimeZone = z
  .string()
  .regex(/^(UTC|[A-Za-z]+(\/[A-Za-z0-9_+-]+)+)$/, 'Use an IANA time zone name, not an offset')
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone');

const editsSchema = z.record(z.string(), z.unknown());

export const enqueueInputSchema = z.object({
  userId: z.uuid(),
  /** Processed photo (any readable file URI); copied into app storage, the original may be deleted after. */
  photoUri: z.string().min(1),
  thumbUri: z.string().min(1).nullable().default(null),
  slot: z.enum(slots),
  /** The jar's local date, YYYY-MM-DD in `tz`. */
  localDate: z.iso.date(),
  tz: ianaTimeZone,
  capturedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  caption: z.string().max(150).nullable().default(null),
  isPrivate: z.boolean().default(false),
  edits: editsSchema.default({}),
  /** False for a raw camera photo that still needs the image pipeline (see MIGRATIONS[2]). */
  prepared: z.boolean().default(true),
  /** True when the editor opens on it next: no upload until it saves or closes (see MIGRATIONS[3]). */
  editing: z.boolean().default(false),
  /** The Crop screen's frame, rotation and flip for a raw photo; preparation applies it (MIGRATIONS[4]). */
  crop: cropSpecSchema.nullable().default(null),
  /** True when the user already chose Replace for a filled slot (see MIGRATIONS[5]). */
  replace: z.boolean().default(false),
});
export type EnqueueInput = z.input<typeof enqueueInputSchema>;

export interface QueueItem extends UploadStatus {
  id: number;
  userId: string;
  photoUri: string;
  thumbUri: string | null;
  slot: (typeof slots)[number];
  localDate: string;
  tz: string;
  capturedAt: string | null;
  caption: string | null;
  isPrivate: boolean;
  edits: Record<string, unknown>;
  createdAt: number;
  /** Set by the uploader once `ensure_jar` answered; a `conflict` item's slot is taken in this jar. */
  jarId: string | null;
  /** Set by the uploader before the first insert attempt and kept across retries. */
  momentId: string | null;
  /** False while the photo is the raw capture: it must go through prepareItem before upload (rule 5). */
  prepared: boolean;
  /** When the editor took the item (ms), or null; see MIGRATIONS[3] and isHeldForEditing. */
  editingSince: number | null;
  /** How preparation crops the raw photo, or null for the centred 3:4 crop (MIGRATIONS[4]). */
  crop: CropSpec | null;
  /** Upload as a replacement of the moment holding the slot (Replace, M2-22; see MIGRATIONS[5]). */
  replace: boolean;
}

// Files are stored by name and resolved against the document directory on every read, because the
// absolute container path changes when iOS updates the app.
const rowSchema = z.object({
  id: z.number().int(),
  user_id: z.string(),
  photo_file: z.string().min(1),
  thumb_file: z.string().min(1).nullable(),
  slot: z.enum(slots),
  local_date: z.iso.date(),
  tz: ianaTimeZone,
  captured_at: z.string().nullable(),
  caption: z.string().nullable(),
  is_private: z.union([z.literal(0), z.literal(1)]),
  edits: z
    .string()
    .transform((s) => JSON.parse(s) as unknown)
    .pipe(editsSchema),
  state: queueStateSchema,
  attempts: z.number().int().nonnegative(),
  next_attempt_at: z.number().nullable(),
  last_error: z.string().nullable(),
  created_at: z.number(),
  jar_id: z.uuid().nullable(),
  moment_id: z.uuid().nullable(),
  prepared: z.union([z.literal(0), z.literal(1)]),
  editing_since: z.number().nullable(),
  crop: z
    .string()
    .transform((s) => JSON.parse(s) as unknown)
    .pipe(cropSpecSchema)
    .nullable(),
  replace: z.union([z.literal(0), z.literal(1)]),
});

function queueDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function toItem(raw: unknown): QueueItem {
  const row = rowSchema.parse(raw);
  const dir = queueDir();
  return {
    id: row.id,
    userId: row.user_id,
    photoUri: new File(dir, row.photo_file).uri,
    thumbUri: row.thumb_file === null ? null : new File(dir, row.thumb_file).uri,
    slot: row.slot,
    localDate: row.local_date,
    tz: row.tz,
    capturedAt: row.captured_at,
    caption: row.caption,
    isPrivate: row.is_private === 1,
    edits: row.edits,
    createdAt: row.created_at,
    jarId: row.jar_id,
    momentId: row.moment_id,
    prepared: row.prepared === 1,
    editingSince: row.editing_since,
    crop: row.crop,
    replace: row.replace === 1,
    state: row.state,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
  };
}

/** Runs every migration above the database's `PRAGMA user_version`, each in its own transaction. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version += 1) {
    const sql = MIGRATIONS[version] ?? '';
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** What changed in the queue: a moment was queued, an upload state moved, or a row left (uploaded or dropped). */
export type QueueChange = 'added' | 'status' | 'removed';
const changeListeners = new Set<(change: QueueChange) => void>();

/** Calls `listener` after every write that changes what Today shows (tile states, M2-06). */
export function subscribeQueue(listener: (change: QueueChange) => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notify(change: QueueChange): void {
  changeListeners.forEach((listener) => listener(change));
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Opens and migrates the queue once per app run. Uploads cut short by the last run go back to queued. */
export function openQueue(): Promise<SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await openDatabaseAsync(DB_NAME);
    await migrate(db);
    await db.runAsync("UPDATE queue_items SET state = 'queued' WHERE state = 'uploading'");
    // No editor is open at launch: photos the last run was editing upload as they are.
    await db.runAsync('UPDATE queue_items SET editing_since = NULL WHERE editing_since IS NOT NULL');
    return db;
  })().catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // A leftover file wastes space but loses nothing.
  }
}

async function copyInto(dir: Directory, sourceUri: string, stem: string): Promise<File> {
  const source = new File(sourceUri);
  const dest = new File(dir, `${stem}${source.extension}`);
  await source.copy(dest);
  return dest;
}

/**
 * Copies the photo (and thumbnail) into app storage, then writes the queue row. If any copy or the
 * insert fails, nothing is queued and the copies are removed; the caller still has its original.
 */
export async function enqueue(input: EnqueueInput): Promise<QueueItem> {
  const moment = enqueueInputSchema.parse(input);
  const db = await openQueue();
  const dir = queueDir();
  dir.create({ intermediates: true, idempotent: true });
  const stem = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const copies: File[] = [];
  try {
    const photo = await copyInto(dir, moment.photoUri, stem);
    copies.push(photo);
    const thumb = moment.thumbUri === null ? null : await copyInto(dir, moment.thumbUri, `${stem}-thumb`);
    if (thumb) copies.push(thumb);
    const { lastInsertRowId } = await db.runAsync(
      `INSERT INTO queue_items (user_id, photo_file, thumb_file, slot, local_date, tz, captured_at, caption,
         is_private, edits, state, attempts, next_attempt_at, last_error, created_at, prepared, editing_since, crop, replace)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      moment.userId,
      photo.name,
      thumb?.name ?? null,
      moment.slot,
      moment.localDate,
      moment.tz,
      moment.capturedAt,
      moment.caption,
      moment.isPrivate ? 1 : 0,
      JSON.stringify(moment.edits),
      INITIAL_STATUS.state,
      INITIAL_STATUS.attempts,
      INITIAL_STATUS.nextAttemptAt,
      INITIAL_STATUS.lastError,
      Date.now(),
      moment.prepared ? 1 : 0,
      moment.editing ? Date.now() : null,
      moment.crop === null ? null : JSON.stringify(moment.crop),
      moment.replace ? 1 : 0,
    );
    const item = await getItem(lastInsertRowId);
    if (!item) throw new Error('Queued moment was not saved');
    notify('added');
    return item;
  } catch (error) {
    copies.forEach(deleteQuietly);
    throw error;
  }
}

export async function getItem(id: number): Promise<QueueItem | null> {
  const db = await openQueue();
  const row = await db.getFirstAsync<unknown>('SELECT * FROM queue_items WHERE id = ?', id);
  return row === null ? null : toItem(row);
}

/** The user's queued moments, oldest first. Other accounts' rows on this device are left alone. */
export async function listQueue(userId: string): Promise<QueueItem[]> {
  const db = await openQueue();
  const rows = await db.getAllAsync<unknown>('SELECT * FROM queue_items WHERE user_id = ? ORDER BY id', userId);
  return rows.map(toItem);
}

/** Persists a state-machine result: `await saveStatus(fail(item, message))`. */
export async function saveStatus(item: UploadStatus & { id: number }): Promise<void> {
  const db = await openQueue();
  await db.runAsync(
    'UPDATE queue_items SET state = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
    item.state,
    item.attempts,
    item.nextAttemptAt,
    item.lastError,
    item.id,
  );
  notify('status');
}

/** Records the jar and moment id of an upload in progress (see MIGRATIONS[1]). */
export async function saveUploadRefs(id: number, refs: { jarId: string; momentId: string }): Promise<void> {
  const db = await openQueue();
  await db.runAsync('UPDATE queue_items SET jar_id = ?, moment_id = ? WHERE id = ?', refs.jarId, refs.momentId, id);
}

/**
 * Swaps a raw item's photo for the prepared full and thumbnail files (copied into app storage) and marks
 * it prepared; the raw file is deleted only after the row points at the new files. If the item was
 * already prepared (a second preparation raced this one), the new copies are dropped instead.
 */
export async function savePrepared(id: number, files: { photoUri: string; thumbUri: string }): Promise<QueueItem> {
  const before = await getItem(id);
  if (!before) throw new Error(`No queued moment ${id}`);
  const db = await openQueue();
  const dir = queueDir();
  const stem = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const copies: File[] = [];
  try {
    const photo = await copyInto(dir, files.photoUri, stem);
    copies.push(photo);
    const thumb = await copyInto(dir, files.thumbUri, `${stem}-thumb`);
    copies.push(thumb);
    const { changes } = await db.runAsync(
      'UPDATE queue_items SET photo_file = ?, thumb_file = ?, prepared = 1 WHERE id = ? AND prepared = 0',
      photo.name,
      thumb.name,
      id,
    );
    if (changes === 0) {
      copies.forEach(deleteQuietly);
    } else {
      deleteQuietly(new File(before.photoUri));
      if (before.thumbUri) deleteQuietly(new File(before.thumbUri));
      notify('status');
    }
  } catch (error) {
    copies.forEach(deleteQuietly);
    throw error;
  }
  const after = await getItem(id);
  if (!after) throw new Error(`No queued moment ${id}`);
  return after;
}

/** True while the editor holds the item back from upload (MIGRATIONS[3]); a hold older than EDIT_HOLD_MS has lapsed. */
export function isHeldForEditing(item: Pick<QueueItem, 'editingSince'>, now: number = Date.now()): boolean {
  return item.editingSince !== null && now - item.editingSince < EDIT_HOLD_MS;
}

export const saveEditsInputSchema = z.object({
  caption: z.string().max(150).nullable(),
  isPrivate: z.boolean(),
  edits: editsSchema,
});
export type SaveEditsInput = z.infer<typeof saveEditsInputSchema>;

/**
 * The editor's Add to #slot / Done: stores the caption, privacy and edits on the queued moment and ends
 * its editing hold, so the uploader sends them with it. The photo file is not touched (FR-CAP-08).
 */
export async function saveEdits(id: number, input: SaveEditsInput): Promise<QueueItem> {
  const edit = saveEditsInputSchema.parse(input);
  const db = await openQueue();
  const { changes } = await db.runAsync(
    'UPDATE queue_items SET caption = ?, is_private = ?, edits = ?, editing_since = NULL WHERE id = ?',
    edit.caption,
    edit.isPrivate ? 1 : 0,
    JSON.stringify(edit.edits),
    id,
  );
  if (changes === 0) throw new Error(`No queued moment ${id}`);
  notify('status');
  const item = await getItem(id);
  if (!item) throw new Error(`No queued moment ${id}`);
  return item;
}

/** The editor closed without saving: the photo uploads as it is. Nothing happens if it is gone. */
export async function releaseEditing(id: number): Promise<void> {
  const db = await openQueue();
  await db.runAsync('UPDATE queue_items SET editing_since = NULL WHERE id = ?', id);
}

/** The Retry button: a failed item starts again from attempt 0. */
export async function retryItem(id: number): Promise<QueueItem> {
  const item = await getItem(id);
  if (!item) throw new Error(`No queued moment ${id}`);
  const next = retry(item);
  await saveStatus(next);
  return next;
}

/**
 * Replace on a conflict (M2-22): the item is marked as a replacement and starts again from attempt 0.
 * Throws if it is gone or not a conflict (e.g. already chosen from another tap).
 */
export async function replaceItem(id: number): Promise<QueueItem> {
  const item = await getItem(id);
  if (!item) throw new Error(`No queued moment ${id}`);
  const next = replace(item);
  const db = await openQueue();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE queue_items SET replace = 1 WHERE id = ?', id);
    await db.runAsync(
      'UPDATE queue_items SET state = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
      next.state,
      next.attempts,
      next.nextAttemptAt,
      next.lastError,
      id,
    );
  });
  notify('status');
  return { ...next, replace: true };
}

/**
 * Moment options (M2-23) refuse a queued moment that is uploading right now, or that has just left the
 * queue (uploaded): changing it locally could race the upload. The caller says "try again in a moment";
 * by then the tile shows the uploaded moment, which the options change on the server.
 */
export class QueueItemBusyError extends Error {
  constructor(id: number) {
    super(`Queued moment ${id} is uploading or gone`);
    this.name = 'QueueItemBusyError';
  }
}

/**
 * Moment options on a queued moment (M2-23, FR-CAP-10): Make private, or Move to another moment. A move
 * starts the upload again from attempt 0 for a photo that had stopped (a conflict on its old slot, or a
 * failure), and drops a Replace choice made for the old slot. Throws QueueItemBusyError while uploading.
 */
export async function saveOptions(
  id: number,
  patch: { slot?: (typeof slots)[number]; isPrivate?: boolean },
): Promise<QueueItem> {
  const before = await getItem(id);
  if (!before) throw new QueueItemBusyError(id);
  const slot = patch.slot === undefined ? before.slot : z.enum(slots).parse(patch.slot);
  const moved = slot !== before.slot;
  const next: UploadStatus =
    moved && (before.state === 'conflict' || before.state === 'failed') ? INITIAL_STATUS : before;
  const db = await openQueue();
  const { changes } = await db.runAsync(
    `UPDATE queue_items SET slot = ?, is_private = ?, replace = ?, state = ?, attempts = ?, next_attempt_at = ?,
       last_error = ?
     WHERE id = ? AND state NOT IN ('uploading', 'uploaded')`,
    slot,
    (patch.isPrivate ?? before.isPrivate) ? 1 : 0,
    before.replace && !moved ? 1 : 0,
    next.state,
    next.attempts,
    next.nextAttemptAt,
    next.lastError,
    id,
  );
  if (changes === 0) throw new QueueItemBusyError(id);
  notify('status');
  const item = await getItem(id);
  if (!item) throw new QueueItemBusyError(id);
  return item;
}

/**
 * Re-crop of a queued moment (M2-23): swaps in the newly prepared full and thumbnail files (copied into
 * app storage) and deletes the old ones only after the row points at the new files. Edits, caption and
 * privacy stay. Throws QueueItemBusyError (and keeps the old photo) while uploading or once uploaded.
 */
export async function saveRecropped(id: number, files: { photoUri: string; thumbUri: string }): Promise<QueueItem> {
  const before = await getItem(id);
  if (!before) throw new QueueItemBusyError(id);
  const db = await openQueue();
  const dir = queueDir();
  const stem = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const copies: File[] = [];
  try {
    const photo = await copyInto(dir, files.photoUri, stem);
    copies.push(photo);
    const thumb = await copyInto(dir, files.thumbUri, `${stem}-thumb`);
    copies.push(thumb);
    const { changes } = await db.runAsync(
      `UPDATE queue_items SET photo_file = ?, thumb_file = ?, prepared = 1, crop = NULL
       WHERE id = ? AND state NOT IN ('uploading', 'uploaded')`,
      photo.name,
      thumb.name,
      id,
    );
    if (changes === 0) throw new QueueItemBusyError(id);
  } catch (error) {
    copies.forEach(deleteQuietly);
    throw error;
  }
  deleteQuietly(new File(before.photoUri));
  if (before.thumbUri) deleteQuietly(new File(before.thumbUri));
  notify('status');
  const after = await getItem(id);
  if (!after) throw new QueueItemBusyError(id);
  return after;
}

/**
 * Delete moment on a queued moment (M2-23): the photo never reaches the server. Throws
 * QueueItemBusyError while it is uploading or once it has been uploaded (then it is deleted on the server).
 */
export async function discardItem(id: number): Promise<void> {
  const item = await getItem(id);
  if (!item) throw new QueueItemBusyError(id);
  const db = await openQueue();
  const { changes } = await db.runAsync(
    "DELETE FROM queue_items WHERE id = ? AND state NOT IN ('uploading', 'uploaded')",
    id,
  );
  if (changes === 0) throw new QueueItemBusyError(id);
  deleteQuietly(new File(item.photoUri));
  if (item.thumbUri) deleteQuietly(new File(item.thumbUri));
  notify('removed');
}

/** Drops a row and its files, e.g. once the moment is on the server. The row goes first so no row points at a missing file. */
export async function removeItem(id: number): Promise<void> {
  const item = await getItem(id);
  if (!item) return;
  const db = await openQueue();
  await db.runAsync('DELETE FROM queue_items WHERE id = ?', id);
  deleteQuietly(new File(item.photoUri));
  if (item.thumbUri) deleteQuietly(new File(item.thumbUri));
  notify('removed');
}
