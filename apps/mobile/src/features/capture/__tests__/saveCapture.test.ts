// The camera's save path: the raw photo is queued first (so it survives a kill right after the shutter),
// then prepared in the background, then the upload worker is asked to run. Queue, preparation and worker
// are mocked; what's checked is the order and that saveCapture never waits for preparation.
import { captureError } from '@/lib/monitoring';
import { prepareItem } from '@/lib/queue/prepare';
import { requestUploads } from '@/lib/queue/runner';
import { enqueue } from '@/lib/queue/store';

import { captureJarDate, galleryTarget, queueTarget, saveCapture, saveGalleryPhoto } from '../saveCapture';

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
      replace: false,
    });
    // The camera file goes only after the queue holds its own copy; preparation is still running.
    expect(mockLog).toEqual(['enqueue', 'delete file:///tmp/camera-shot.jpg', 'prepare']);
    expect(requestUploads).not.toHaveBeenCalled();
  });

  it('queues a photo for a filled slot as a replacement when the user chose Replace (M2-22)', async () => {
    await saveCapture({ ...input, replace: true });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ slot: 'afternoon', replace: true }));
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

  it("Fill this jar queues under the past date in that jar's zone, with the real capture time", async () => {
    await saveCapture({ ...input, tz: 'Pacific/Honolulu', fill: { localDate: '2026-11-08', tz: 'Asia/Manila' } });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        localDate: '2026-11-08',
        tz: 'Asia/Manila',
        // Taken now, in the phone's zone; the server compares added_at with the jar's end (rule 6).
        capturedAt: '2026-11-10T20:14:05-10:00',
      }),
    );
  });
});

