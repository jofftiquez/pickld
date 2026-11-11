import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { fail, start } from '../machine';
import type { EnqueueInput } from '../store';

// expo-sqlite runs on a real SQLite (node:sqlite) so the SQL and migrations are exercised for real.
// `mockDisk` outlives jest.resetModules(), which is how a test simulates an app restart.
let mockDisk = new DatabaseSync(':memory:');
let mockFailInsert = false;
// expo-file-system is an in-memory map of URI → contents.
const mockFs = new Map<string, string>();
const mockFailCopyOf = new Set<string>();
/** Side effects in order, to check that files are copied before the row is written. */
const mockLog: string[] = [];

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    const disk = mockDisk;
    const plain = (row: unknown) => (row ? { ...(row as object) } : null);
    return {
      execAsync: async (sql: string) => {
        disk.exec(sql);
      },
      runAsync: async (sql: string, ...params: SQLInputValue[]) => {
        const verb = sql.trim().split(/\s+/)[0] ?? '';
        mockLog.push(`sql:${verb}`);
        if (mockFailInsert && verb === 'INSERT') throw new Error('disk full');
        const result = disk.prepare(sql).run(...params);
        return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
      },
      getFirstAsync: async (sql: string, ...params: SQLInputValue[]) => plain(disk.prepare(sql).get(...params)),
      getAllAsync: async (sql: string, ...params: SQLInputValue[]) =>
        disk
          .prepare(sql)
          .all(...params)
          .map((row) => plain(row)),
      withTransactionAsync: async (task: () => Promise<void>) => {
        disk.exec('BEGIN');
        try {
          await task();
          disk.exec('COMMIT');
        } catch (error) {
          disk.exec('ROLLBACK');
          throw error;
        }
      },
    };
  },
}));

