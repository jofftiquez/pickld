import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { UploaderClient } from '../uploader';

// Test doubles for the upload worker tests. expo-sqlite runs on a real SQLite (node:sqlite) so the
// queue store's SQL and migrations are exercised; expo-file-system is a map of URI → contents.
// Use from a test file with:
//   jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
//   jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);

export const disk = new DatabaseSync(':memory:');
export const files = new Map<string, string>();
/** Side effects in call order, shared by the fake network below. */
export const log: string[] = [];

export function resetFakes(): void {
  const table = disk.prepare("SELECT name FROM sqlite_master WHERE name = 'queue_items'").get();
  if (table) disk.exec('DELETE FROM queue_items');
  files.clear();
  log.length = 0;
}

const plain = (row: unknown) => (row ? { ...(row as object) } : null);

export const expoSqlite = {
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => {
      disk.exec(sql);
    },
    runAsync: async (sql: string, ...params: SQLInputValue[]) => {
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
  }),
};

type Part = string | { uri: string };
const join = (parts: Part[]): string =>
  parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .reduce((a, b) => `${a.replace(/\/$/, '')}/${b.replace(/^\//, '')}`);

class FakeDirectory {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  create(): void {}
}

class FakeFile {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get exists(): boolean {
    return files.has(this.uri);
  }
  get name(): string {
    return this.uri.split('/').pop() ?? '';
  }
  get extension(): string {
    const dot = this.name.lastIndexOf('.');
    return dot > 0 ? this.name.slice(dot) : '';
  }
  get size(): number {
    return Buffer.byteLength(files.get(this.uri) ?? '');
  }
  async copy(dest: FakeFile): Promise<void> {
    const data = files.get(this.uri);
    if (data === undefined) throw new Error(`cannot copy ${this.uri}`);
    files.set(dest.uri, data);
  }
  delete(): void {
    log.push(`delete:${this.name}`);
    files.delete(this.uri);
  }
}

export const expoFileSystem = {
  Directory: FakeDirectory,
  File: FakeFile,
  Paths: { document: new FakeDirectory('file:///docs') },
  UploadTask: class {
    constructor() {
      throw new Error('tests inject putFile');
    }
  },
};

export const USER = '6f1c1f7e-8a43-4c1e-9d0b-3c0f5d1e2a10';
export const JAR = '1d4f0c6e-2b7a-4e59-9a3c-5f8e7d6c5b4a';
const KEY_BASE = `moments/${USER}/0f0e0d0c-0b0a-4908-8706-050403020100`;

interface MomentRow {
  id: string;
  jar_id: string;
  slot: string;
  [column: string]: unknown;
}

/** A step of the pipeline that can be made to fail: the next `times` calls reject with `error`. */
export type Step = 'ensure_jar' | 'upload-url' | 'put' | 'insert' | 'insert-after-write' | 'moderate' | 'select';

/**
 * A fake Supabase backend: ensure_jar, fn:upload-url, the bucket and the moments table with its primary
 * key and the unique indexes of 0013: one moment per slot that isn't removed or a pending replacement
 * (moments_slot_holder_key), one pending replacement per moment (moments_one_replacement_key). fn:moderate
 * approves at once (D-22), swapping a replacement in for the moment it replaces. `failures` queues errors per step.
 */