describe('queueTarget', () => {
  // 01:00 on the 12th in Manila: the Manila jar of the 12th is open; the phone is now in Honolulu (11th).
  const at = new Date('2026-11-11T17:00:00Z');
  const openJar = { id: 'jar-12', localDate: '2026-11-12', tz: 'Asia/Manila' };

  it('a normal capture after flying west still joins the open jar, with the phone zone as before', () => {
    expect(queueTarget({ tz: 'Pacific/Honolulu', shotAt: at, openJar })).toEqual({
      localDate: '2026-11-12',
      tz: 'Pacific/Honolulu',
      capturedAt: '2026-11-11T07:00:00-10:00',
    });
    expect(queueTarget({ tz: 'Pacific/Honolulu', shotAt: at, openJar, fill: null }).localDate).toBe('2026-11-12');
  });

  it('a Fill after flying west goes to the past date, not the open jar', () => {
    const fill = { localDate: '2026-11-09', tz: 'Asia/Manila' };
    expect(queueTarget({ tz: 'Pacific/Honolulu', shotAt: at, openJar, fill })).toMatchObject(fill);
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

describe('galleryTarget (FR-CAP-02; AGENTS "Which jar" point 3)', () => {
  // 14:14 on the 11th in Manila; today's jar is open.
  const now = shotAt;
  const openJar = { id: 'jar-11', localDate: '2026-11-11', tz: 'Asia/Manila' };
  const exif = (DateTimeOriginal: string, OffsetTimeOriginal?: string) => ({ DateTimeOriginal, OffsetTimeOriginal });

  it("a photo taken on an earlier day goes to that day's jar, with its own capture time", () => {
    expect(galleryTarget({ exif: exif('2026:11:08 19:30:00', '+08:00'), tz: 'Asia/Manila', now, openJar })).toEqual({
      localDate: '2026-11-08',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-08T19:30:00+08:00',
    });
  });

  it('an EXIF time without offset is read in the phone zone', () => {
    expect(galleryTarget({ exif: exif('2026:11:10 23:50:00'), tz: 'Asia/Manila', now, openJar })).toMatchObject({
      localDate: '2026-11-10',
      capturedAt: '2026-11-10T23:50:00+08:00',
    });
  });

  it('a photo from earlier today joins the open jar with its EXIF time', () => {
    expect(galleryTarget({ exif: exif('2026:11:11 08:00:00', '+08:00'), tz: 'Asia/Manila', now, openJar })).toEqual({
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-11T08:00:00+08:00',
    });
  });

  it.each([
    ['no EXIF', null],
    ['EXIF without a time', { Make: 'Apple' }],
    ['a future EXIF time (wrong camera clock)', exif('2027:01:01 10:00:00', '+08:00')],
    ['an unreadable EXIF time', exif('0000:00:00 00:00:00')],
  ])('%s: taken now, open jar', (_label, value) => {
    expect(galleryTarget({ exif: value, tz: 'Asia/Manila', now, openJar })).toEqual({
      localDate: '2026-11-11',
      tz: 'Asia/Manila',
      capturedAt: '2026-11-11T14:14:05+08:00',
    });
  });

  it('Fill this jar wins over the photo date, in that jar zone', () => {
    const fill = { localDate: '2026-11-05', tz: 'Asia/Tokyo' };
    expect(
      galleryTarget({ exif: exif('2026:11:08 19:30:00', '+08:00'), tz: 'Asia/Manila', now, openJar, fill }),
    ).toEqual({ localDate: '2026-11-05', tz: 'Asia/Tokyo', capturedAt: '2026-11-08T19:30:00+08:00' });
    expect(galleryTarget({ exif: null, tz: 'Asia/Manila', now, openJar, fill })).toMatchObject(fill);
  });

  describe('after flying west (travel rule)', () => {
    // 01:00 on the 12th in Manila: the Manila jar of the 12th is open; the phone is now in Honolulu (11th).
    const at = new Date('2026-11-11T17:00:00Z');
    const manila12 = { id: 'jar-12', localDate: '2026-11-12', tz: 'Asia/Manila' };

    it('a photo taken today (phone zone) joins the open jar, like a camera photo', () => {
      const target = galleryTarget({
        exif: exif('2026:11:11 06:00:00'),
        tz: 'Pacific/Honolulu',
        now: at,
        openJar: manila12,
      });
      expect(target.localDate).toBe('2026-11-12');
      expect(target.localDate).toBe(queueTarget({ tz: 'Pacific/Honolulu', shotAt: at, openJar: manila12 }).localDate);
    });

    it('a photo from yesterday (phone zone) still goes to that day', () => {
      expect(
        galleryTarget({ exif: exif('2026:11:10 12:00:00'), tz: 'Pacific/Honolulu', now: at, openJar: manila12 })
          .localDate,
      ).toBe('2026-11-10');
    });
  });
});

describe('saveGalleryPhoto', () => {
  const target = { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T19:30:00+08:00' };
  const crop = {
    crop: { originX: 1250, originY: 0, width: 1500, height: 2000 },
    cropBasis: { width: 4000, height: 2000 },
    rotate: 0,
    flip: false,
  } as const;
  const gallery = { uri: 'file:///picker/IMG_0042.jpg', slot: 'ootd', userId, target, crop } as const;

  it('queues the raw photo with its crop and date first, held for the editor, then prepares it', async () => {
    const item = await saveGalleryPhoto(gallery);
    expect(item.id).toBe(7);
    expect(enqueue).toHaveBeenCalledWith({
      userId,
      photoUri: 'file:///picker/IMG_0042.jpg',
      thumbUri: null,
      slot: 'ootd',
      ...target,
      // Raw: the uploader prepares it (crop applied, no location) before any network call.
      prepared: false,
      editing: true,
      crop,
      replace: false,
    });
    expect(mockLog).toEqual(['enqueue', 'delete file:///picker/IMG_0042.jpg', 'prepare']);
    expect(requestUploads).not.toHaveBeenCalled();
    mockFinishPrepare?.();
    await flush();
    expect(mockLog.slice(-1)).toEqual(['requestUploads']);
  });

  it('an exactly 3:4 photo is queued without crop choices', async () => {
    await saveGalleryPhoto({ ...gallery, crop: null });
    expect(jest.mocked(enqueue).mock.calls[0]?.[0]).not.toHaveProperty('crop');
  });

  it('keeps the picked file and prepares nothing when queueing fails', async () => {
    jest.mocked(enqueue).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveGalleryPhoto(gallery)).rejects.toThrow('disk full');
    expect(prepareItem).not.toHaveBeenCalled();
    expect(mockDeleted).toEqual([]);
  });
});
