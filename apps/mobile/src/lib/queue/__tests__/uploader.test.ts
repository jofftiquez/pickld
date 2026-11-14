import { BACKOFF_MS, MAX_ATTEMPTS, OFFLINE_RETRY_MS } from '../machine';
import {
  EDIT_HOLD_MS,
  enqueue,
  getItem,
  listQueue,
  releaseEditing,
  replaceItem,
  saveEdits,
  savePrepared,
  type EnqueueInput,
  type QueueItem,
} from '../store';
import { drainQueue, uploadItem } from '../uploader';
import { capturedFiles, fakeBackend, files, JAR, log, networkError, resetFakes, USER } from './fakes';

jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);

const T0 = Date.UTC(2026, 10, 11, 3, 0, 0);
const MOMENT_ID = '9b2e4c1a-7d3f-4a6b-8c5d-1e2f3a4b5c6d';
const OLD_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

async function queueMoment(overrides: Partial<EnqueueInput> = {}) {
  return enqueue({
    userId: USER,
    ...capturedFiles(),
    slot: 'ootd',
    localDate: '2026-11-11',
    tz: 'Asia/Manila',
    capturedAt: '2026-11-11T08:15:00+08:00',
    caption: 'new shoes',
    visibility: 'only_me',
    edits: { filter: 'warm' },
    ...overrides,
  });
}

const queuedFiles = () => [...files.keys()].filter((uri) => uri.startsWith('file:///docs/queue/'));

let backend: ReturnType<typeof fakeBackend>;
let clock: number;
const deps = () => ({
  client: backend.client,
  putFile: backend.putFile,
  newId: () => MOMENT_ID,
  now: () => clock,
  makeMedium: async () => null,
  makeThumbhash: async () => null,
});

beforeEach(() => {
  resetFakes();
  backend = fakeBackend();
  clock = T0;
});

