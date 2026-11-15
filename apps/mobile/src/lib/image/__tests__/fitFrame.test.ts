// Skia's native canvas can't run under Jest, so its imperative API is a recorder: the test reads back what
// would be drawn on the 1440 × 1920 frame.
import { composeFit } from '../fitFrame';

const mockDraws: unknown[][] = [];
const mockWritten: { name: string; bytes: Uint8Array }[] = [];
const mockDisposed: string[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const photo = { width: () => 1440, height: () => 810, dispose: () => mockDisposed.push('photo') };
  return {
    TileMode: { Clamp: 'clamp' },
    FilterMode: { Linear: 'linear' },
    MipmapMode: { None: 'none' },
    ImageFormat: { PNG: 'png' },
    Skia: {
      Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
      Image: { MakeImageFromEncoded: () => photo },
      Color: (hex: string) => `color(${hex})`,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      Paint: () => {
        const paint: { filter?: unknown; setImageFilter: (f: unknown) => void } = {
          setImageFilter: (filter) => {
            paint.filter = filter;
          },
        };
        return paint;
      },
      ImageFilter: { MakeBlur: (...args: unknown[]) => ({ blur: args }) },
      Surface: {
        Make: (width: number, height: number) => ({
          getCanvas: () => ({
            drawColor: (...args: unknown[]) => mockDraws.push(['drawColor', ...args]),
            drawImage: (image: unknown, x: number, y: number) => mockDraws.push(['drawImage', image === photo, x, y]),
            drawImageRectOptions: (
              image: unknown,
              src: unknown,
              dst: unknown,
              fm: unknown,
              mm: unknown,
              paint: object,
            ) =>
              mockDraws.push([
                'drawImageRectOptions',
                image === photo,
                src,
                dst,
                fm,
                mm,
                (paint as { filter: unknown }).filter,
              ]),
          }),
          makeImageSnapshot: () => ({ encodeToBytes: (fmt: string) => new Uint8Array([fmt.length, width, height]) }),
          dispose: () => mockDisposed.push('surface'),
        }),
      },
    },
  };
});

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    name: string;
    uri: string;
    constructor(...parts: string[]) {
      this.name = parts.at(-1) ?? '';
      this.uri = parts.length > 1 ? `${parts[0]}/${this.name}` : this.name;
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
    create() {}
    write(bytes: Uint8Array) {
      mockWritten.push({ name: this.name, bytes });
    }
  },
}));

const box = { originX: 0, originY: 555, width: 1440, height: 810 };
const out = { width: 1440, height: 1920 };

beforeEach(() => {
  mockDraws.length = 0;
  mockWritten.length = 0;
  mockDisposed.length = 0;
});

describe('composeFit (D-152)', () => {
  it('a colour frame: fills the frame with the token colour, then draws the photo 1:1 at its box', async () => {
    const uri = await composeFit('file:///cache/photo.png', box, 'cream', out);
    expect(mockDraws).toEqual([
      ['drawColor', 'color(#f3ecdc)'],
      ['drawImage', true, 0, 555],
    ]);
    expect(uri).toMatch(/^file:\/\/\/cache\/fit-.+\.png$/);
    expect(mockWritten).toHaveLength(1);
    expect(mockDisposed.sort()).toEqual(['photo', 'surface']);
  });

  it.each([
    ['white', '#ffffff'],
    ['offWhite', '#f4f5f0'],
    ['black', '#000000'],
  ] as const)('%s fills with %s', async (frame, hex) => {
    await composeFit('file:///cache/photo.png', box, frame, out);
    expect(mockDraws[0]).toEqual(['drawColor', `color(${hex})`]);
  });

  it('blur: the photo cropped to cover the frame (its centred 3:4), blurred at sigma 0.035 × 1440, under the photo', async () => {
    await composeFit('file:///cache/photo.png', box, 'blur', out);
    // 1440 × 810: the centred 3:4 is 608 × 810 at x 416, stretched over the whole 1440 × 1920 frame.
    expect(mockDraws).toEqual([
      [
        'drawImageRectOptions',
        true,
        { x: 416, y: 0, width: 608, height: 810 },
        { x: 0, y: 0, width: 1440, height: 1920 },
        'linear',
        'none',
        { blur: [expect.closeTo(50.4, 6), expect.closeTo(50.4, 6), 'clamp', null] },
      ],
      ['drawImage', true, 0, 555],
    ]);
  });
});
