import * as Network from 'expo-network';

import { setDeviceOnline } from './connectivity';
import type { NetworkSource } from './queue/runner';

// The device's connection (D-23): feeds the offline banner and wakes the upload worker on reconnect.
// `isInternetReachable` is unknown for a moment after launch on iOS; only an explicit false is offline.

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export const deviceNetwork: NetworkSource = {
  subscribe(listener) {
    const emit = (state: Network.NetworkState) => {
      const online = isOnline(state);
      setDeviceOnline(online);
      listener(online);
    };
    const subscription = Network.addNetworkStateListener(emit);
    Network.getNetworkStateAsync()
      .then(emit)
      .catch(() => undefined); // no reading yet: stay "online" and let requests decide
    return () => subscription.remove();
  },
};
