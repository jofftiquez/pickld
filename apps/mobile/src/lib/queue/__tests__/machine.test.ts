import {
  conflict,
  fail,
  INITIAL_STATUS,
  isDue,
  MAX_ATTEMPTS,
  msUntilDue,
  OFFLINE_RETRY_MS,
  retry,
  start,
  succeed,
  type UploadStatus,
  waitForNetwork,
} from '../machine';

const T0 = Date.UTC(2026, 10, 11, 3, 0, 0);

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Starts and fails one attempt at the current (fake) time. */
function failOnce<T extends UploadStatus>(item: T): T {
  return fail(start(item), 'network down');
}

describe('upload state machine', () => {
  it('parks an offline attempt without counting it, however many times it happens (D-24)', () => {
    let item: UploadStatus = { ...INITIAL_STATUS, attempts: 2 };
    for (let i = 0; i < MAX_ATTEMPTS * 3; i += 1) {
      item = waitForNetwork(start(item), 'Network request failed');
      jest.advanceTimersByTime(OFFLINE_RETRY_MS);
    }
    expect(item).toEqual({
      state: 'queued',
      attempts: 2,
      nextAttemptAt: Date.now(),
      lastError: 'Network request failed',
    });
    expect(OFFLINE_RETRY_MS).toBe(30_000);
    expect(() => waitForNetwork(item, 'x')).toThrow('Cannot park an item that is queued');
  });

  it('waits exactly 1 s, 5 s, 30 s and 2 min after failures 1 to 4', () => {
    // Hand-derived: each failure schedules the next try `delay` ms after the moment it failed.
    const expected = [1_000, 5_000, 30_000, 120_000];
    let item: UploadStatus = INITIAL_STATUS;
    expected.forEach((delay, i) => {
      item = failOnce(item);
      expect(item).toEqual({
        state: 'queued',
        attempts: i + 1,
        nextAttemptAt: Date.now() + delay,
        lastError: 'network down',
      });
      jest.advanceTimersByTime(delay - 1);
      expect(isDue(item)).toBe(false);
      expect(msUntilDue(item)).toBe(1);
      expect(() => start(item)).toThrow('before its next attempt time');
      jest.advanceTimersByTime(1);
      expect(isDue(item)).toBe(true);
      expect(msUntilDue(item)).toBe(0);
    });
  });

  it('marks the 5th failed attempt as failed, with no further attempt scheduled', () => {
    let item: UploadStatus = INITIAL_STATUS;
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      item = failOnce(item);
      jest.advanceTimersByTime(msUntilDue(item) ?? 0);
    }
    expect(item).toMatchObject({ state: 'queued', attempts: 4 });
    item = failOnce(item);
    expect(item).toEqual({ state: 'failed', attempts: 5, nextAttemptAt: null, lastError: 'network down' });
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(isDue(item)).toBe(false);
    expect(msUntilDue(item)).toBeNull();
    expect(() => start(item)).toThrow('Cannot start an item that is failed');
  });

  it('tries at 0 s, 1 s, 6 s, 36 s and 156 s when a timer-driven worker keeps failing', () => {
    // 0, 0+1, 1+5, 6+30, 36+120 seconds after the first attempt.
    const triedAt: number[] = [];
    let item: UploadStatus = INITIAL_STATUS;
    const tick = (): void => {
      triedAt.push(Date.now() - T0);
      item = failOnce(item);
      const wait = msUntilDue(item);
      if (wait !== null) setTimeout(tick, wait);
    };
    tick();
    jest.runAllTimers();
    expect(triedAt).toEqual([0, 1_000, 6_000, 36_000, 156_000]);
    expect(item.state).toBe('failed');
  });

  it('Retry resets a failed item to a fresh, immediately due attempt', () => {
    let item: UploadStatus = INITIAL_STATUS;
    while (item.state !== 'failed') {
      item = failOnce(item);
      jest.advanceTimersByTime(msUntilDue(item) ?? 0);
    }
    item = retry(item);
    expect(item).toEqual(INITIAL_STATUS);
    expect(isDue(item)).toBe(true);
    // The backoff starts over at 1 s, not 10 min.
    item = failOnce(item);
    expect(item).toMatchObject({ state: 'queued', attempts: 1, nextAttemptAt: Date.now() + 1_000 });
  });

  it('keeps the rest of the item and clears the error on success', () => {
    const item = { ...INITIAL_STATUS, id: 7 };
    const failed = failOnce(item);
    expect(failed.id).toBe(7);
    jest.advanceTimersByTime(1_000);
    expect(succeed(start(failed))).toEqual({
      id: 7,
      state: 'uploaded',
      attempts: 1,
      nextAttemptAt: null,
      lastError: null,
    });
  });

  it('refuses transitions from the wrong state', () => {
    expect(() => fail(INITIAL_STATUS, 'x')).toThrow('Cannot fail an item that is queued');
    expect(() => succeed(INITIAL_STATUS)).toThrow('Cannot complete an item that is queued');
    expect(() => retry(INITIAL_STATUS)).toThrow('Cannot retry an item that is queued');
    const uploaded = succeed(start(INITIAL_STATUS));
    expect(() => start(uploaded)).toThrow('Cannot start an item that is uploaded');
  });

  it('parks a slot conflict without counting a failure or scheduling a retry', () => {
    const failed = failOnce(INITIAL_STATUS);
    jest.advanceTimersByTime(1_000);
    const parked = conflict(start(failed), 'slot taken');
    expect(parked).toEqual({ state: 'conflict', attempts: 1, nextAttemptAt: null, lastError: 'slot taken' });
    expect(isDue(parked, Date.now() + 3_600_000)).toBe(false);
    expect(msUntilDue(parked)).toBeNull();
    expect(() => start(parked)).toThrow('Cannot start an item that is conflict');
    expect(() => retry(parked)).toThrow('Cannot retry an item that is conflict');
    expect(() => conflict(INITIAL_STATUS, 'x')).toThrow('Cannot mark as a conflict an item that is queued');
  });
});
