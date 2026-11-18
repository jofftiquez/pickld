// The native manipulator can't run under Jest, so it is mocked; the outputs are real fixture files,
// read back through the same location check the app runs on device.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LocationMetadataError } from '../exif';
import { flipPhoto, prepareMedium, preparePhoto } from '../pipeline';

type Op = [string, unknown];

const isWebp = (save: { options: unknown }) => (save.options as { format: string }).format === 'webp';

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
      // The first WebP written is the full photo (Fit writes a PNG scratch copy before it).
      const first = (options as { format: string }).format === 'webp' && !mockState.saves.some((s) => isWebp(s));
      mockState.outputs[uri] = first ? mockState.fullFixture : 'clean.webp';
      mockState.saves.push({ width, height, options });
      return { uri, width, height };
    },
  });
  return {
    SaveFormat: { WEBP: 'webp', JPEG: 'jpeg', PNG: 'png' },
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

// Fit's frame is drawn with Skia (fitFrame.test covers the drawing); here it only hands back its PNG.
const mockCompose = jest.fn(async (..._args: unknown[]) => 'file:///cache/fit-frame.png');
jest.mock('../fitFrame', () => ({ composeFit: (...args: unknown[]) => mockCompose(...args) }));
// Straighten's tilt is drawn with Skia too; here it only hands back its PNG.
const mockStraighten = jest.fn(async (..._args: unknown[]) => 'file:///cache/level.png');
jest.mock('../straighten', () => ({ drawStraightened: (...args: unknown[]) => mockStraighten(...args) }));

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
  Object.assign(mockState, {
    outputs: {},
    saves: [],
    ops: [],
    released: 0,
    deleted: [],
    fullFixture: 'clean.webp',
    sourceSize: { width: 4032, height: 3024 },
  });
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

  it('after a quarter turn the frame is scaled from the picked size turned the same way', async () => {
    // Measured on a 2016 × 1512 report, turned to 1512 × 2016: the whole turned photo is the whole 3024 × 4032 one.
    await preparePhoto('file:///picked.jpg', {
      rotate: 90,
      crop: { originX: 0, originY: 0, width: 1512, height: 2016 },
      cropBasis: { width: 2016, height: 1512 },
    });
    expect(mockState.ops[1]?.[0]).toEqual(['crop', { originX: 0, originY: 0, width: 3024, height: 4032 }]);
  });

  it('Straighten: draws the frame of the levelled photo at 1440 × 1920 instead of cropping the source', async () => {
    mockStraighten.mockClear();
    await preparePhoto('file:///picked.jpg', {
      crop: { originX: 100, originY: 50, width: 600, height: 800 },
      cropBasis: { width: 2016, height: 1512 },
      straighten: 5,
    });
    // The turned photo is written once (nearly lossless) for Skia, which gets the frame scaled to the decoded size.
    expect(mockState.saves[0]?.options).toEqual({ format: 'jpeg', compress: 1 });
    expect(mockStraighten).toHaveBeenCalledWith(
      'file:///cache/out-0.webp',
      5,
      { originX: 200, originY: 100, width: 1200, height: 1600 },
      { width: 1440, height: 1920 },
    );
    // Nothing crops or resizes the source; full is read from the drawn PNG.
    expect(mockState.ops.flat().some(([op]) => op === 'crop')).toBe(false);
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp', 'file:///cache/level.png']);
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

describe('preparePhoto with Fit (D-152)', () => {
  beforeEach(() => {
    mockCompose.mockClear();
    mockState.sourceSize = { width: 3840, height: 2160 };
  });

  it('scales the whole photo from the decoded source, frames it at 1440 × 1920, then writes full and thumbnail', async () => {
    const result = await preparePhoto('file:///picked.jpg', {
      crop: { originX: 10, originY: 20, width: 300, height: 400 },
      fit: { frame: 'blur' },
    });
    expect(result).toEqual({
      full: { uri: 'file:///cache/out-1.webp', width: 1440, height: 1920 },
      thumb: { uri: 'file:///cache/out-2.webp', width: 480, height: 640 },
    });
    expect(mockState.ops).toEqual([
      [],
      // 3840 × 2160 → 1440 × 810, straight from the source, never cropped (Crop's frame is ignored).
      [['resize', { width: 1440, height: 810 }]],
      [['resize', { width: 1440, height: 1920 }]],
      [['resize', { width: 480, height: 640 }]],
    ]);
    expect(mockCompose).toHaveBeenCalledWith(
      'file:///cache/out-0.webp',
      {
        box: { originX: 0, originY: 555, width: 1440, height: 810 },
        photo: { originX: 0, originY: 555, width: 1440, height: 810 },
        border: 0,
        radius: 0,
      },
      expect.objectContaining({ frame: 'blur', border: 'none', corners: 'none' }),
      { width: 1440, height: 1920 },
    );
    expect(mockState.saves.map((s) => s.options)).toEqual([
      { format: 'png' },
      { format: 'webp', compress: 0.85 },
      { format: 'webp', compress: 0.8 },
    ]);
    // The scratch photo and the framed PNG are deleted; the outputs stay.
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp', 'file:///cache/fit-frame.png']);
    expect(mockState.released).toBe(8); // 4 contexts + 4 images
  });

  it('turns and mirrors before fitting: a quarter turn makes the 16:9 photo tall, so it gets the full height', async () => {
    await preparePhoto('file:///picked.jpg', { rotate: 90, flip: true, fit: { frame: 'white' } });
    expect(mockState.ops[0]).toEqual([
      ['rotate', 90],
      ['flip', 'horizontal'],
    ]);
    // 2160 × 3840 at 1920 / 3840 = 0.5: 1080 × 1920, bars of 180 left and right.
    expect(mockState.ops[1]).toEqual([['resize', { width: 1080, height: 1920 }]]);
    expect(mockCompose.mock.calls[0]?.[1]).toMatchObject({
      photo: { originX: 180, originY: 0, width: 1080, height: 1920 },
    });
  });

  it('D-154: resizes the source straight to the laid-out photo size, and hands composeFit its place and look', async () => {
    await preparePhoto('file:///picked.jpg', {
      fit: { frame: 'cream', scale: 0.6, x: 0.1, y: 0.2, border: 'medium', borderColor: 'black', corners: 'small' },
    });
    // 3840 × 2160 at 0.21375 (crop.test): 820 × 462 after rounding each edge, from the full-resolution source.
    expect(mockState.ops[1]).toEqual([['resize', { width: 820, height: 462 }]]);
    expect(mockCompose.mock.calls[0]?.[1]).toEqual({
      box: { originX: 418, originY: 1077, width: 892, height: 534 },
      photo: { originX: 454, originY: 1113, width: 820, height: 462 },
      border: 36,
      radius: 72,
    });
    expect(mockCompose.mock.calls[0]?.[2]).toMatchObject({ frame: 'cream', borderColor: 'black' });
    // Full and thumbnail are still resizes of the framed 1440 × 1920 picture.
    expect(mockState.ops.slice(2)).toEqual([
      [['resize', { width: 1440, height: 1920 }]],
      [['resize', { width: 480, height: 640 }]],
    ]);
  });

  it('Straighten in Fit: the whole levelled photo is drawn at the laid-out size, then framed', async () => {
    mockStraighten.mockClear();
    await preparePhoto('file:///picked.jpg', { fit: { frame: 'white' }, straighten: -8 });
    // A 16:9 photo tilted 8°: its height binds, so the levelled middle is 1 / (cos 8° + 16/9 sin 8°) of it.
    const k = 1 / (Math.cos((8 * Math.PI) / 180) + (16 / 9) * Math.sin((8 * Math.PI) / 180));
    const [uri, degrees, rect, size] = mockStraighten.mock.calls[0] as [
      string,
      number,
      Record<string, number>,
      unknown,
    ];
    expect([uri, degrees, size]).toEqual(['file:///cache/out-0.webp', -8, { width: 1440, height: 810 }]);
    expect(rect.originX).toBe(0);
    expect(rect.originY).toBe(0);
    expect(rect.width).toBeCloseTo(3840 * k, 6);
    expect(rect.height).toBeCloseTo(2160 * k, 6);
    expect(mockCompose.mock.calls[0]?.[0]).toBe('file:///cache/level.png');
    expect(mockCompose.mock.calls[0]?.[1]).toMatchObject({
      photo: { originX: 0, originY: 555, width: 1440, height: 810 },
    });
  });

  it('a framed photo still goes through the location check, and nothing is left behind', async () => {
    mockState.fullFixture = 'gps.webp';
    await expect(preparePhoto('file:///picked.jpg', { fit: { frame: 'black' } })).rejects.toBeInstanceOf(
      LocationMetadataError,
    );
    expect(mockState.deleted).toEqual([
      'file:///cache/out-1.webp',
      'file:///cache/out-2.webp',
      'file:///cache/out-0.webp',
      'file:///cache/fit-frame.png',
    ]);
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

describe('prepareMedium (NFR-PERF-02)', () => {
  it('writes the 1080 × 1440 feed copy of the full photo as WebP q80', async () => {
    mockState.sourceSize = { width: 1440, height: 1920 };
    const result = await prepareMedium('file:///queue/full.webp');
    expect(result).toEqual({ uri: 'file:///cache/out-0.webp', width: 1080, height: 1440 });
    expect(mockState.ops).toEqual([[['resize', { width: 1080, height: 1440 }]]]);
    expect(mockState.saves.map((s) => s.options)).toEqual([{ format: 'webp', compress: 0.8 }]);
    expect(mockState.released).toBe(2);
    expect(mockState.deleted).toEqual([]);
  });

  it('refuses and deletes a copy that carries location', async () => {
    mockState.fullFixture = 'gps.webp';
    await expect(prepareMedium('file:///queue/full.webp')).rejects.toBeInstanceOf(LocationMetadataError);
    expect(mockState.deleted).toEqual(['file:///cache/out-0.webp']);
  });
});