jest.mock('expo-file-system', () => {
  type MockPart = string | { uri: string };
  const join = (parts: MockPart[]): string =>
    parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .reduce((a, b) => `${a.replace(/\/$/, '')}/${b.replace(/^\//, '')}`);
  class Directory {
    readonly uri: string;
    constructor(...parts: MockPart[]) {
      this.uri = join(parts);
    }
    create(): void {
      mockLog.push(`mkdir:${this.uri}`);
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: MockPart[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return mockFs.has(this.uri);
    }
    get name(): string {
      return this.uri.split('/').pop() ?? '';
    }
    get extension(): string {
      const dot = this.name.lastIndexOf('.');
      return dot > 0 ? this.name.slice(dot) : '';
    }
    async copy(dest: File): Promise<void> {
      mockLog.push(`copy:${this.uri}`);
      const data = mockFs.get(this.uri);
      if (data === undefined || mockFailCopyOf.has(this.uri)) throw new Error(`cannot copy ${this.uri}`);
      mockFs.set(dest.uri, data);
    }
    delete(): void {
      mockFs.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: new Directory('file:///docs') } };
});

const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';
const OTHER_USER = '0b7d8a52-1f2e-4b3c-8d9e-aa11bb22cc33';
const GALLERY_PHOTO = 'file:///gallery/IMG_0001.jpg';
const GALLERY_THUMB = 'file:///cache/IMG_0001-thumb.jpg';

const input: EnqueueInput = {
  userId: USER,
  photoUri: GALLERY_PHOTO,
  thumbUri: GALLERY_THUMB,
  slot: 'ootd',
  localDate: '2026-11-11',
  tz: 'Asia/Manila',
  capturedAt: '2026-11-11T08:15:00+08:00',
  caption: 'new shoes',
  isPrivate: true,
  edits: { filter: 'warm' },
};

/** A fresh module instance: what the app sees after a restart. */
function loadStore(): typeof import('../store') {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../store') as typeof import('../store');
}

function queuedFiles(): string[] {
  return [...mockFs.keys()].filter((uri) => uri.startsWith('file:///docs/queue/'));
}

function rowCount(): number {
  return Number((mockDisk.prepare('SELECT count(*) AS n FROM queue_items').get() as { n: number }).n);
}

beforeEach(() => {
  mockDisk = new DatabaseSync(':memory:');
  mockFailInsert = false;
  mockFs.clear();
  mockFailCopyOf.clear();
  mockLog.length = 0;
  mockFs.set(GALLERY_PHOTO, 'photo-bytes');
  mockFs.set(GALLERY_THUMB, 'thumb-bytes');
});

describe('enqueue', () => {
  it('copies the photo and thumbnail into app storage before writing the row', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);

    const firstCopy = mockLog.indexOf(`copy:${GALLERY_PHOTO}`);
    const thumbCopy = mockLog.indexOf(`copy:${GALLERY_THUMB}`);
    const insert = mockLog.indexOf('sql:INSERT');
    expect(firstCopy).toBeGreaterThanOrEqual(0);
    expect(thumbCopy).toBeGreaterThan(firstCopy);
    expect(insert).toBeGreaterThan(thumbCopy);

    expect(item.photoUri).toMatch(/^file:\/\/\/docs\/queue\/.+\.jpg$/);
    expect(item.thumbUri).toMatch(/^file:\/\/\/docs\/queue\/.+-thumb\.jpg$/);
    expect(mockFs.get(item.photoUri)).toBe('photo-bytes');
    expect(mockFs.get(item.thumbUri ?? '')).toBe('thumb-bytes');
    expect(item).toMatchObject({
      userId: USER,
      slot: 'ootd',
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-11T08:15:00+08:00',
      caption: 'new shoes',
      isPrivate: true,
      edits: { filter: 'warm' },
      state: 'queued',
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    });
  });

  it('keeps the moment when the gallery original is deleted, across a restart', async () => {
    const queued = await loadStore().enqueue(input);
    mockFs.delete(GALLERY_PHOTO);
    mockFs.delete(GALLERY_THUMB);

    const [item, ...rest] = await loadStore().listQueue(USER);
    expect(rest).toHaveLength(0);
    expect(item).toEqual(queued);
    expect(mockFs.get(item?.photoUri ?? '')).toBe('photo-bytes');
    expect(mockFs.get(item?.thumbUri ?? '')).toBe('thumb-bytes');
  });

  it('writes no row when the photo copy fails', async () => {
    mockFailCopyOf.add(GALLERY_PHOTO);
    const store = loadStore();
    await expect(store.enqueue(input)).rejects.toThrow(`cannot copy ${GALLERY_PHOTO}`);
    expect(mockLog).not.toContain('sql:INSERT');
    expect(rowCount()).toBe(0);
    expect(queuedFiles()).toEqual([]);
    expect(mockFs.get(GALLERY_PHOTO)).toBe('photo-bytes');
  });

  it('writes no row and removes the photo copy when the thumbnail copy fails', async () => {
    mockFailCopyOf.add(GALLERY_THUMB);
    await expect(loadStore().enqueue(input)).rejects.toThrow(`cannot copy ${GALLERY_THUMB}`);
    expect(mockLog).not.toContain('sql:INSERT');
    expect(rowCount()).toBe(0);
    expect(queuedFiles()).toEqual([]);
  });

  it('removes the copies when the row cannot be written', async () => {
    mockFailInsert = true;
    await expect(loadStore().enqueue(input)).rejects.toThrow('disk full');
    expect(rowCount()).toBe(0);
    expect(queuedFiles()).toEqual([]);
  });

  it('rejects an offset instead of an IANA time zone before touching any file', async () => {
    const store = loadStore();
    await expect(store.enqueue({ ...input, tz: '+08:00' })).rejects.toThrow('IANA');
    await expect(store.enqueue({ ...input, tz: 'Mars/Olympus' })).rejects.toThrow('Unknown time zone');
    expect(mockLog.filter((e) => e.startsWith('copy:'))).toEqual([]);
  });

  it('works without a thumbnail', async () => {
    const item = await loadStore().enqueue({ ...input, thumbUri: undefined });
    expect(item.thumbUri).toBeNull();
    expect(queuedFiles()).toEqual([item.photoUri]);
  });
});

