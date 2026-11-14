import { centerCrop, prepareProfileImage } from '../profileImage';

// The decoded photo is half the picker's size, so a crop measured on the picker's pixels must be scaled.
const mockCrop = jest.fn();
const mockResize = jest.fn();
const mockSave = jest.fn(async (_options: unknown) => ({ uri: 'file:///cache/out.jpg' }));
jest.mock('expo-image-manipulator', () => {
  const rendered = (width: number, height: number) => ({ width, height, release: jest.fn(), saveAsync: mockSave });
  const context = {
    crop: (rect: unknown) => {
      mockCrop(rect);
      return context;
    },
    resize: (size: unknown) => {
      mockResize(size);
      return context;
    },
    renderAsync: async () => rendered(1500, 2000),
    release: jest.fn(),
  };
  return { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: 'jpeg' } };
});
jest.mock('expo-file-system', () => ({
  File: class {
    size = 4321;
    bytes = async () => new Uint8Array();
    delete = jest.fn();
  },
}));
jest.mock('../exif', () => ({ assertNoLocationMetadata: jest.fn() }));

describe('centerCrop', () => {
  it('takes the middle square of a portrait photo for an avatar', () => {
    expect(centerCrop(3000, 4000, 1)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it('takes a full-width 5:2 band from the middle of a portrait photo for a cover', () => {
    expect(centerCrop(3000, 4000, 2.5)).toEqual({ originX: 0, originY: 1400, width: 3000, height: 1200 });
  });

  it('trims the sides of a very wide photo', () => {
    expect(centerCrop(6000, 1000, 2.5)).toEqual({ originX: 1750, originY: 0, width: 2500, height: 1000 });
  });
});

describe('prepareProfileImage (D-79)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crops to the Crop screen’s square, scaled to the decoded size, then writes a 512 × 512 JPEG', async () => {
    const crop = {
      rect: { originX: 0, originY: 1000, width: 3000, height: 3000 },
      basis: { width: 3000, height: 4000 },
    };
    await expect(prepareProfileImage('file:///picker/me.jpg', 'avatar', crop)).resolves.toEqual({
      uri: 'file:///cache/out.jpg',
      size: 4321,
    });
    expect(mockCrop).toHaveBeenCalledWith({ originX: 0, originY: 500, width: 1500, height: 1500 });
    expect(mockResize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  });

  it('crops a cover to its 5:2 band; without a crop it takes the centred one', async () => {
    const crop = { rect: { originX: 0, originY: 0, width: 3000, height: 1200 }, basis: { width: 3000, height: 4000 } };
    await prepareProfileImage('file:///picker/me.jpg', 'cover', crop);
    expect(mockCrop).toHaveBeenLastCalledWith({ originX: 0, originY: 0, width: 1500, height: 600 });
    expect(mockResize).toHaveBeenLastCalledWith({ width: 1500, height: 600 });
    await prepareProfileImage('file:///picker/me.jpg', 'cover');
    expect(mockCrop).toHaveBeenLastCalledWith({ originX: 0, originY: 700, width: 1500, height: 600 });
  });
});
