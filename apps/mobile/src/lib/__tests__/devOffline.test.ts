import type { NetworkState } from 'expo-network';

import { isNetworkError } from '../connectivity';

// The phone's key-value store, kept across simulated relaunches (fresh module instances).
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
    removeItem: async (k: string) => void mockDisk.delete(k),
  },
}));

let mockEmit: (state: NetworkState) => void = () => undefined;
let mockInitial: Promise<NetworkState> = Promise.resolve({});
jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: (state: NetworkState) => void) => {
    mockEmit = listener;
    return { remove: () => undefined };
  },
  getNetworkStateAsync: () => mockInitial,
}));

const mockSetDeviceOnline = jest.fn();
jest.mock('../connectivity', () => ({
  ...jest.requireActual('../connectivity'),
  setDeviceOnline: (online: boolean) => mockSetDeviceOnline(online),
}));

type DevOffline = typeof import('../devOffline');
type NetworkModule = typeof import('../network');

/** A new app run: fresh module state, same disk. */
async function launch(): Promise<{ dev: DevOffline; net: NetworkModule }> {
  let mods: { dev: DevOffline; net: NetworkModule } | undefined;
  jest.isolateModules(() => {
    mods = {
      dev: jest.requireActual<DevOffline>('../devOffline'),
      net: jest.requireActual<NetworkModule>('../network'),
    };
  });
  return mods!;
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const g = globalThis as unknown as { __DEV__: boolean };
const dev = g.__DEV__;

beforeEach(() => {
  mockDisk.clear();
  mockSetDeviceOnline.mockClear();
  mockInitial = Promise.resolve({ isConnected: true, isInternetReachable: true });
  g.__DEV__ = true;
});

afterEach(() => {
  g.__DEV__ = dev;
});

describe('parseDevOfflineParam', () => {
  it.each([
    ['1', true, true],
    ['0', true, false],
    ['true', true, null],
    [undefined, true, null],
    [['1'], true, null],
    ['1', false, null],
    ['0', false, null],
  ] as const)('%p in dev=%p → %p', (value, isDev, expected) => {
    const { parseDevOfflineParam } = jest.requireActual<DevOffline>('../devOffline');
    expect(parseDevOfflineParam(value, isDev)).toBe(expected);
  });
});

describe('dev offline switch', () => {
  it('fails uploads with a network error (D-24) while on, and stays on after a relaunch', async () => {
    const first = await launch();
    await first.dev.setDevOffline(true);
    expect(first.dev.isDevOffline()).toBe(true);
    const error = await first.dev.assertDevOnline().catch((e: unknown) => e);
    expect(isNetworkError(error)).toBe(true);

    const second = await launch(); // app killed and reopened
    await expect(second.dev.assertDevOnline()).rejects.toThrow(second.dev.DEV_OFFLINE_ERROR);
    expect(second.dev.isDevOffline()).toBe(true);
  });

  it('offline=0 turns it off for this run and the next', async () => {
    const first = await launch();
    await first.dev.setDevOffline(true);
    await first.dev.setDevOffline(false);
    await expect(first.dev.assertDevOnline()).resolves.toBeUndefined();

    const second = await launch();
    await expect(second.dev.assertDevOnline()).resolves.toBeUndefined();
    expect(mockDisk.size).toBe(0);
  });

  it('offline=0 right after a relaunch wins over the kept flag still loading', async () => {
    await (await launch()).dev.setDevOffline(true);
    const { dev: d } = await launch();
    d.subscribeDevOffline(() => undefined); // the app starts reading the kept flag
    await d.setDevOffline(false);
    await flush();
    expect(d.isDevOffline()).toBe(false);
    await expect(d.assertDevOnline()).resolves.toBeUndefined();
  });

  it('is off by default', async () => {
    const { dev: d } = await launch();
    await expect(d.assertDevOnline()).resolves.toBeUndefined();
    expect(d.isDevOffline()).toBe(false);
  });

  it('release builds ignore it entirely, even a flag kept by a dev build', async () => {
    const devRun = await launch();
    await devRun.dev.setDevOffline(true);
    g.__DEV__ = false;

    const release = await launch();
    await expect(release.dev.assertDevOnline()).resolves.toBeUndefined();
    expect(release.dev.isDevOffline()).toBe(false);
    const listener = jest.fn();
    release.dev.subscribeDevOffline(listener);
    await release.dev.setDevOffline(false);
    await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(mockDisk.get('pickld-dev-offline')).toBe('1'); // release didn't touch the store

    mockDisk.clear();
    const another = await launch();
    await another.dev.setDevOffline(true);
    expect(mockDisk.size).toBe(0);
    await expect(another.dev.assertDevOnline()).resolves.toBeUndefined();
  });
});

describe('deviceNetwork with the dev switch', () => {
  it('reports offline while the switch is on, though the device is connected, and online when it goes off', async () => {
    const { dev: d, net } = await launch();
    const seen: boolean[] = [];
    const unsubscribe = net.deviceNetwork.subscribe((online) => seen.push(online));
    await flush();
    expect(seen).toEqual([true]);

    await d.setDevOffline(true);
    mockEmit({ isConnected: true, isInternetReachable: true }); // a real change keeps it offline
    await d.setDevOffline(false);
    unsubscribe();

    expect(seen).toEqual([true, false, false, true]);
    expect(mockSetDeviceOnline.mock.calls).toEqual([[true], [false], [false], [true]]);
  });

  it('starts offline after a relaunch with the switch kept on', async () => {
    await (await launch()).dev.setDevOffline(true);
    const { net } = await launch();
    const seen: boolean[] = [];
    const unsubscribe = net.deviceNetwork.subscribe((online) => seen.push(online));
    await flush();
    unsubscribe();
    expect(seen.at(-1)).toBe(false);
    expect(mockSetDeviceOnline).toHaveBeenLastCalledWith(false);
  });

  it('still reports a real lost connection with the switch off', async () => {
    mockInitial = Promise.resolve({ isConnected: false, isInternetReachable: false });
    const { net } = await launch();
    const seen: boolean[] = [];
    net.deviceNetwork.subscribe((online) => seen.push(online))();
    await flush();
    expect(seen).toEqual([false]);
  });

  it('release builds report only the real connection', async () => {
    await (await launch()).dev.setDevOffline(true);
    g.__DEV__ = false;
    const { net } = await launch();
    const seen: boolean[] = [];
    net.deviceNetwork.subscribe((online) => seen.push(online))();
    await flush();
    expect(seen).toEqual([true]);
  });
});
