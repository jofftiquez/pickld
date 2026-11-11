import { useSyncExternalStore } from 'react';

// Offline signal for the UI (NFR-OFF-01). No connectivity package is installed (adding expo-network needs
// product-owner approval), and TanStack Query's onlineManager only listens to browser `online`/`offline`
// events, so on React Native it always says online. Instead the app is "offline" when its latest request
// to the backend failed with a network error: the upload worker reports each drain's last attempt and
// Today reports its jar and profile fetches. Any answer from the server, even an error, means online.
//
// To switch to expo-network later, replace the body of `useIsOffline` with
// `Network.useNetworkState().isInternetReachable === false`; callers stay the same.

// Messages fetch, supabase-js and the native upload task use when no request reached the server.
const NETWORK_ERROR =
  /network request failed|failed to fetch|failed to send a request|internet connection appears to be offline|network connection was lost|could not connect to the server|unable to resolve host|failed to connect to|network is unreachable|timed out/i;

/** True when an error (or the message the queue stored) means the request never reached the server. */
export function isNetworkError(error: unknown): boolean {
  if (typeof error === 'string') return NETWORK_ERROR.test(error);
  if (typeof error === 'object' && error !== null) {
    if ('name' in error && error.name === 'FunctionsFetchError') return true;
    if ('message' in error && typeof error.message === 'string') return NETWORK_ERROR.test(error.message);
  }
  return false;
}

let offline = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records the outcome of a backend request: `null` for success, otherwise the error or its message. */
export function reportNetworkResult(error: unknown): void {
  const next = error !== null && error !== undefined && isNetworkError(error);
  if (next === offline) return;
  offline = next;
  listeners.forEach((listener) => listener());
}

/** Reports how a backend request ended and passes its result or error through unchanged. */
export async function trackNetwork<T>(request: Promise<T>): Promise<T> {
  try {
    const result = await request;
    reportNetworkResult(null);
    return result;
  } catch (error) {
    reportNetworkResult(error);
    throw error;
  }
}

/** Whether the app currently believes it is offline. The one place the UI reads connectivity from. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, () => offline);
}