describe('uploadItem', () => {
  it('runs ensure_jar → upload-url → PUT photo → PUT thumbnail → insert, then deletes the files', async () => {
    const item = await queueMoment();
    log.length = 0;

    const outcome = await uploadItem(item, deps());

    expect(outcome).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(log).toEqual([
      'rpc:ensure_jar',
      'fn:upload-url',
      'put:full.jpg',
      'put:thumb.jpg',
      'insert:moments',
      'fn:moderate',
      expect.stringMatching(/^delete:.*\.jpg$/),
      expect.stringMatching(/^delete:.*-thumb\.jpg$/),
    ]);
    expect(backend.uploadUrlBodies).toEqual([
      {
        kind: 'moment',
        jarId: JAR,
        photo: { contentType: 'image/webp', size: Buffer.byteLength('jpeg:IMG_0001:full-resolution-bytes') },
        thumb: { contentType: 'image/webp', size: Buffer.byteLength('jpeg:IMG_0001:thumb') },
      },
    ]);
    // The server sets added_at and is_backfilled (rule 6); a new moment starts as checking (rule 4).
    expect(backend.inserts).toEqual([
      {
        id: MOMENT_ID,
        jar_id: JAR,
        user_id: USER,
        slot: 'ootd',
        photo_path: expect.stringMatching(/\/full\.jpg$/),
        thumb_path: expect.stringMatching(/\/thumb\.jpg$/),
        caption: 'new shoes',
        captured_at: '2026-11-11T08:15:00+08:00',
        visibility: 'only_me',
        edits: { filter: 'warm' },
        status: 'checking',
        replaces: null,
      },
    ]);
    expect(backend.objects.get(backend.moments[0]?.photo_path as string)).toBe('jpeg:IMG_0001:full-resolution-bytes');
    expect(queuedFiles()).toEqual([]);
    expect(await listQueue(USER)).toEqual([]);
  });

  it('uploads the medium feed copy with the moment, caches it, and deletes it after (NFR-PERF-02)', async () => {
    const item = await queueMoment();
    log.length = 0;
    const remembered: string[] = [];
    const makeMedium = jest.fn(async (fullUri: string) => {
      log.push('medium');
      files.set('file:///cache/medium.webp', `medium-of:${files.get(fullUri)}`);
      return 'file:///cache/medium.webp';
    });
    const remember = async (_uri: string, key: string) => {
      remembered.push(key.split('/').pop() ?? '');
    };

    expect(await uploadItem(item, { ...deps(), makeMedium, remember })).toMatchObject({ kind: 'uploaded' });

    expect(makeMedium).toHaveBeenCalledWith(item.photoUri);
    expect(log.slice(0, 6)).toEqual([
      'rpc:ensure_jar',
      'medium',
      'fn:upload-url',
      'put:full.jpg',
      'put:medium.jpg',
      'put:thumb.jpg',
    ]);
    expect(backend.uploadUrlBodies[0]).toMatchObject({
      medium: { contentType: 'image/webp', size: Buffer.byteLength('medium-of:jpeg:IMG_0001:full-resolution-bytes') },
    });
    const photoKey = backend.moments[0]?.photo_path as string;
    expect(backend.objects.get(photoKey.replace('full.jpg', 'medium.jpg'))).toBe(
      'medium-of:jpeg:IMG_0001:full-resolution-bytes',
    );
    expect(remembered.sort()).toEqual(['full.jpg', 'medium.jpg', 'thumb.jpg']);
    expect(files.has('file:///cache/medium.webp')).toBe(false);
  });

  it('sends the thumbnail’s ThumbHash with the upload (NFR-PERF-02)', async () => {
    const item = await queueMoment();
    const makeThumbhash = jest.fn(async () => '3OcRJYB4d3h/iIeHeEh3eIhw+j2w');
    expect(await uploadItem(item, { ...deps(), makeThumbhash })).toMatchObject({ kind: 'uploaded' });
    expect(makeThumbhash).toHaveBeenCalledWith(item.thumbUri);
    expect(backend.uploadUrlBodies[0]).toMatchObject({ thumbhash: '3OcRJYB4d3h/iIeHeEh3eIhw+j2w' });
  });

  it('still uploads, without a ThumbHash, when none could be made', async () => {
    const item = await queueMoment();
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'uploaded' });
    expect(backend.uploadUrlBodies[0]).not.toHaveProperty('thumbhash');
  });

  it('a failed attempt deletes its medium copy too, and the next attempt makes a new one', async () => {
    const item = await queueMoment();
    backend.failNext('put', networkError());
    const makeMedium = async () => {
      files.set('file:///cache/medium.webp', 'medium');
      return 'file:///cache/medium.webp';
    };
    expect(await uploadItem(item, { ...deps(), makeMedium })).toMatchObject({ kind: 'retrying' });
    expect(files.has('file:///cache/medium.webp')).toBe(false);
  });

  it('prepares a raw camera photo before any network call, then uploads the prepared files', async () => {
    const raw = await queueMoment({ thumbUri: null, prepared: false });
    log.length = 0;
    const prepare = jest.fn(async (item: QueueItem) => {
      log.push('prepare');
      files.set('file:///cache/p.webp', 'webp:full');
      files.set('file:///cache/p-thumb.webp', 'webp:thumb');
      return savePrepared(item.id, { photoUri: 'file:///cache/p.webp', thumbUri: 'file:///cache/p-thumb.webp' });
    });

    const outcome = await uploadItem(raw, { ...deps(), prepare });

    expect(outcome.kind).toBe('uploaded');
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ id: raw.id, prepared: false }));
    expect(log.filter((e) => !e.startsWith('delete:')).slice(0, 2)).toEqual(['prepare', 'rpc:ensure_jar']);
    expect(backend.objects.get(backend.moments[0]?.photo_path as string)).toBe('webp:full');
    expect(backend.objects.get(backend.moments[0]?.thumb_path as string)).toBe('webp:thumb');
  });

  it('never sends a raw photo: a failed preparation keeps the item and makes no network call', async () => {
    const raw = await queueMoment({ thumbUri: null, prepared: false });
    log.length = 0;
    const prepare = jest.fn(async () => {
      throw new Error('decode failed');
    });

    const outcome = await uploadItem(raw, { ...deps(), prepare });

    expect(outcome.kind).toBe('retrying');
    expect(log).toEqual([]);
    expect(await getItem(raw.id)).toMatchObject({
      prepared: false,
      attempts: 1,
      lastError: expect.stringContaining('decode failed'),
    });
  });

  it('refuses to upload an item that preparation left raw, even one with a thumbnail', async () => {
    const raw = await queueMoment({ prepared: false });
    log.length = 0;
    const outcome = await uploadItem(raw, { ...deps(), prepare: async (item) => item });
    expect(outcome.kind).toBe('retrying');
    expect(log).toEqual([]);
  });

  it('turns a taken slot into a conflict, not a failure, and keeps the photo for Replace', async () => {
    backend.moments.push({ id: 'aaaaaaaa-0000-4000-8000-000000000001', jar_id: JAR, slot: 'ootd' });
    const item = await queueMoment();

    const outcome = await uploadItem(item, deps());

    expect(outcome).toEqual({ kind: 'conflict', itemId: item.id, jarId: JAR, slot: 'ootd' });
    expect(await getItem(item.id)).toMatchObject({
      state: 'conflict',
      attempts: 0,
      nextAttemptAt: null,
      jarId: JAR,
      momentId: MOMENT_ID,
    });
    expect(queuedFiles()).toHaveLength(2);
    // Nothing retries a conflict on its own.
    log.length = 0;
    clock += BACKOFF_MS[4] * 2;
    expect(await drainQueue(USER, deps())).toEqual([]);
    expect(log).toEqual([]);
  });

  it('a taken slot is a conflict even when the server names the slot index (0013)', async () => {
    backend.moments.push({ id: OLD_ID, jar_id: JAR, slot: 'ootd', status: 'live', replaces: null });
    const item = await queueMoment();
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'conflict' });
    expect(backend.inserts).toEqual([]);
  });

  it('a removed moment does not hold its slot (D-27): the new photo uploads and the removed row stays', async () => {
    backend.moments.push({ id: OLD_ID, jar_id: JAR, slot: 'ootd', status: 'removed', replaces: null });
    const item = await queueMoment();
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'uploaded', momentId: MOMENT_ID });
    expect(backend.moments.map((m) => `${m.id}:${String(m.status)}`)).toEqual([
      `${OLD_ID}:removed`,
      `${MOMENT_ID}:live`,
    ]);
  });

  it('finds its own row when an earlier insert landed but its response was lost', async () => {
    backend.failNext('insert-after-write', networkError());
    const item = await queueMoment();

    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying' });
    expect(queuedFiles()).toHaveLength(2);

    clock += OFFLINE_RETRY_MS;
    const [outcome] = await drainQueue(USER, { ...deps(), newId: () => 'not-used-on-a-retry' });
    expect(outcome).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(backend.moments).toHaveLength(1);
    expect(queuedFiles()).toEqual([]);
  });

  it.each([
    ['ensure_jar', { message: 'canceling statement due to statement timeout', code: '57014' }],
    ['upload-url', { message: 'Edge Function returned a non-2xx status code' }],
    ['put', new Error('photo upload answered 503')],
    ['insert', { code: '42501', message: 'new row violates row-level security policy' }],
  ] as const)('keeps the files and backs off when %s fails', async (step, error) => {
    backend.failNext(step, error);
    const item = await queueMoment();

    const outcome = await uploadItem(item, deps());

    expect(outcome).toEqual({
      kind: 'retrying',
      itemId: item.id,
      error: error.message,
      nextAttemptAt: T0 + BACKOFF_MS[0],
    });
    expect(await getItem(item.id)).toMatchObject({ state: 'queued', attempts: 1, nextAttemptAt: T0 + BACKOFF_MS[0] });
    expect(queuedFiles()).toHaveLength(2);
    expect(backend.moments).toEqual([]);
    expect(log.some((entry) => entry.startsWith('delete:'))).toBe(false);
  });

  it('keeps the files when moderate fails, then moderates its own row on the retry', async () => {
    backend.failNext('moderate', { message: 'moderate unavailable' });
    const item = await queueMoment();

    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying', error: 'moderate unavailable' });
    expect(backend.moments).toHaveLength(1);
    expect(backend.moderated).toEqual([]);
    expect(queuedFiles()).toHaveLength(2);

    const retry = await getItem(item.id);
    clock = T0 + BACKOFF_MS[0];
    expect(await uploadItem(retry!, deps())).toEqual({
      kind: 'uploaded',
      itemId: item.id,
      momentId: MOMENT_ID,
    });
    expect(backend.moments).toHaveLength(1);
    expect(backend.moderated).toEqual([MOMENT_ID]);
    expect(queuedFiles()).toEqual([]);
  });

  it('fails without a thumbnail, before any network call', async () => {
    const item = await queueMoment({ thumbUri: null });
    log.length = 0;
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying', error: 'queued moment has no thumbnail' });
    expect(log).toEqual([]);
  });
});

