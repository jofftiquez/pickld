import { AppState } from 'react-native';

import { useAuthStore } from '../authStore';
import { reportNetworkResult } from '../connectivity';
import { captureError } from '../monitoring';
import { msUntilDue } from './machine';
import { listQueue } from './store';
import { drainQueue, type PutFile, type UploaderClient } from './uploader';

// Drives the upload worker (M2-04; NFR-OFF-02): drains the signed-in user's queue on start (app open),
// on sign-in, when the app comes back to the foreground, when the network returns, when a backoff
// delay runs out, and when the capture flow calls `requestUploads()` after `enqueue`.

/** Connectivity events. `online: true` after `false` drains the queue; while offline nothing starts. */
export interface NetworkSource {
  subscribe(listener: (online: boolean) => void): () => void;
}

export interface UploadRunnerOptions {
  putFile?: PutFile;
  /** No connectivity package is installed yet; without one, foreground and backoff timers drive retries. */
  network?: NetworkSource;
}

let kickActive: (() => Promise<void>) | null = null;

/** Asks the running worker to drain now (e.g. right after `enqueue`). Resolves when that drain ends. */
export function requestUploads(): Promise<void> {
  return kickActive?.() ?? Promise.resolve();
}

/** Starts the worker; returns a cleanup function. Only one runs at a time: a new one replaces the last. */
export function startUploadRunner(getClient: () => UploaderClient, options: UploadRunnerOptions = {}): () => void {
  let stopped = false;
  let online = true;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const currentUser = () => useAuthStore.getState().session?.user.id ?? null;

  async function scheduleNext(userId: string): Promise<void> {
    clearTimeout(timer);
    const waits = (await listQueue(userId)).map((item) => msUntilDue(item)).filter((ms) => ms !== null);
    if (waits.length > 0 && !stopped) timer = setTimeout(() => void kick(), Math.min(...waits));
  }

  async function run(): Promise<void> {
    do {
      again = false;
      const userId = currentUser();
      if (stopped || !online || !userId) return;
      const client = getClient(); // throws without app env; caught below, the queue keeps everything
      const outcomes = await drainQueue(
        userId,
        { client, putFile: options.putFile },
        () => !stopped && online && currentUser() === userId,
      );
      // The latest attempt tells the UI whether the backend is reachable (offline banner, M2-06).
      const last = outcomes.at(-1);
      if (last) reportNetworkResult(last.kind === 'retrying' || last.kind === 'failed' ? last.error : null);
      if (!stopped) await scheduleNext(userId);
    } while (again && !stopped);
  }

  function kick(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = run()
      .catch((error: unknown) => captureError(error, { area: 'upload-worker' }))
      .finally(() => {
        running = null;
      });
    return running;
  }

  const unsubscribeAuth = useAuthStore.subscribe((state, prev) => {
    const id = state.session?.user.id ?? null;
    if (id && id !== (prev.session?.user.id ?? null)) void kick();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void kick();
  });
  const unsubscribeNetwork = options.network?.subscribe((next) => {
    const cameBack = next && !online;
    online = next;
    if (cameBack) void kick();
  });

  kickActive = kick;
  void kick();

  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribeAuth();
    appState.remove();
    unsubscribeNetwork?.();
    if (kickActive === kick) kickActive = null;
  };
}
