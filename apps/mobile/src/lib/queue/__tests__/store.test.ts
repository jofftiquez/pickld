import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { conflict, fail, start } from '../machine';
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

  it('treats moments queued before migration 2 as prepared', async () => {
    const store = loadStore();
    mockDisk.exec(store.MIGRATIONS[0] ?? '');
    mockDisk.exec(store.MIGRATIONS[1] ?? '');
    mockDisk.exec('PRAGMA user_version = 2');
    mockDisk
      .prepare(
        `INSERT INTO queue_items (user_id, photo_file, slot, local_date, tz, created_at)
         VALUES (?, 'old.jpg', 'selfie', '2026-11-10', 'Asia/Manila', 1)`,
      )
      .run(USER);
    const [old] = await store.listQueue(USER);
    expect(old?.prepared).toBe(true);
  });

  it('keeps a raw camera photo across a restart (queued at the shutter, before preparing)', async () => {
    await loadStore().enqueue({ ...input, thumbUri: null, prepared: false });
    mockFs.delete(GALLERY_PHOTO); // the camera's temp file is gone after a kill
    const [item] = await loadStore().listQueue(USER);
    expect(item).toMatchObject({ prepared: false, thumbUri: null, slot: 'ootd' });
    expect(mockFs.get(item?.photoUri ?? '')).toBe('photo-bytes');
  });

  it('swaps the prepared files in, then deletes the raw photo', async () => {
    const store = loadStore();
    const raw = await store.enqueue({ ...input, thumbUri: null, prepared: false });
    mockFs.set('file:///cache/out.webp', 'webp-full');
    mockFs.set('file:///cache/out-thumb.webp', 'webp-thumb');
    mockLog.length = 0;

    const done = await store.savePrepared(raw.id, {
      photoUri: 'file:///cache/out.webp',
      thumbUri: 'file:///cache/out-thumb.webp',
    });

    expect(done.prepared).toBe(true);
    expect(mockFs.get(done.photoUri)).toBe('webp-full');
    expect(mockFs.get(done.thumbUri ?? '')).toBe('webp-thumb');
    expect(mockFs.has(raw.photoUri)).toBe(false);
    expect(mockLog.indexOf('sql:UPDATE')).toBeGreaterThan(mockLog.indexOf('copy:file:///cache/out-thumb.webp'));
    expect(await loadStore().getItem(raw.id)).toEqual(done);
    expect(queuedFiles().sort()).toEqual([done.photoUri, done.thumbUri].sort());
  });

  it('keeps the raw photo when copying a prepared file fails', async () => {
    const store = loadStore();
    const raw = await store.enqueue({ ...input, thumbUri: null, prepared: false });
    mockFs.set('file:///cache/out.webp', 'webp-full');
    mockFs.set('file:///cache/out-thumb.webp', 'webp-thumb');
    mockFailCopyOf.add('file:///cache/out-thumb.webp');

    await expect(
      store.savePrepared(raw.id, { photoUri: 'file:///cache/out.webp', thumbUri: 'file:///cache/out-thumb.webp' }),
    ).rejects.toThrow('cannot copy');
    expect(await store.getItem(raw.id)).toEqual(raw);
    expect(queuedFiles()).toEqual([raw.photoUri]);
  });

  it('drops the second set of copies when two preparations race', async () => {
    const store = loadStore();
    const raw = await store.enqueue({ ...input, thumbUri: null, prepared: false });
    mockFs.set('file:///cache/a.webp', 'a');
    mockFs.set('file:///cache/a-thumb.webp', 'a-thumb');
    mockFs.set('file:///cache/b.webp', 'b');
    mockFs.set('file:///cache/b-thumb.webp', 'b-thumb');

    const first = await store.savePrepared(raw.id, {
      photoUri: 'file:///cache/a.webp',
      thumbUri: 'file:///cache/a-thumb.webp',
    });
    const second = await store.savePrepared(raw.id, {
      photoUri: 'file:///cache/b.webp',
      thumbUri: 'file:///cache/b-thumb.webp',
    });

    expect(second).toEqual(first);
    expect(mockFs.get(second.photoUri)).toBe('a');
    expect(queuedFiles().sort()).toEqual([first.photoUri, first.thumbUri].sort());
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

describe('editing hold and saved edits (M2-12)', () => {
  const edits = { v: 1, filter: 'mono', overlays: [] };

  it('a photo queued for the editor records when the hold began; others have none', async () => {
    const store = loadStore();
    const before = Date.now();
    const held = await store.enqueue({ ...input, editing: true });
    const plain = await store.enqueue(input);
    expect(held.editingSince).toEqual(expect.any(Number));
    expect(held.editingSince ?? 0).toBeGreaterThanOrEqual(before);
    expect(store.isHeldForEditing(held)).toBe(true);
    expect(plain.editingSince).toBeNull();
    expect(store.isHeldForEditing(plain)).toBe(false);
  });

  it('a hold lapses after EDIT_HOLD_MS, so a forgotten edit never strands the photo', () => {
    const store = loadStore();
    const since = Date.UTC(2026, 10, 11, 3);
    expect(store.isHeldForEditing({ editingSince: since }, since + store.EDIT_HOLD_MS - 1)).toBe(true);
    expect(store.isHeldForEditing({ editingSince: since }, since + store.EDIT_HOLD_MS)).toBe(false);
  });

  it('saveEdits stores caption, privacy and edits, ends the hold, and survives a restart', async () => {
    let store = loadStore();
    const item = await store.enqueue({ ...input, caption: null, isPrivate: false, edits: {}, editing: true });
    const filesBefore = new Map(mockFs);

    const saved = await store.saveEdits(item.id, { caption: 'Lunch break, finally!', isPrivate: true, edits });
    expect(saved).toMatchObject({ caption: 'Lunch break, finally!', isPrivate: true, edits, editingSince: null });
    // Data only: the photo and thumbnail files and their paths are untouched (FR-CAP-08).
    expect(new Map(mockFs)).toEqual(filesBefore);
    expect(saved.photoUri).toBe(item.photoUri);
    expect(saved.thumbUri).toBe(item.thumbUri);

    store = loadStore();
    expect(await store.getItem(item.id)).toMatchObject({ caption: 'Lunch break, finally!', isPrivate: true, edits });
  });

  it('saveEdits can clear a caption and turn privacy back off', async () => {
    const store = loadStore();
    const item = await store.enqueue(input); // caption 'new shoes', private
    expect(await store.saveEdits(item.id, { caption: null, isPrivate: false, edits })).toMatchObject({
      caption: null,
      isPrivate: false,
    });
  });

  it('saveEdits refuses a caption over 150 characters (moments.caption limit), changing nothing', async () => {
    const store = loadStore();
    const item = await store.enqueue({ ...input, editing: true });
    await expect(store.saveEdits(item.id, { caption: 'x'.repeat(151), isPrivate: false, edits })).rejects.toThrow();
    expect(await store.getItem(item.id)).toMatchObject({ caption: 'new shoes', edits: input.edits });
    expect((await store.getItem(item.id))?.editingSince).not.toBeNull();
    await expect(store.saveEdits(item.id, { caption: 'x'.repeat(150), isPrivate: false, edits })).resolves.toBeTruthy();
  });

  it('saveEdits on a moment that left the queue throws instead of pretending', async () => {
    await expect(loadStore().saveEdits(999, { caption: null, isPrivate: false, edits })).rejects.toThrow(/999/);
  });

  it('saveEdits tells Today the item changed', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    const changes: string[] = [];
    const unsubscribe = store.subscribeQueue((change) => changes.push(change));
    await store.saveEdits(item.id, { caption: null, isPrivate: false, edits });
    unsubscribe();
    expect(changes).toEqual(['status']);
  });

  it('releaseEditing ends the hold and keeps everything else', async () => {
    const store = loadStore();
    const item = await store.enqueue({ ...input, editing: true });
    await store.releaseEditing(item.id);
    const after = await store.getItem(item.id);
    expect(after).toEqual({ ...item, editingSince: null });
    await expect(store.releaseEditing(999)).resolves.toBeUndefined();
  });

  it('a hold left by a killed app is cleared on the next launch', async () => {
    const item = await loadStore().enqueue({ ...input, editing: true });
    expect(item.editingSince).not.toBeNull();
    expect((await loadStore().getItem(item.id))?.editingSince).toBeNull();
  });

  it('upgrades a version 3 queue: existing moments are not held', async () => {
    const store = loadStore();
    store.MIGRATIONS.slice(0, 3).forEach((sql) => mockDisk.exec(sql));
    mockDisk.exec('PRAGMA user_version = 3');
    mockDisk
      .prepare(
        `INSERT INTO queue_items (user_id, photo_file, slot, local_date, tz, created_at)
         VALUES (?, 'old.jpg', 'selfie', '2026-11-10', 'Asia/Manila', 1)`,
      )
      .run(USER);
    const [old] = await store.listQueue(USER);
    expect(old).toMatchObject({ slot: 'selfie', editingSince: null, prepared: true });
    expect(mockDisk.prepare('PRAGMA user_version').get()).toEqual(
      expect.objectContaining({ user_version: store.MIGRATIONS.length }),
    );
  });
});

describe('Crop screen choices on a raw gallery photo (M2-10)', () => {
  const spec = {
    crop: { originX: 120, originY: 0, width: 1500, height: 2000 },
    cropBasis: { width: 4000, height: 2000 },
    rotate: 90,
    flip: true,
  } as const;

  it('stores the crop with the raw photo and reads it back after a restart', async () => {
    const item = await loadStore().enqueue({ ...input, thumbUri: null, prepared: false, crop: spec });
    expect(item.crop).toEqual(spec);
    expect(await loadStore().getItem(item.id)).toMatchObject({ prepared: false, crop: spec });
  });

  it('a photo without crop choices has none (camera photos, exactly 3:4 gallery photos)', async () => {
    expect((await loadStore().enqueue(input)).crop).toBeNull();
  });

  it('refuses a rotation that is not a quarter turn before copying anything', async () => {
    const store = loadStore();
    await expect(store.enqueue({ ...input, crop: { ...spec, rotate: 45 as 90 } })).rejects.toThrow();
    expect(queuedFiles()).toEqual([]);
    expect(mockLog.filter((entry) => entry.startsWith('copy:') || entry === 'sql:INSERT')).toEqual([]);
  });

  it('upgrades a version 4 queue: existing moments have no crop', async () => {
    const store = loadStore();
    store.MIGRATIONS.slice(0, 4).forEach((sql) => mockDisk.exec(sql));
    mockDisk.exec('PRAGMA user_version = 4');
    mockDisk
      .prepare(
        `INSERT INTO queue_items (user_id, photo_file, slot, local_date, tz, created_at, prepared)
         VALUES (?, 'raw.jpg', 'selfie', '2026-11-10', 'Asia/Manila', 1, 0)`,
      )
      .run(USER);
    const [old] = await store.listQueue(USER);
    expect(old).toMatchObject({ slot: 'selfie', prepared: false, crop: null });
    expect(mockDisk.prepare('PRAGMA user_version').get()).toEqual(expect.objectContaining({ user_version: 6 }));
  });
});

describe('Replace (M2-22)', () => {
  it('upgrades a version 5 queue: existing moments are not replacements', async () => {
    const store = loadStore();
    store.MIGRATIONS.slice(0, 5).forEach((sql) => mockDisk.exec(sql));
    mockDisk.exec('PRAGMA user_version = 5');
    mockDisk
      .prepare(
        `INSERT INTO queue_items (user_id, photo_file, slot, local_date, tz, created_at, state)
         VALUES (?, 'old.jpg', 'selfie', '2026-11-10', 'Asia/Manila', 1, 'conflict')`,
      )
      .run(USER);
    const [old] = await store.listQueue(USER);
    expect(old).toMatchObject({ slot: 'selfie', state: 'conflict', replace: false });
    expect(mockDisk.prepare('PRAGMA user_version').get()).toEqual(expect.objectContaining({ user_version: 6 }));
  });

  it('enqueues a plain photo by default and a chosen replacement when asked', async () => {
    const store = loadStore();
    expect((await store.enqueue(input)).replace).toBe(false);
    const chosen = await store.enqueue({ ...input, replace: true });
    expect((await loadStore().getItem(chosen.id))?.replace).toBe(true);
  });

  it('Replace marks a conflict as a replacement and queues it again from attempt 0, across restarts', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    await store.saveStatus(fail(start(item), 'timeout'));
    jest.useFakeTimers({ now: Date.now() + 60_000 });
    try {
      const failedOnce = await store.getItem(item.id);
      await store.saveStatus(conflict(start(failedOnce ?? item), 'slot already has a moment'));
    } finally {
      jest.useRealTimers();
    }
    const changes: string[] = [];
    const unsubscribe = store.subscribeQueue((change) => changes.push(change));
    const replaced = await store.replaceItem(item.id);
    unsubscribe();
    expect(replaced).toMatchObject({
      state: 'queued',
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
      replace: true,
    });
    expect(await loadStore().getItem(item.id)).toEqual(replaced);
    expect(changes).toEqual(['status']);
  });

  it('refuses Replace on an item that is not a conflict, and changes nothing', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    await expect(store.replaceItem(item.id)).rejects.toThrow('Cannot replace an item that is queued');
    expect(await store.getItem(item.id)).toMatchObject({ state: 'queued', replace: false });
    await expect(store.replaceItem(999)).rejects.toThrow('No queued moment 999');
  });
});

