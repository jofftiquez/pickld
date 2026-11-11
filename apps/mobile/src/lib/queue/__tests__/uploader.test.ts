import { BACKOFF_MS, MAX_ATTEMPTS } from '../machine';
import { enqueue, getItem, listQueue, savePrepared, type EnqueueInput, type QueueItem } from '../store';
import { drainQueue, uploadItem } from '../uploader';
import { capturedFiles, fakeBackend, files, JAR, log, networkError, resetFakes, USER } from './fakes';

jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);

const T0 = Date.UTC(2026, 10, 11, 3, 0, 0);
const MOMENT_ID = '9b2e4c1a-7d3f-4a6b-8c5d-1e2f3a4b5c6d';

async function queueMoment(overrides: Partial<EnqueueInput> = {}) {
  return enqueue({
    userId: USER,
    ...capturedFiles(),
    slot: 'ootd',
    localDate: '2026-11-11',
    tz: 'Asia/Manila',
    capturedAt: '2026-11-11T08:15:00+08:00',
    caption: 'new shoes',
    isPrivate: true,
    edits: { filter: 'warm' },
    ...overrides,
  });
}

const queuedFiles = () => [...files.keys()].filter((uri) => uri.startsWith('file:///docs/queue/'));

let backend: ReturnType<typeof fakeBackend>;
let clock: number;
const deps = () => ({ client: backend.client, putFile: backend.putFile, newId: () => MOMENT_ID, now: () => clock });

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
    expect(backend.moments).toEqual([
      {
        id: MOMENT_ID,
        jar_id: JAR,
        user_id: USER,
        slot: 'ootd',
        photo_path: expect.stringMatching(/\/full\.jpg$/),
        thumb_path: expect.stringMatching(/\/thumb\.jpg$/),
        caption: 'new shoes',
        captured_at: '2026-11-11T08:15:00+08:00',
        is_private: true,
        edits: { filter: 'warm' },
        status: 'checking',
      },
    ]);
    expect(backend.objects.get(backend.moments[0]?.photo_path as string)).toBe('jpeg:IMG_0001:full-resolution-bytes');
    expect(queuedFiles()).toEqual([]);
    expect(await listQueue(USER)).toEqual([]);
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

  it('finds its own row when an earlier insert landed but its response was lost', async () => {
    backend.failNext('insert-after-write', networkError());
    const item = await queueMoment();

    expect(await uploadItem(item, deps())).toMatchObject({ kind: 'retrying' });
    expect(queuedFiles()).toHaveLength(2);

    clock += BACKOFF_MS[0];
    const [outcome] = await drainQueue(USER, { ...deps(), newId: () => 'not-used-on-a-retry' });
    expect(outcome).toEqual({ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID });
    expect(backend.moments).toHaveLength(1);
    expect(queuedFiles()).toEqual([]);
  });

  it.each([
    ['ensure_jar', networkError()],
    ['upload-url', networkError()],
    ['put', networkError()],
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
  it('waits out the backoff after a network error, then uploads', async () => {
    backend.failNext('upload-url', networkError());
    const item = await queueMoment();

    expect(await drainQueue(USER, deps())).toEqual([expect.objectContaining({ kind: 'retrying' })]);

    clock += BACKOFF_MS[0] - 1;
    expect(await drainQueue(USER, deps())).toEqual([]);
    clock += 1;
    expect(await drainQueue(USER, deps())).toEqual([{ kind: 'uploaded', itemId: item.id, momentId: MOMENT_ID }]);
    expect(backend.moments).toHaveLength(1);
  });

  it('marks the item failed after the 5th network error and leaves the files', async () => {
    backend.failNext('upload-url', networkError(), MAX_ATTEMPTS);
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
