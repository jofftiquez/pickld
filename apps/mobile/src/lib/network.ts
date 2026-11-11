import * as Network from 'expo-network';

import { setDeviceOnline } from './connectivity';
import { isDevOffline, subscribeDevOffline } from './devOffline';
import type { NetworkSource } from './queue/runner';

// The device's connection (D-23): feeds the offline banner and wakes the upload worker on reconnect.
// `isInternetReachable` is unknown for a moment after launch on iOS; only an explicit false is offline.
// In dev builds the offline switch (devOffline.ts, M2-30) can force offline on top of the real reading.

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export const deviceNetwork: NetworkSource = {
  subscribe(listener) {
    let connected: boolean | null = null; // no reading yet: "online", and let requests decide
    const emit = () => {
      const online = (connected ?? true) && !isDevOffline();
      setDeviceOnline(online);
      listener(online);
    };
    const read = (state: Network.NetworkState) => {
      connected = isOnline(state);
      emit();
    };
    const subscription = Network.addNetworkStateListener(read);
    Network.getNetworkStateAsync()
      .then(read)
      .catch(() => undefined);
    const unsubscribeDev = subscribeDevOffline(emit);
    return () => {
      subscription.remove();
      unsubscribeDev();
    };
  },
};
