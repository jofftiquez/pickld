// prepareItem hands the Crop screen's choices to the image pipeline, and the default crop otherwise.
import { preparePhoto } from '@/lib/image/pipeline';

import { prepareItem } from '../prepare';
import { savePrepared, type QueueItem } from '../store';

jest.mock('expo-file-system', () => ({
  File: class {
    get exists() {
      return false;
    }
    delete() {}
  },
}));
jest.mock('@/lib/image/pipeline', () => ({
  preparePhoto: jest.fn(async () => ({
    full: { uri: 'file:///cache/full.webp', width: 1440, height: 1920 },
    thumb: { uri: 'file:///cache/thumb.webp', width: 480, height: 640 },
  })),
}));
jest.mock('../store', () => ({
  getItem: jest.fn(),
  savePrepared: jest.fn(async (id: number) => ({ id, prepared: true })),
}));

const raw = { id: 3, photoUri: 'file:///docs/queue/raw.jpg', prepared: false, crop: null } as unknown as QueueItem;
const spec = {
  crop: { originX: 0, originY: 10, width: 300, height: 400 },
  cropBasis: { width: 600, height: 400 },
  rotate: 270,
  flip: true,
} as const;

beforeEach(() => {
  jest.mocked(preparePhoto).mockClear();
  jest.mocked(savePrepared).mockClear();
});

it('prepares a gallery photo with its crop, rotation and flip', async () => {
  await prepareItem({ ...raw, crop: spec });
  expect(preparePhoto).toHaveBeenCalledWith('file:///docs/queue/raw.jpg', spec);
  expect(savePrepared).toHaveBeenCalledWith(3, {
    photoUri: 'file:///cache/full.webp',
    thumbUri: 'file:///cache/thumb.webp',
  });
});

it('a camera photo gets the centred 3:4 crop', async () => {
  await prepareItem(raw);
  expect(preparePhoto).toHaveBeenCalledWith('file:///docs/queue/raw.jpg', {});
});

it('an already prepared item is left alone', async () => {
  await prepareItem({ ...raw, prepared: true });
  expect(preparePhoto).not.toHaveBeenCalled();
});