describe('drainQueue', () => {
  it('waits out the backoff after a server error, then uploads', async () => {
    backend.failNext('upload-url', { message: 'Edge Function returned a non-2xx status code' });
    const item = await queueMoment();

    expect(await drainQueue(USER, deps())).toEqual([expect.objectContaining({ kind: 'retrying' })]);

    clock += BACKOFF_MS[0] - 1;
    expect(await drainQueue(USER, deps())).toEqual([]);
    clock += 1;
    expect(await drainQueue(USER, deps())).toEqual([{ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID }]);
    expect(backend.moments).toHaveLength(1);
  });

  it('marks the item failed after the 5th server error and leaves the files', async () => {
    backend.failNext('upload-url', { message: 'Edge Function returned a non-2xx status code' }, MAX_ATTEMPTS);
    const item = await queueMoment();
    const outcomes = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      outcomes.push(...(await drainQueue(USER, deps())));
      clock += BACKOFF_MS[4];
    }
    expect(outcomes.map((o) => o.kind)).toEqual(['retrying', 'retrying', 'retrying', 'retrying', 'failed']);
    expect(await getItem(item.id)).toMatchObject({ state: 'failed', attempts: MAX_ATTEMPTS });
    expect(await drainQueue(USER, deps())).toEqual([]);
    expect(queuedFiles()).toHaveLength(2);
  });

  it('never gives up on a photo while offline: network errors use no attempts (D-24)', async () => {
    backend.failNext('put', networkError(), MAX_ATTEMPTS * 2);
    const item = await queueMoment();
    for (let attempt = 0; attempt < MAX_ATTEMPTS * 2; attempt += 1) {
      expect(await drainQueue(USER, deps())).toEqual([
        { kind: 'retrying', itemId: item.id, error: 'Network request failed', nextAttemptAt: clock + OFFLINE_RETRY_MS },
      ]);
      clock += OFFLINE_RETRY_MS - 1;
      expect(await drainQueue(USER, deps())).toEqual([]);
      clock += 1;
    }
    expect(await getItem(item.id)).toMatchObject({ state: 'queued', attempts: 0 });
    expect(await drainQueue(USER, deps())).toEqual([{ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID }]);
  });

  it('uploads every due item oldest first and stops when told to', async () => {
    const a = await queueMoment({ slot: 'ootd' });
    const b = await queueMoment({ slot: 'selfie' });
    let ids = 0;
    const outcomes = await drainQueue(USER, {
      ...deps(),
      newId: () => `0000000${(ids += 1)}-0000-4000-8000-000000000000`,
    });
    expect(outcomes.map((o) => o.itemId)).toEqual([a.id, b.id]);

    await queueMoment({ slot: 'morning' });
    expect(await drainQueue(USER, deps(), () => false)).toEqual([]);
    expect(await listQueue(USER)).toHaveLength(1);
  });
});

