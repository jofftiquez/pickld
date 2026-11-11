import { useSyncExternalStore } from 'react';

// Offline signal for the UI (NFR-OFF-01). Two sources: the device's connection (expo-network, see
// network.ts; D-23) and the latest request to the backend. The app is offline when the device says it has
// no connection, or when its latest backend request failed with a network error (connected to Wi-Fi with
// no internet, backend unreachable). Any answer from the server, even an error, means reachable.
// TanStack Query's onlineManager only listens to browser events, so it is not used.

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

let deviceOffline = false;
let requestFailed = false;
let offline = false;
const listeners = new Set<() => void>();

function update(): void {
  const next = deviceOffline || requestFailed;
  if (next === offline) return;
  offline = next;
  listeners.forEach((listener) => listener());
}

/** The device's connection changed. Coming back clears the last request failure until a new one fails. */
export function setDeviceOnline(online: boolean): void {
  if (online && deviceOffline) requestFailed = false;
  deviceOffline = !online;
  update();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records the outcome of a backend request: `null` for success, otherwise the error or its message. */
export function reportNetworkResult(error: unknown): void {
  requestFailed = error !== null && error !== undefined && isNetworkError(error);
  update();
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
