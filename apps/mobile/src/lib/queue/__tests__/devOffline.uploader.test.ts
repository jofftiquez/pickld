import { setDevOffline } from '../../devOffline';
import { MAX_ATTEMPTS } from '../machine';
import { enqueue, getItem, listQueue } from '../store';
import { drainQueue, uploadItem } from '../uploader';
import { capturedFiles, fakeBackend, files, log, resetFakes, USER } from './fakes';

// The dev offline switch (M2-30) in the upload worker: no request leaves the phone, and no attempt is used.

jest.mock('expo-sqlite', () => jest.requireActual('./fakes').expoSqlite);
jest.mock('expo-file-system', () => jest.requireActual('./fakes').expoFileSystem);
const mockKv = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockKv.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockKv.set(k, v),
    removeItem: async (k: string) => void mockKv.delete(k),
  },
}));

const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);
let backend: ReturnType<typeof fakeBackend>;
let clock: number;
const deps = () => ({ client: backend.client, putFile: backend.putFile, now: () => clock });

const queueMoment = () =>
  enqueue({ userId: USER, ...capturedFiles(), slot: 'evening', localDate: '2026-11-11', tz: 'Asia/Manila' });

beforeEach(async () => {
  resetFakes();
  backend = fakeBackend();
  clock = T0;
  await setDevOffline(false);
});

describe('uploader with the dev offline switch', () => {
  it('parks the photo without touching the network or using attempts, then uploads once it is off', async () => {
    await setDevOffline(true);
    const item = await queueMoment();
    log.length = 0;

    for (let i = 0; i < MAX_ATTEMPTS * 2; i += 1) {
      const current = (await getItem(item.id))!;
      const outcome = await uploadItem({ ...current, nextAttemptAt: null }, deps());
      expect(outcome.kind).toBe('retrying');
      clock += 60 * 60 * 1000;
    }

    expect(log.filter((entry) => !entry.startsWith('delete:'))).toEqual([]); // no rpc, fn, put or insert
    expect(backend.moments).toEqual([]);
    expect(await getItem(item.id)).toMatchObject({ state: 'queued', attempts: 0 });
    expect([...files.keys()].some((uri) => uri.startsWith('file:///docs/queue/'))).toBe(true);

    await setDevOffline(false);
    await drainQueue(USER, deps());
    expect(backend.moments.map((m) => m.slot)).toEqual(['evening']);
    expect(await listQueue(USER)).toEqual([]);
  });
});
