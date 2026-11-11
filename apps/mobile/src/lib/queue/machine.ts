import { z } from 'zod';

/**
 * Upload states of a queued moment (NFR-OFF-01, NFR-OFF-02).
 * queued → uploading → uploaded, or back to queued with a backoff delay; the 5th failure is `failed`.
 * A network error (offline) goes back to queued without counting as a failure (`waitForNetwork`).
 * `failed` only leaves through `retry` (the tile's Retry button).
 * `conflict`: the slot already has a moment on the server (FR-JAR-03). Not a failure: the tile offers
 * Replace (M2-22, #51), and nothing retries it on its own.
 */
export const QUEUE_STATES = ['queued', 'uploading', 'uploaded', 'failed', 'conflict'] as const;
export const queueStateSchema = z.enum(QUEUE_STATES);
export type QueueState = z.infer<typeof queueStateSchema>;

/** Wait after the 1st, 2nd, 3rd... failed attempt (AGENTS.md upload pipeline). */
export const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000] as const;

/** The 5th failed attempt is final until the user taps Retry. */
export const MAX_ATTEMPTS = 5;

/**
 * Wait after a request that never reached the server (D-24). Offline time does not use up attempts;
 * reconnecting wakes the item at once (runner), so this only paces tries while the phone thinks it is
 * online but the backend is unreachable.
 */
export const OFFLINE_RETRY_MS = 30_000;

/** The part of a queue item the state machine owns. */
export interface UploadStatus {
  state: QueueState;
  /** Failed attempts since enqueue or the last retry. */
  attempts: number;
  /** Epoch ms before which the item must not be tried again; null means now. */
  nextAttemptAt: number | null;
  lastError: string | null;
}

export const INITIAL_STATUS: UploadStatus = { state: 'queued', attempts: 0, nextAttemptAt: null, lastError: null };

function assertState<T extends UploadStatus>(item: T, expected: QueueState, action: string): void {
  if (item.state !== expected) throw new Error(`Cannot ${action} an item that is ${item.state}`);
}

/** Delay after the given number of failed attempts (1-based), capped at the last step. */
export function backoffDelay(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0];
}

/** True when a worker may start uploading this item now. */
export function isDue(item: UploadStatus, now: number = Date.now()): boolean {
  return item.state === 'queued' && (item.nextAttemptAt === null || item.nextAttemptAt <= now);
}

/** Milliseconds until the item is due (0 when due now), or null if it won't become due on its own. */
export function msUntilDue(item: UploadStatus, now: number = Date.now()): number | null {
  if (item.state !== 'queued') return null;
  return Math.max(0, (item.nextAttemptAt ?? now) - now);
}

export function start<T extends UploadStatus>(item: T, now: number = Date.now()): T {
  assertState(item, 'queued', 'start');
  if (!isDue(item, now)) throw new Error('Cannot start an item before its next attempt time');
  return { ...item, state: 'uploading' };
}

export function succeed<T extends UploadStatus>(item: T): T {
  assertState(item, 'uploading', 'complete');
  return { ...item, state: 'uploaded', nextAttemptAt: null, lastError: null };
}

export function fail<T extends UploadStatus>(item: T, error: string, now: number = Date.now()): T {
  assertState(item, 'uploading', 'fail');
  const attempts = item.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) return { ...item, state: 'failed', attempts, nextAttemptAt: null, lastError: error };
  return { ...item, state: 'queued', attempts, nextAttemptAt: now + backoffDelay(attempts), lastError: error };
}

/** The request never reached the server: back to the queue without counting an attempt (D-24). */
export function waitForNetwork<T extends UploadStatus>(item: T, error: string, now: number = Date.now()): T {
  assertState(item, 'uploading', 'park');
  return { ...item, state: 'queued', nextAttemptAt: now + OFFLINE_RETRY_MS, lastError: error };
}

/** The server refused the moment because its slot is taken. Attempts are kept; no retry is scheduled. */
export function conflict<T extends UploadStatus>(item: T, error: string): T {
  assertState(item, 'uploading', 'mark as a conflict');
  return { ...item, state: 'conflict', nextAttemptAt: null, lastError: error };
}

export function retry<T extends UploadStatus>(item: T): T {
  assertState(item, 'failed', 'retry');
  return { ...item, ...INITIAL_STATUS };
}