describe('queue storage', () => {
  it('migrates once to the latest user_version', async () => {
    const store = loadStore();
    await store.openQueue();
    expect(mockDisk.prepare('PRAGMA user_version').get()).toEqual(
      expect.objectContaining({ user_version: store.MIGRATIONS.length }),
    );
    // A second launch must not try to create the table again.
    await expect(loadStore().openQueue()).resolves.toBeDefined();
  });

  it('upgrades a version 1 queue without losing its moments, and keeps upload refs', async () => {
    const store = loadStore();
    mockDisk.exec(store.MIGRATIONS[0] ?? '');
    mockDisk.exec('PRAGMA user_version = 1');
    mockFs.set('file:///docs/queue/old.jpg', 'photo-bytes');
    mockDisk
      .prepare(
        `INSERT INTO queue_items (user_id, photo_file, slot, local_date, tz, created_at)
         VALUES (?, 'old.jpg', 'selfie', '2026-11-10', 'Asia/Manila', 1)`,
      )
      .run(USER);

    const [old] = await store.listQueue(USER);
    expect(old).toMatchObject({ slot: 'selfie', state: 'queued', jarId: null, momentId: null });

    const refs = { jarId: '1d4f0c6e-2b7a-4e59-9a3c-5f8e7d6c5b4a', momentId: '9b2e4c1a-7d3f-4a6b-8c5d-1e2f3a4b5c6d' };
    await store.saveUploadRefs(old?.id ?? 0, refs);
    expect(await loadStore().getItem(old?.id ?? 0)).toMatchObject(refs);
  });

  it('lists only the signed-in user’s moments, oldest first', async () => {
    const store = loadStore();
    const a = await store.enqueue(input);
    await store.enqueue({ ...input, userId: OTHER_USER });
    const b = await store.enqueue({ ...input, slot: 'selfie' });
    expect((await store.listQueue(USER)).map((i) => i.id)).toEqual([a.id, b.id]);
  });

  it('persists 5 failures as failed, and Retry resets it, across restarts', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 10, 11, 0, 0, 0) });
    try {
      let store = loadStore();
      let item = await store.enqueue(input);
      for (let i = 0; i < 5; i += 1) {
        item = fail(start(item), 'offline');
        await store.saveStatus(item);
        jest.advanceTimersByTime(10 * 60 * 1000);
      }
      store = loadStore();
      expect(await store.getItem(item.id)).toMatchObject({ state: 'failed', attempts: 5, lastError: 'offline' });

      const reset = await store.retryItem(item.id);
      expect(reset).toMatchObject({ state: 'queued', attempts: 0, nextAttemptAt: null, lastError: null });
      expect(await loadStore().getItem(item.id)).toEqual(reset);
    } finally {
      jest.useRealTimers();
    }
  });

  it('puts an upload cut short by a restart back in the queue', async () => {
    let store = loadStore();
    const item = await store.enqueue(input);
    await store.saveStatus(start(item));
    store = loadStore();
    expect(await store.getItem(item.id)).toMatchObject({ state: 'queued', attempts: 0 });
  });

  it('removes the row and its files', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    await store.removeItem(item.id);
    expect(await store.getItem(item.id)).toBeNull();
    expect(queuedFiles()).toEqual([]);
  });

  it('tells subscribers about every change Today shows: added, status, removed (M2-06)', async () => {
    const store = loadStore();
    const changes: string[] = [];
    const unsubscribe = store.subscribeQueue((change) => changes.push(change));
    const item = await store.enqueue(input);
    await store.saveStatus(start(item));
    await store.removeItem(item.id);
    unsubscribe();
    await store.enqueue(input);
    expect(changes).toEqual(['added', 'status', 'removed']);
  });
});
