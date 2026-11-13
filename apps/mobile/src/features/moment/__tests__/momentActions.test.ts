import { discardItem, QueueItemBusyError, saveEdits, saveOptions, saveRecropped } from '@/lib/queue/store';

import {
  deleteMoment,
  MomentOptionError,
  moveMoment,
  saveMomentEdits,
  saveRecrop,
  setJarCover,
  setMomentVisibility,
  type MomentsClient,
  type MomentTarget,
} from '../momentActions';

// What each Moment option does (M2-23): the queue for a photo not uploaded yet, the server otherwise, and how
// failures become the sheet's messages. The same calls run against local Supabase in
// momentActions.integration.test.ts.

jest.mock('@/lib/queue/store', () => {
  const actual = jest.requireActual<typeof import('@/lib/queue/store')>('@/lib/queue/store');
  return {
    QueueItemBusyError: actual.QueueItemBusyError,
    saveOptions: jest.fn(async () => ({})),
    saveEdits: jest.fn(async () => ({})),
    saveRecropped: jest.fn(async () => ({})),
    discardItem: jest.fn(async () => undefined),
  };
});
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({ File: class {}, UploadTask: class {} }));

const MOMENT = '0f1e2d3c-4b5a-4968-8776-655443322110';
const JAR = '11111111-2222-4333-8444-555555555555';
const server: MomentTarget = { kind: 'server', momentId: MOMENT, jarId: JAR };
const queued: MomentTarget = { kind: 'queued', queueId: 21 };

type Result = { data: unknown; error: { code?: string; message?: string } | null };

/** A Supabase client double that records every call in order and answers from `answers`. */
function fakeClient(answers: { update?: Result; delete?: Result; invoke?: Record<string, Result> } = {}) {
  const calls: string[] = [];
  const updates: unknown[] = [];
  const bodies: Record<string, unknown> = {};
  const chain = (result: Result) => ({
    eq: (column: string, value: string) => {
      calls.push(`eq:${column}=${value}`);
      return { select: async () => result };
    },
  });
  const client = {
    from: (table: string) => ({
      update: (patch: unknown) => {
        calls.push(`update:${table}`);
        updates.push(patch);
        return chain(answers.update ?? { data: [{ id: MOMENT }], error: null });
      },
      delete: () => {
        calls.push(`delete:${table}`);
        return chain(answers.delete ?? { data: [{ id: MOMENT }], error: null });
      },
    }),
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push(`invoke:${name}`);
        bodies[name] = options.body;
        return answers.invoke?.[name] ?? { data: { data: {} }, error: null };
      },
    },
  } as unknown as MomentsClient;
  return { client, calls, updates, bodies };
}

const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof MomentOptionError ? error.reason : `unexpected ${String(error)}`),
  );

beforeEach(() => jest.clearAllMocks());

