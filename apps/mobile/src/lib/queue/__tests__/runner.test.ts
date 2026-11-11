import type { Session } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '../../authStore';
import { captureError } from '../../monitoring';
import { BACKOFF_MS } from '../machine';
import { requestUploads, startUploadRunner, type NetworkSource } from '../runner';
import { enqueue, getItem, listQueue } from '../store';
import { capturedFiles, fakeBackend, networkError, resetFakes, USER } from './fakes';

jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);
jest.mock('../../monitoring', () => ({ captureError: jest.fn() }));

const session = { access_token: 't', user: { id: USER } } as unknown as Session;

function queueMoment(slot: 'ootd' | 'selfie' = 'ootd') {
  return enqueue({ userId: USER, ...capturedFiles(), slot, localDate: '2026-11-11', tz: 'Asia/Manila' });
}

function fakeNetwork(initiallyOnline: boolean) {
  let listener: (online: boolean) => void = () => {};
  const source: NetworkSource = {
    subscribe: (cb) => {
      listener = cb;
      cb(initiallyOnline);
      return () => {
        listener = () => {};
      };
    },
  };
  return { source, set: (online: boolean) => listener(online) };
}

/** Lets queued async work (SQLite, fake network) run, without kicking the runner itself. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

let appStateListener: (state: AppStateStatus) => void = () => {};
let backend: ReturnType<typeof fakeBackend>;
let stop: () => void = () => {};

beforeEach(() => {
  resetFakes();
  backend = fakeBackend();
  useAuthStore.setState({ status: 'signedIn', session, error: null });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
    appStateListener = cb as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(async () => {
  stop();
  await requestUploads();
  jest.useRealTimers();
  expect(captureError).not.toHaveBeenCalled();
  jest.clearAllMocks();
});

const start = (network?: NetworkSource) => {
  stop = startUploadRunner(() => backend.client, { putFile: backend.putFile, network });
};

describe('upload runner', () => {
  it('uploads what is already queued when the app opens', async () => {
    await queueMoment();
    start();
    await settle();
    expect(backend.moments).toHaveLength(1);
    expect(await listQueue(USER)).toEqual([]);
  });

  it('starts nothing offline and drains the queue when the network comes back', async () => {
    const network = fakeNetwork(false);
    start(network.source);
    await queueMoment('ootd');
    await queueMoment('selfie');
    await requestUploads();
    expect(backend.moments).toEqual([]);
    expect((await listQueue(USER)).map((item) => item.attempts)).toEqual([0, 0]);

    network.set(true);
    await settle();
    expect(backend.moments.map((m) => m.slot)).toEqual(['ootd', 'selfie']);
    expect(await listQueue(USER)).toEqual([]);
  });

  it('drains when the app returns to the foreground', async () => {
    start();
    await requestUploads();
    await queueMoment();
    appStateListener('background');
    await settle();
    expect(backend.moments).toEqual([]);

    appStateListener('active');
    await settle();
    expect(backend.moments).toHaveLength(1);
  });

  it('waits for a signed-in user, then uploads only that user’s moments', async () => {
    useAuthStore.setState({ status: 'signedOut', session: null, error: null });
    await queueMoment();
    start();
    await requestUploads();
    expect(backend.moments).toEqual([]);

    useAuthStore.setState({ status: 'signedIn', session, error: null });
    await settle();
    expect(backend.moments).toHaveLength(1);
  });

  it('retries by itself when the backoff delay runs out', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 10, 11, 3), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    backend.failNext('upload-url', networkError());
    const item = await queueMoment();
    start();
    await requestUploads();
    expect(await getItem(item.id)).toMatchObject({ state: 'queued', attempts: 1 });

    await jest.advanceTimersByTimeAsync(BACKOFF_MS[0]);
    await settle();
    expect(backend.moments).toHaveLength(1);
    expect(await getItem(item.id)).toBeNull();
  });

  it('keeps everything queued when the client cannot start', async () => {
    await queueMoment();
    stop = startUploadRunner(() => {
      throw new Error('Invalid app environment');
    });
    await requestUploads();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'upload-worker' });
    jest.mocked(captureError).mockClear();
    expect(await listQueue(USER)).toHaveLength(1);
  });
});
