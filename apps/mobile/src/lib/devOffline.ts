// Dev-only offline switch (M2-30; NFR-OFF-01, NFR-OFF-02). The iOS Simulator shares the Mac's network and
// Maestro's airplane mode is Android-only, so `pickld://dev/network?offline=1` makes the app behave as
// offline: deviceNetwork reports no connection and the upload worker fails each item with a network error
// before any request (D-24: no attempt used). `offline=0` turns it off. The flag is kept on the phone so
// "kill the app while offline, reopen" stays offline. Release builds (`__DEV__` false) ignore all of it.

import Storage from 'expo-sqlite/kv-store';

// The queue treats this message as a network error (connectivity.ts), like a real lost connection.
export const DEV_OFFLINE_ERROR = 'Network request failed (dev offline switch)';

const KEY = 'pickld-dev-offline';

let offline = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (next === offline) return;
  offline = next;
  listeners.forEach((listener) => listener());
}

/** Reads the kept flag once per app run. An unreadable store leaves the switch off. */
function load(): Promise<void> {
  loading ??= Storage.getItem(KEY)
    .then((value) => set(value === '1'))
    .catch(() => undefined);
  return loading;
}

/** `offline` from the dev link: true for `1`, false for `0`, null for anything else or in release builds. */
export function parseDevOfflineParam(value: unknown, isDev: boolean): boolean | null {
  if (!isDev) return null;
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/** Whether the dev switch currently forces offline. Always false in release builds. */
export function isDevOffline(): boolean {
  return __DEV__ && offline;
}

/** Turns the switch on or off and keeps it across restarts. Does nothing in release builds. */
export async function setDevOffline(next: boolean): Promise<void> {
  if (!__DEV__) return;
  await load(); // a read still in flight must not overwrite this choice
  set(next);
  if (next) await Storage.setItem(KEY, '1');
  else await Storage.removeItem(KEY);
}

/** Calls `listener` when the switch changes (including when the kept flag loads as on). */
export function subscribeDevOffline(listener: () => void): () => void {
  if (!__DEV__) return () => undefined;
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/**
 * The upload worker's gate: rejects with a network-style error while the switch is on, waiting for the
 * kept flag first so the first drain after a relaunch can't slip through. Resolves at once in release.
 */
export async function assertDevOnline(): Promise<void> {
  if (!__DEV__) return;
  await load();
  if (offline) throw new Error(DEV_OFFLINE_ERROR);
}