export function fakeBackend() {
  const moments: MomentRow[] = [];
  const objects = new Map<string, string>();
  const failures = new Map<Step, unknown[]>();
  const uploadUrlBodies: unknown[] = [];
  const moderated: string[] = [];
  /** Every row the fake accepted, as sent. */
  const inserts: MomentRow[] = [];
  let uploads = 0;

  const failIfQueued = (step: Step) => {
    const queue = failures.get(step);
    if (queue && queue.length > 0) throw queue.shift();
  };

  const client = {
    rpc: async (fn: string, args: { local_date: string; tz: string }) => {
      log.push(`rpc:${fn}`);
      try {
        failIfQueued('ensure_jar');
      } catch (error) {
        return { data: null, error };
      }
      return { data: { id: JAR, local_date: args.local_date, tz: args.tz }, error: null };
    },
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        log.push(`fn:${name}`);
        if (name === 'moderate') {
          try {
            failIfQueued('moderate');
          } catch (error) {
            return { data: null, error };
          }
          const momentId = (options.body as { momentId: string }).momentId;
          moderated.push(momentId);
          const m = moments.find((row) => row.id === momentId);
          if (m && m.status === 'checking') {
            const old = moments.findIndex((row) => row.id === m.replaces && row.status !== 'removed');
            if (old >= 0) moments.splice(old, 1);
            m.status = 'live';
            m.replaces = null;
          }
          return { data: { data: { status: 'live' } }, error: null };
        }
        failIfQueued('upload-url'); // supabase-js rejects on a fetch failure
        uploadUrlBodies.push(options.body);
        uploads += 1;
        const signed = (variant: string) => ({
          key: `${KEY_BASE}-${uploads}/${variant}.jpg`,
          url: `https://s3.local/photos/${variant}-${uploads}?X-Amz-Signature=abc`,
          method: 'PUT',
          headers: { 'content-type': 'image/jpeg' },
        });
        return { data: { data: { files: { photo: signed('full'), thumb: signed('thumb') } } }, error: null };
      },
    },
    from: (table: string) => ({
      insert: async (row: MomentRow) => {
        log.push(`insert:${table}`);
        try {
          failIfQueued('insert');
        } catch (error) {
          return { data: null, error };
        }
        const holds = (m: MomentRow) => m.status !== 'removed' && (m.replaces ?? null) === null;
        const index = moments.some((m) => m.id === row.id)
          ? 'moments_pkey'
          : (row.replaces ?? null) === null &&
              moments.some((m) => holds(m) && m.jar_id === row.jar_id && m.slot === row.slot)
            ? 'moments_slot_holder_key'
            : row.replaces && moments.some((m) => m.replaces === row.replaces && m.status !== 'removed')
              ? 'moments_one_replacement_key'
              : null;
        if (index) {
          const message = `duplicate key value violates unique constraint "${index}"`;
          return { data: null, error: { code: '23505', message } };
        }
        if (row.replaces) {
          const target = moments.find((m) => m.id === row.replaces);
          if (!target || target.jar_id !== row.jar_id || target.slot !== row.slot || !holds(target)) {
            return { data: null, error: { code: '42501', message: 'a replacement must be for your own moment' } };
          }
        }
        inserts.push({ ...row });
        moments.push({ ...row });
        failIfQueued('insert-after-write'); // the row is written but the response never arrives
        return { data: null, error: null };
      },
      // select('id') with eq / neq / is filters, then maybeSingle (more than one match is an error, as in PostgREST).
      select: () => {
        const filters: ((m: MomentRow) => boolean)[] = [];
        const query = {
          eq: (column: string, value: unknown) => (filters.push((m) => m[column] === value), query),
          neq: (column: string, value: unknown) => (filters.push((m) => m[column] !== value), query),
          is: (column: string, value: null) => (filters.push((m) => (m[column] ?? null) === value), query),
          maybeSingle: async () => {
            log.push(`select:${table}`);
            try {
              failIfQueued('select');
            } catch (error) {
              return { data: null, error };
            }
            const found = moments.filter((m) => filters.every((f) => f(m)));
            if (found.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
            return { data: found[0] ? { id: found[0].id } : null, error: null };
          },
        };
        return query;
      },
    }),
  };

  const putFile = async (fileUri: string, target: { key: string }) => {
    log.push(`put:${target.key.split('/').pop() ?? ''}`);
    failIfQueued('put');
    const data = files.get(fileUri);
    if (data === undefined) throw new Error(`no local file ${fileUri}`);
    objects.set(target.key, data);
  };

  return {
    client: client as unknown as UploaderClient,
    putFile,
    moments,
    inserts,
    moderated,
    objects,
    uploadUrlBodies,
    failNext(step: Step, error: unknown, times = 1) {
      failures.set(step, [...(failures.get(step) ?? []), ...Array.from({ length: times }, () => error)]);
    },
  };
}

export const networkError = () => new TypeError('Network request failed');

/** Writes a processed photo and thumbnail where the capture flow would leave them. */
export function capturedFiles(name = 'IMG_0001'): { photoUri: string; thumbUri: string } {
  const photoUri = `file:///cache/${name}.jpg`;
  const thumbUri = `file:///cache/${name}-thumb.jpg`;
  files.set(photoUri, `jpeg:${name}:full-resolution-bytes`);
  files.set(thumbUri, `jpeg:${name}:thumb`);
  return { photoUri, thumbUri };
}
