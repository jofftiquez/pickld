// The native manipulator can't run under Jest, so it is mocked; the outputs are real fixture files,
// read back through the same location check the app runs on device.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LocationMetadataError } from '../exif';
import { flipPhoto, preparePhoto } from '../pipeline';

type Op = [string, unknown];

const mockState = {
  outputs: {} as Record<string, string>, // output uri → fixture name
  saves: [] as { width: number; height: number; options: unknown }[],
  ops: [] as Op[][],
  released: 0,
  deleted: [] as string[],
  sourceSize: { width: 4032, height: 3024 },
  fullFixture: 'clean.webp',
};

jest.mock('expo-image-manipulator', () => {
  const makeImage = (width: number, height: number) => ({
    width,
    height,
    release: () => {
      mockState.released += 1;
    },
    saveAsync: async (options: unknown) => {
      const uri = `file:///cache/out-${mockState.saves.length}.webp`;
      mockState.outputs[uri] = mockState.saves.length === 0 ? mockState.fullFixture : 'clean.webp';
      mockState.saves.push({ width, height, options });
      return { uri, width, height };
    },
  });
  return {
    SaveFormat: { WEBP: 'webp', JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate: (source: unknown) => {
        const ops: Op[] = [];
        mockState.ops.push(ops);
        let size = typeof source === 'string' ? mockState.sourceSize : (source as { width: number; height: number });
        const ctx = {
          crop: (rect: { width: number; height: number }) => {
            ops.push(['crop', rect]);
            size = rect;
            return ctx;
          },
          rotate: (degrees: number) => {
            ops.push(['rotate', degrees]);
            if (degrees % 180 !== 0) size = { width: size.height, height: size.width };
            return ctx;
          },
          flip: (axis: string) => {
            ops.push(['flip', axis]);
            return ctx;
          },
          resize: (s: { width: number; height: number }) => {
            ops.push(['resize', s]);
            size = s;
            return ctx;
          },
          renderAsync: async () => makeImage(size.width, size.height),
          release: () => {
            mockState.released += 1;
          },
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
      constructor(mockUriArg: string) {
        this.mockUri = mockUriArg;
      }
      async bytes() {
        const name = mockState.outputs[this.mockUri];
        if (!name) throw new Error(`No such file ${this.mockUri}`);
        return new Uint8Array(nodeFs.readFileSync(nodePath.join(__dirname, '__fixtures__', name)));
      }
      delete() {
        mockState.deleted.push(this.mockUri);
      }
    },
  };
});

beforeEach(() => {
  Object.assign(mockState, { outputs: {}, saves: [], ops: [], released: 0, deleted: [], fullFixture: 'clean.webp' });
});

describe('preparePhoto', () => {
  it('crops to 3:4 and writes 1440×1920 and 480×640 WebP', async () => {
    const result = await preparePhoto('file:///picked.jpg');
    expect(result).toEqual({
      full: { uri: 'file:///cache/out-0.webp', width: 1440, height: 1920 },
      thumb: { uri: 'file:///cache/out-1.webp', width: 480, height: 640 },
    });
    expect(mockState.ops).toEqual([
      [],
      [
        ['crop', { originX: 882, originY: 0, width: 2268, height: 3024 }],
        ['resize', { width: 1440, height: 1920 }],
      ],
      [['resize', { width: 480, height: 640 }]],
    ]);
    expect(mockState.saves.map((s) => s.options)).toEqual([
      { format: 'webp', compress: 0.85 },
      { format: 'webp', compress: 0.8 },
    ]);
    expect(mockState.released).toBe(6); // 3 contexts + 3 images
    expect(mockState.deleted).toEqual([]);
  });

  it('uses the Crop screen frame when given', async () => {
    await preparePhoto('file:///picked.jpg', { crop: { originX: 10, originY: 20, width: 300, height: 400 } });
    expect(mockState.ops[1]?.[0]).toEqual(['crop', { originX: 10, originY: 20, width: 300, height: 400 }]);
  });

  it('turns and mirrors the photo before cropping, and crops the turned image', async () => {
    // 4032 × 3024 turned a quarter: 3024 × 4032, already 3:4.
    await preparePhoto('file:///picked.jpg', {
      rotate: 90,
      flip: true,
      crop: { originX: 0, originY: 1000, width: 1500, height: 2000 },
    });
    expect(mockState.ops[0]).toEqual([
      ['rotate', 90],
      ['flip', 'horizontal'],
    ]);
    expect(mockState.ops[1]?.[0]).toEqual(['crop', { originX: 0, originY: 1000, width: 1500, height: 2000 }]);
    expect(mockState.saves.map((s) => [s.width, s.height])).toEqual([
      [1440, 1920],
      [480, 640],
    ]);
  });

  it('a 180° turn without flip only rotates; no options leave the photo as it is', async () => {
    await preparePhoto('file:///picked.jpg', { rotate: 180, flip: false });
    expect(mockState.ops[0]).toEqual([['rotate', 180]]);
    mockState.ops = [];
    await preparePhoto('file:///picked.jpg', { rotate: 0 });
    expect(mockState.ops[0]).toEqual([]);
  });

  it('scales the frame from the size the Crop screen measured to the size it decodes', async () => {
    // Measured on a 2016 × 1512 report of the 4032 × 3024 photo: everything doubles.
    await preparePhoto('file:///picked.jpg', {
      crop: { originX: 100, originY: 50, width: 600, height: 800 },
      cropBasis: { width: 2016, height: 1512 },
    });
    expect(mockState.ops[1]?.[0]).toEqual(['crop', { originX: 200, originY: 100, width: 1200, height: 1600 }]);
  });

  it('refuses and deletes outputs that still carry GPS', async () => {
    mockState.fullFixture = 'gps.webp';
    await expect(preparePhoto('file:///picked.jpg')).rejects.toBeInstanceOf(LocationMetadataError);
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp', 'file:///cache/out-1.webp']);
    expect(mockState.released).toBe(6);
  });

  it('a turned and cropped photo still goes through the location check', async () => {
    mockState.fullFixture = 'gps.webp';
    await expect(
      preparePhoto('file:///picked.jpg', {
        rotate: 270,
        flip: true,
        crop: { originX: 0, originY: 0, width: 300, height: 400 },
      }),
    ).rejects.toBeInstanceOf(LocationMetadataError);
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp', 'file:///cache/out-1.webp']);
  });

  it('the source fixture really has GPS, the clean output really has none', () => {
    const read = (name: string) => readFileSync(join(__dirname, '__fixtures__', name)).toString('latin1');
    expect(read('gps.webp')).toContain('EXIF');
    expect(read('clean.webp')).not.toContain('EXIF');
  });
});

describe('flipPhoto (Mirror selfies off, D-66)', () => {
  it('writes a copy mirrored left to right, keeps the size, leaves the source and releases what it made', async () => {
    const uri = await flipPhoto('file:///camera/selfie.jpg');
    expect(mockState.ops).toEqual([[['flip', 'horizontal']]]);
    expect(mockState.saves).toEqual([{ width: 4032, height: 3024, options: { format: 'jpeg', compress: 0.95 } }]);
    expect(uri).toBe('file:///cache/out-0.webp');
    expect(mockState.deleted).toEqual([]);
    expect(mockState.released).toBe(2);
  });
});
