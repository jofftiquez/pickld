// The camera's save path: the raw photo is queued first (so it survives a kill right after the shutter),
// then prepared in the background, then the upload worker is asked to run. Queue, preparation and worker
// are mocked; what's checked is the order and that saveCapture never waits for preparation.
import { captureError } from '@/lib/monitoring';
import { prepareItem } from '@/lib/queue/prepare';
import { requestUploads } from '@/lib/queue/runner';
import { enqueue } from '@/lib/queue/store';

import { captureJarDate, saveCapture } from '../saveCapture';

const mockLog: string[] = [];
const mockDeleted: string[] = [];
let mockFinishPrepare: (() => void) | null = null;
let mockFailPrepare: ((error: Error) => void) | null = null;

jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(uri: string) {
      this.mockUri = uri;
    }
    get exists() {
      return true;
    }
    delete() {
      mockLog.push(`delete ${this.mockUri}`);
      mockDeleted.push(this.mockUri);
    }
  },
}));

jest.mock('@/lib/queue/store', () => ({
  enqueue: jest.fn(async (input: Record<string, unknown>) => {
    mockLog.push('enqueue');
    return { id: 7, ...input };
  }),
}));

jest.mock('@/lib/queue/prepare', () => ({
  prepareItem: jest.fn(
    () =>
      new Promise((resolve, reject) => {
        mockLog.push('prepare');
        mockFinishPrepare = () => resolve({ id: 7, prepared: true });
        mockFailPrepare = reject;
      }),
  ),
}));

jest.mock('@/lib/queue/runner', () => ({
  requestUploads: jest.fn(() => {
    mockLog.push('requestUploads');
    return new Promise<void>(() => undefined); // never settles: saveCapture must not wait for uploads
  }),
}));

jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
// 2026-11-11 14:14:05 in Manila (+08:00).
const shotAt = new Date('2026-11-11T06:14:05Z');
const input = {
  uri: 'file:///tmp/camera-shot.jpg',
  slot: 'afternoon',
  userId,
  tz: 'Asia/Manila',
  shotAt,
  openJar: null,
} as const;
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockLog.length = 0;
  mockDeleted.length = 0;
  mockFinishPrepare = null;
  mockFailPrepare = null;
  jest.mocked(enqueue).mockClear();
  jest.mocked(prepareItem).mockClear();
  jest.mocked(requestUploads).mockClear();
  jest.mocked(captureError).mockClear();
});

describe('saveCapture', () => {
  it('queues the raw camera photo first and resolves without waiting for preparation', async () => {
    const item = await saveCapture(input);

    expect(item.id).toBe(7);
    expect(enqueue).toHaveBeenCalledWith({
      userId,
      photoUri: 'file:///tmp/camera-shot.jpg',
      thumbUri: null,
      slot: 'afternoon',
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-11T14:14:05+08:00',
      prepared: false,
      // Held for the editor the camera opens next: no upload before Add to #slot (M2-12).
      editing: true,
    });
    // The camera file goes only after the queue holds its own copy; preparation is still running.
    expect(mockLog).toEqual(['enqueue', 'delete file:///tmp/camera-shot.jpg', 'prepare']);
    expect(requestUploads).not.toHaveBeenCalled();
  });

  it('asks the worker to upload once the photo is prepared', async () => {
    await saveCapture(input);
    mockFinishPrepare?.();
    await flush();
    expect(mockLog.slice(-2)).toEqual(['prepare', 'requestUploads']);
  });

  it('still wakes the worker when preparation fails, which prepares the item before uploading it', async () => {
    await saveCapture(input);
    mockFailPrepare?.(new Error('decode failed'));
    await flush();
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'decode failed' }), {
      area: 'capture',
    });
    expect(requestUploads).toHaveBeenCalledTimes(1);
  });

  it('queues nothing, prepares nothing and keeps the camera file when queueing fails', async () => {
    jest.mocked(enqueue).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveCapture(input)).rejects.toThrow('disk full');
    expect(prepareItem).not.toHaveBeenCalled();
    expect(requestUploads).not.toHaveBeenCalled();
    expect(mockDeleted).toEqual([]);
  });
});

describe('captureJarDate', () => {
  it("uses today's date in the phone zone when there is no open jar", () => {
    expect(captureJarDate({ tz: 'Asia/Manila', shotAt, openJar: null })).toEqual({
      localDate: '2026-11-11',
      capturedAt: '2026-11-11T14:14:05+08:00',
    });
  });

  it("joins the open jar after flying west, even though the phone's date is earlier (travel rule)", () => {
    // 01:00 on the 12th in Manila: the Manila jar of the 12th is open; the phone is now in Honolulu (11th).
    const at = new Date('2026-11-11T17:00:00Z');
    const openJar = { id: 'jar-12', localDate: '2026-11-12', tz: 'Asia/Manila' };
    expect(captureJarDate({ tz: 'Pacific/Honolulu', shotAt: at, openJar }).localDate).toBe('2026-11-12');
  });

  it("starts today's jar when the open jar from Today has closed meanwhile", () => {
    const openJar = { id: 'jar-10', localDate: '2026-11-10', tz: 'Asia/Manila' };
    expect(captureJarDate({ tz: 'Asia/Manila', shotAt, openJar }).localDate).toBe('2026-11-11');
  });
});
