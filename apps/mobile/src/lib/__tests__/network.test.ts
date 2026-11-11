import type { NetworkState } from 'expo-network';

import { deviceNetwork } from '../network';

let mockEmit: (state: NetworkState) => void = () => undefined;
let mockInitial: Promise<NetworkState> = Promise.resolve({});
const mockRemove = jest.fn();

jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: (state: NetworkState) => void) => {
    mockEmit = listener;
    return { remove: mockRemove };
  },
  getNetworkStateAsync: () => mockInitial,
}));

const mockSetDeviceOnline = jest.fn();
jest.mock('../connectivity', () => ({ setDeviceOnline: (online: boolean) => mockSetDeviceOnline(online) }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockSetDeviceOnline.mockClear();
  mockRemove.mockClear();
});

describe('deviceNetwork', () => {
  it('reports the first reading, then every change, to the worker and the offline signal', async () => {
    mockInitial = Promise.resolve({ isConnected: false, isInternetReachable: false });
    const seen: boolean[] = [];
    const unsubscribe = deviceNetwork.subscribe((online) => seen.push(online));
    await flush();
    mockEmit({ isConnected: true, isInternetReachable: true });
    unsubscribe();

    expect(seen).toEqual([false, true]);
    expect(mockSetDeviceOnline.mock.calls).toEqual([[false], [true]]);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ isConnected: true, isInternetReachable: undefined }, true], // iOS before the reachability check
    [{ isConnected: true, isInternetReachable: false }, false], // Wi-Fi without internet
    [{ isConnected: false, isInternetReachable: undefined }, false],
    [{}, true],
  ] as const)('%p counts as online: %p', async (state, online) => {
    mockInitial = Promise.resolve(state);
    const seen: boolean[] = [];
    deviceNetwork.subscribe((value) => seen.push(value))();
    await flush();
    expect(seen).toEqual([online]);
  });

  it('stays quiet when the first reading fails, so requests decide', async () => {
    mockInitial = Promise.reject(new Error('native module missing'));
    const seen: boolean[] = [];
    deviceNetwork.subscribe((value) => seen.push(value))();
    await flush();
    expect(seen).toEqual([]);
  });
});