describe('drainQueue and the editor (M2-12)', () => {
  it('holds a photo that is still in the editor, then uploads it with the saved caption, privacy and edits', async () => {
    const item = await queueMoment({ caption: null, visibility: 'readers', edits: {}, editing: true });
    clock = (item.editingSince ?? 0) + 1000;
    log.length = 0;

    expect(await drainQueue(USER, deps())).toEqual([]);
    expect(log).toEqual([]); // not even ensure_jar
    expect(await getItem(item.id)).toMatchObject({ state: 'queued', attempts: 0 });

    const edits = { v: 1, filter: 'dusk', overlays: [] };
    await saveEdits(item.id, { caption: 'Lunch break, finally!', visibility: 'only_me', edits });
    expect(await drainQueue(USER, deps())).toEqual([{ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID }]);
    expect(backend.inserts).toEqual([
      expect.objectContaining({ caption: 'Lunch break, finally!', visibility: 'only_me', edits, status: 'checking' }),
    ]);
  });

  it('uploads a photo closed without saving, as it was queued', async () => {
    const item = await queueMoment({ caption: null, visibility: 'readers', edits: {}, editing: true });
    clock = (item.editingSince ?? 0) + 1000;
    expect(await drainQueue(USER, deps())).toEqual([]);
    await releaseEditing(item.id);
    expect(await drainQueue(USER, deps())).toEqual([expect.objectContaining({ kind: 'uploaded' })]);
    expect(backend.moments).toEqual([expect.objectContaining({ caption: null, visibility: 'readers', edits: {} })]);
  });

  it('uploads a stale editing item once the hold lapses', async () => {
    const item = await queueMoment({ editing: true });
    clock = (item.editingSince ?? 0) + EDIT_HOLD_MS - 1;
    expect(await drainQueue(USER, deps())).toEqual([]);
    clock += 1;
    expect(await drainQueue(USER, deps())).toEqual([{ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID }]);
  });

  it('one photo in the editor does not hold up the others', async () => {
    const held = await queueMoment({ slot: 'ootd', editing: true });
    const ready = await queueMoment({ slot: 'selfie' });
    clock = (held.editingSince ?? 0) + 1000;
    expect(await drainQueue(USER, deps())).toEqual([expect.objectContaining({ kind: 'uploaded', itemId: ready.id })]);
    expect(await listQueue(USER)).toEqual([expect.objectContaining({ id: held.id, state: 'queued' })]);
  });
});