describe('uploaded moments', () => {
  it('Move updates only the slot of that moment', async () => {
    const { client, calls, updates } = fakeClient();
    await moveMoment(client, server, 'evening');
    expect(calls).toEqual(['update:moments', `eq:id=${MOMENT}`]);
    expect(updates).toEqual([{ slot: 'evening' }]);
  });

  it('turns server refusals into the sheet’s reasons', async () => {
    const answer = (update: Result) => reason(moveMoment(fakeClient({ update }).client, server, 'evening'));
    expect(await answer({ data: null, error: { code: '23505' } })).toBe('slotTaken');
    expect(await answer({ data: null, error: { code: '42501' } })).toBe('refused'); // being replaced (0013)
    expect(await answer({ data: [], error: null })).toBe('refused'); // RLS: not the owner's, or gone
    expect(await answer({ data: null, error: { message: 'Network request failed' } })).toBe('failed');
  });

  it('Visibility is a plain update and needs no moderation', async () => {
    const { client, calls, updates } = fakeClient();
    await setMomentVisibility(client, server, 'only_me');
    expect(updates).toEqual([{ visibility: 'only_me' }]);
    expect(calls).not.toContain('invoke:moderate');
  });

  it('Set as cover updates only the jar’s cover_moment_id (D-56) and turns refusals into reasons', async () => {
    const { client, calls, updates } = fakeClient();
    await setJarCover(client, JAR, MOMENT);
    expect(calls).toEqual(['update:jars', `eq:id=${JAR}`]);
    expect(updates).toEqual([{ cover_moment_id: MOMENT }]);
    const answer = (update: Result) => reason(setJarCover(fakeClient({ update }).client, JAR, MOMENT));
    expect(await answer({ data: null, error: { code: '23514' } })).toBe('refused'); // not a moment of this jar
    expect(await answer({ data: null, error: { code: '42501' } })).toBe('refused'); // not live (0069)
    expect(await answer({ data: [], error: null })).toBe('refused'); // RLS: not the owner's jar
    expect(await answer({ data: null, error: { message: 'Network request failed' } })).toBe('failed');
  });

  it('Delete refuses when no row was deleted', async () => {
    expect(await reason(deleteMoment(fakeClient().client, server))).toBe('ok');
    expect(await reason(deleteMoment(fakeClient({ delete: { data: [], error: null } }).client, server))).toBe(
      'refused',
    );
  });

  it('saving edits proposes caption and edits, then asks fn:moderate to swap them in', async () => {
    const { client, calls, updates, bodies } = fakeClient();
    const edits = { v: 1, filter: 'mono', overlays: [] };
    await saveMomentEdits(client, server, { caption: 'hi', visibility: 'readers', edits });
    expect(calls).toEqual(['update:moments', `eq:id=${MOMENT}`, 'invoke:moderate']);
    expect(updates).toEqual([{ caption: 'hi', edits, visibility: 'readers' }]);
    expect(bodies.moderate).toEqual({ momentId: MOMENT });

    const lost = fakeClient({ invoke: { moderate: { data: null, error: { message: 'timeout' } } } });
    expect(await reason(saveMomentEdits(lost.client, server, { caption: null, visibility: 'readers', edits }))).toBe(
      'failed',
    );
  });

  it('Re-crop uploads photo and thumbnail to their own signed URLs, then proposes their keys and moderates', async () => {
    const signed = (key: string) => ({ key, url: `http://127.0.0.1:55421/${key}`, method: 'PUT', headers: { a: key } });
    const { client, calls, updates, bodies } = fakeClient({
      invoke: {
        'upload-url': {
          data: { data: { files: { photo: signed('u/p.webp'), thumb: signed('u/t.webp') } } },
          error: null,
        },
      },
    });
    const puts: string[] = [];
    await saveRecrop(
      client,
      server,
      { photoUri: 'file:///c/full.webp', thumbUri: 'file:///c/thumb.webp' },
      {
        putFile: async (uri, target) => {
          puts.push(`${uri}->${target.key}`);
          calls.push('put');
        },
        sizeOf: (uri) => (uri.endsWith('full.webp') ? 900_000 : 60_000),
      },
    );
    expect(bodies['upload-url']).toEqual({
      kind: 'moment',
      jarId: JAR,
      photo: { contentType: 'image/webp', size: 900_000 },
      thumb: { contentType: 'image/webp', size: 60_000 },
    });
    expect(puts).toEqual(['file:///c/full.webp->u/p.webp', 'file:///c/thumb.webp->u/t.webp']);
    expect(updates).toEqual([{ photo_path: 'u/p.webp', thumb_path: 'u/t.webp' }]);
    expect(calls).toEqual(['invoke:upload-url', 'put', 'put', 'update:moments', `eq:id=${MOMENT}`, 'invoke:moderate']);
  });

  it('Re-crop leaves the moment alone when the upload fails', async () => {
    const { client, calls } = fakeClient({
      invoke: {
        'upload-url': {
          data: {
            data: {
              files: {
                photo: { key: 'k', url: 'http://x/k', method: 'PUT', headers: {} },
                thumb: { key: 't', url: 'http://x/t', method: 'PUT', headers: {} },
              },
            },
          },
          error: null,
        },
      },
    });
    const result = await reason(
      saveRecrop(
        client,
        server,
        { photoUri: 'file:///c/full.webp', thumbUri: 'file:///c/thumb.webp' },
        { putFile: async () => Promise.reject(new Error('photo upload answered 403')), sizeOf: () => 1 },
      ),
    );
    expect(result).toBe('failed');
    expect(calls).toEqual(['invoke:upload-url']);
  });
});

describe('queued moments', () => {
  it('change the queue and never call the server', async () => {
    const { client, calls } = fakeClient();
    await setMomentVisibility(client, queued, 'only_me');
    await moveMoment(client, queued, 'selfie');
    await deleteMoment(client, queued);
    await saveMomentEdits(client, queued, { caption: 'x', visibility: 'only_me', edits: {} });
    await saveRecrop(client, queued, { photoUri: 'file:///c/a.webp', thumbUri: 'file:///c/b.webp' });
    expect(calls).toEqual([]);
    expect(saveOptions).toHaveBeenNthCalledWith(1, 21, { visibility: 'only_me' });
    expect(saveOptions).toHaveBeenNthCalledWith(2, 21, { slot: 'selfie' });
    expect(discardItem).toHaveBeenCalledWith(21);
    expect(saveEdits).toHaveBeenCalledWith(21, { caption: 'x', visibility: 'only_me', edits: {} });
    expect(saveRecropped).toHaveBeenCalledWith(21, { photoUri: 'file:///c/a.webp', thumbUri: 'file:///c/b.webp' });
  });

  it('a photo uploading right now is busy; any other queue failure is failed', async () => {
    jest.mocked(discardItem).mockRejectedValueOnce(new QueueItemBusyError(21));
    expect(await reason(deleteMoment(fakeClient().client, queued))).toBe('busy');
    jest.mocked(saveOptions).mockRejectedValueOnce(new Error('disk full'));
    expect(await reason(moveMoment(fakeClient().client, queued, 'selfie'))).toBe('failed');
  });
});
