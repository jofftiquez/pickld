// The native manipulator can't run under Jest, so it is mocked; the outputs are real fixture files,
// read back through the same location check the app runs on device.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LocationMetadataError } from '../exif';
import { preparePhoto } from '../pipeline';

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
    SaveFormat: { WEBP: 'webp' },
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

  it('refuses and deletes outputs that still carry GPS', async () => {
    mockState.fullFixture = 'gps.webp';
    await expect(preparePhoto('file:///picked.jpg')).rejects.toBeInstanceOf(LocationMetadataError);
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp', 'file:///cache/out-1.webp']);
    expect(mockState.released).toBe(6);
  });

  it('the source fixture really has GPS, the clean output really has none', () => {
    const read = (name: string) => readFileSync(join(__dirname, '__fixtures__', name)).toString('latin1');
    expect(read('gps.webp')).toContain('EXIF');
    expect(read('clean.webp')).not.toContain('EXIF');
  });
});