describe('Replace (M2-22)', () => {
  const holder = (status = 'live') => ({ id: OLD_ID, jar_id: JAR, slot: 'ootd', status, replaces: null });

  it('inserts a chosen replacement with replaces = the slot holder, then fn:moderate swaps it in', async () => {
    backend.moments.push(holder());
    const item = await queueMoment({ replace: true });
    log.length = 0;

    expect(await uploadItem(item, deps())).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(log.filter((e) => !e.startsWith('delete:'))).toEqual([
      'rpc:ensure_jar',
      'fn:upload-url',
      'put:full.jpg',
      'put:thumb.jpg',
      'select:moments',
      'insert:moments',
      'fn:moderate',
    ]);
    expect(backend.inserts).toEqual([expect.objectContaining({ id: MOMENT_ID, status: 'checking', replaces: OLD_ID })]);
    expect(backend.moments).toEqual([expect.objectContaining({ id: MOMENT_ID, status: 'live', replaces: null })]);
    expect(await listQueue(USER)).toEqual([]);
  });

  it('Replace after a conflict: the same item goes up again as a replacement', async () => {
    backend.moments.push(holder('checking'));
    const item = await queueMoment();
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'conflict' });

    await replaceItem(item.id);
    const [outcome] = await drainQueue(USER, deps());

    expect(outcome).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(backend.inserts).toEqual([expect.objectContaining({ id: MOMENT_ID, replaces: OLD_ID })]);
  });

  it('a replacement for a slot that is free by now (old one deleted or removed) is a plain insert', async () => {
    backend.moments.push(holder('removed'));
    const item = await queueMoment({ replace: true });
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'uploaded' });
    expect(backend.inserts).toEqual([expect.objectContaining({ id: MOMENT_ID, replaces: null })]);
  });

  it('a retry after a replacement whose response was lost finds its own row, already swapped in', async () => {
    backend.moments.push(holder());
    backend.failNext('insert-after-write', networkError());
    const item = await queueMoment({ replace: true });
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying' });

    clock += OFFLINE_RETRY_MS;
    const [outcome] = await drainQueue(USER, deps());
    expect(outcome).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(backend.inserts).toHaveLength(1);
    expect(backend.moments.map((m) => m.id)).toEqual([MOMENT_ID]);
  });

  it('a second pending replacement for the same moment is a conflict, not a failure', async () => {
    backend.moments.push(holder(), {
      id: 'bbbbbbbb-0000-4000-8000-000000000002',
      jar_id: JAR,
      slot: 'ootd',
      status: 'checking',
      replaces: OLD_ID,
    });
    const item = await queueMoment({ replace: true });
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'conflict' });
    expect(await getItem(item.id)).toMatchObject({ state: 'conflict', attempts: 0, replace: true });
  });

  it('a failed holder lookup retries with backoff and inserts nothing', async () => {
    backend.moments.push(holder());
    backend.failNext('select', { code: '500', message: 'boom' });
    const item = await queueMoment({ replace: true });
    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying', error: 'boom' });
    expect(backend.inserts).toEqual([]);
  });
});
