// The camera's save path: capture → preparePhoto (real, over a mocked manipulator) → enqueue →
// requestUploads. The queue and the worker are mocked; the order of calls is what's checked.
import { requestUploads } from '@/lib/queue/runner';
import { enqueue } from '@/lib/queue/store';

import { captureJarDate, saveCapture } from '../saveCapture';

const mockLog: string[] = [];
const mockDeleted: string[] = [];

jest.mock('expo-image-manipulator', () => {
  let saves = 0;
  const image = (width: number, height: number) => ({
    width,
    height,
    release: () => undefined,
    saveAsync: async () => {
      saves += 1;
      mockLog.push(`save ${width}x${height}`);
      return { uri: `file:///cache/prepared-${saves}.webp`, width, height };
    },
  });
  return {
    SaveFormat: { WEBP: 'webp' },
    ImageManipulator: {
      manipulate: (source: unknown) => {
        if (typeof source === 'string') mockLog.push(`manipulate ${source}`);
        let size =
          typeof source === 'string' ? { width: 3024, height: 4032 } : (source as { width: number; height: number });
        const ctx = {
          crop: (rect: { width: number; height: number }) => ((size = rect), ctx),
          resize: (s: { width: number; height: number }) => ((size = s), ctx),
          renderAsync: async () => image(size.width, size.height),
          release: () => undefined,
        };
        return ctx;
      },
    },
  };
});

jest.mock('expo-file-system', () => {
  const nodeFs = jest.requireActual<typeof import('node:fs')>('node:fs');
  const nodePath = jest.requireActual<typeof import('node:path')>('node:path');
  return {
    File: class {
      mockUri: string;
      constructor(uri: string) {
        this.mockUri = uri;
      }
      get exists() {
        return true;
      }
      async bytes() {
        return new Uint8Array(
          nodeFs.readFileSync(nodePath.join(__dirname, '../../../lib/image/__tests__/__fixtures__/clean.webp')),
        );
      }
      delete() {
        mockDeleted.push(this.mockUri);
      }
    },
  };
});

jest.mock('@/lib/queue/store', () => ({
  enqueue: jest.fn(async (input: Record<string, unknown>) => {
    mockLog.push('enqueue');
    return { id: 7, ...input };
  }),
}));

jest.mock('@/lib/queue/runner', () => ({
  requestUploads: jest.fn(() => {
    mockLog.push('requestUploads');
    return new Promise<void>(() => undefined); // never settles: saveCapture must not wait for uploads
  }),
}));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
// 2026-11-11 14:14:05 in Manila (+08:00).
const shotAt = new Date('2026-11-11T06:14:05Z');

beforeEach(() => {
  mockLog.length = 0;
  mockDeleted.length = 0;
  jest.mocked(enqueue).mockClear();
  jest.mocked(requestUploads).mockClear();
});

describe('saveCapture', () => {
  it('prepares the photo, queues it, then asks the worker to upload', async () => {
    const item = await saveCapture({
      uri: 'file:///tmp/camera-shot.jpg',
      slot: 'afternoon',
      userId,
      tz: 'Asia/Manila',
      shotAt,
      openJar: null,
    });

    expect(mockLog).toEqual([
      'manipulate file:///tmp/camera-shot.jpg',
      'save 1440x1920',
      'save 480x640',
      'enqueue',
      'requestUploads',
    ]);
    expect(enqueue).toHaveBeenCalledWith({
      userId,
      photoUri: 'file:///cache/prepared-1.webp',
      thumbUri: 'file:///cache/prepared-2.webp',
      slot: 'afternoon',
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-11T14:14:05+08:00',
    });
    expect(item.id).toBe(7);
    // The queue keeps its own copies; the camera file and pipeline outputs are cleaned up.
    expect(mockDeleted).toEqual([
      'file:///tmp/camera-shot.jpg',
      'file:///cache/prepared-1.webp',
      'file:///cache/prepared-2.webp',
    ]);
  });

  it('queues nothing and uploads nothing when queueing fails, and keeps the camera file', async () => {
    jest.mocked(enqueue).mockRejectedValueOnce(new Error('disk full'));
    await expect(
      saveCapture({ uri: 'file:///tmp/shot.jpg', slot: 'selfie', userId, tz: 'Asia/Manila', shotAt, openJar: null }),
    ).rejects.toThrow('disk full');
    expect(requestUploads).not.toHaveBeenCalled();
    expect(mockDeleted).not.toContain('file:///tmp/shot.jpg');
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