describe('Moment options on a queued moment (M2-23)', () => {
  it('Make private and Move keep the photo, caption and edits, across a restart', async () => {
    const store = loadStore();
    const item = await store.enqueue({ ...input, isPrivate: false });
    const changes: string[] = [];
    const unsubscribe = store.subscribeQueue((change) => changes.push(change));
    await store.saveOptions(item.id, { isPrivate: true });
    const moved = await store.saveOptions(item.id, { slot: 'evening' });
    unsubscribe();
    expect(moved).toMatchObject({ slot: 'evening', isPrivate: true, caption: 'new shoes', edits: { filter: 'warm' } });
    expect(moved.photoUri).toBe(item.photoUri);
    expect(await loadStore().getItem(item.id)).toEqual(moved);
    expect(changes).toEqual(['status', 'status']);
  });

  it('a stopped photo moved to another slot uploads again from attempt 0, without its Replace choice', async () => {
    const store = loadStore();
    const item = await store.enqueue({ ...input, replace: true });
    await store.saveStatus(conflict(start(item), 'slot already has a moment'));
    const moved = await store.saveOptions(item.id, { slot: 'selfie' });
    expect(moved).toMatchObject({ slot: 'selfie', state: 'queued', attempts: 0, nextAttemptAt: null, lastError: null });
    expect(moved.replace).toBe(false);
  });

  it('privacy alone leaves a failed photo failed and keeps its Replace choice', async () => {
    const store = loadStore();
    const item = await store.enqueue({ ...input, replace: true });
    let failed = { ...item };
    for (let i = 0; i < 5; i += 1) failed = { ...failed, ...fail(start(failed), 'server error', 0) };
    await store.saveStatus(failed);
    const changed = await store.saveOptions(item.id, { isPrivate: false, slot: 'ootd' });
    expect(changed).toMatchObject({ state: 'failed', attempts: 5, replace: true, isPrivate: false });
  });

  it('refuses every change while the photo is uploading, and changes nothing', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    await store.saveStatus(start(item));
    await expect(store.saveOptions(item.id, { slot: 'evening' })).rejects.toBeInstanceOf(store.QueueItemBusyError);
    await expect(store.discardItem(item.id)).rejects.toBeInstanceOf(store.QueueItemBusyError);
    mockFs.set('file:///cache/re.webp', 're-full');
    mockFs.set('file:///cache/re-thumb.webp', 're-thumb');
    await expect(
      store.saveRecropped(item.id, { photoUri: 'file:///cache/re.webp', thumbUri: 'file:///cache/re-thumb.webp' }),
    ).rejects.toBeInstanceOf(store.QueueItemBusyError);
    expect(await store.getItem(item.id)).toMatchObject({ slot: 'ootd', state: 'uploading', photoUri: item.photoUri });
    expect(mockFs.get(item.photoUri)).toBe('photo-bytes');
    expect(queuedFiles().sort()).toEqual([item.photoUri, item.thumbUri].sort());
  });

  it('refuses a moment that already left the queue', async () => {
    const store = loadStore();
    await expect(store.saveOptions(404, { isPrivate: true })).rejects.toBeInstanceOf(store.QueueItemBusyError);
    await expect(store.discardItem(404)).rejects.toBeInstanceOf(store.QueueItemBusyError);
  });

  it('Re-crop swaps in the new files after the row points at them, then deletes the old ones', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    mockFs.set('file:///cache/re.webp', 're-full');
    mockFs.set('file:///cache/re-thumb.webp', 're-thumb');
    mockLog.length = 0;
    const done = await store.saveRecropped(item.id, {
      photoUri: 'file:///cache/re.webp',
      thumbUri: 'file:///cache/re-thumb.webp',
    });
    expect(mockFs.get(done.photoUri)).toBe('re-full');
    expect(mockFs.get(done.thumbUri ?? '')).toBe('re-thumb');
    expect(done).toMatchObject({ prepared: true, crop: null, caption: 'new shoes', edits: { filter: 'warm' } });
    expect(mockLog.indexOf('sql:UPDATE')).toBeGreaterThan(mockLog.indexOf('copy:file:///cache/re-thumb.webp'));
    expect(queuedFiles().sort()).toEqual([done.photoUri, done.thumbUri].sort());
    expect(await loadStore().getItem(item.id)).toEqual(done);
  });

  it('Delete drops the row and both files', async () => {
    const store = loadStore();
    const item = await store.enqueue(input);
    await store.discardItem(item.id);
    expect(await store.getItem(item.id)).toBeNull();
    expect(queuedFiles()).toEqual([]);
  });
});
