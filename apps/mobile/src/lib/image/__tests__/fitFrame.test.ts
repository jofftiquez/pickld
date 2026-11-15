// Skia's native canvas can't run under Jest, so its imperative API is a recorder: the test reads back what
// would be drawn on the 1440 × 1920 frame.
import { fitPixels, DEFAULT_FIT_LAYOUT } from '../crop';
import { composeFit } from '../fitFrame';

const mockDraws: unknown[][] = [];
const mockWritten: { name: string; bytes: Uint8Array }[] = [];
const mockDisposed: string[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const photo = { width: () => 1440, height: () => 810, dispose: () => mockDisposed.push('photo') };
  return {
    TileMode: { Clamp: 'clamp' },
    ClipOp: { Intersect: 'intersect' },
    FilterMode: { Linear: 'linear' },
    MipmapMode: { None: 'none' },
    ImageFormat: { PNG: 'png' },
    Skia: {
      Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
      Image: { MakeImageFromEncoded: () => photo },
      Color: (hex: string) => `color(${hex})`,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      RRectXY: (rect: object, rx: number, ry: number) => ({ ...rect, rx, ry }),
      Paint: () => {
        const paint: {
          filter?: unknown;
          color?: unknown;
          antiAlias?: boolean;
          setImageFilter: (f: unknown) => void;
          setColor: (c: unknown) => void;
          setAntiAlias: (aa: boolean) => void;
        } = {
          setImageFilter: (filter) => {
            paint.filter = filter;
          },
          setColor: (color) => {
            paint.color = color;
          },
          setAntiAlias: (aa) => {
            paint.antiAlias = aa;
          },
        };
        return paint;
      },
      ImageFilter: { MakeBlur: (...args: unknown[]) => ({ blur: args }) },
      Surface: {
        Make: (width: number, height: number) => ({
          getCanvas: () => ({
            drawColor: (...args: unknown[]) => mockDraws.push(['drawColor', ...args]),
            drawRRect: (rrect: unknown, paint: { color: unknown; antiAlias?: boolean }) =>
              mockDraws.push(['drawRRect', rrect, paint.color, paint.antiAlias]),
            save: () => mockDraws.push(['save']),
            restore: () => mockDraws.push(['restore']),
            clipRRect: (rrect: unknown, op: unknown, aa: boolean) => mockDraws.push(['clipRRect', rrect, op, aa]),
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

const out = { width: 1440, height: 1920 };
// A 16:9 photo whole and centred, no border, square corners: what D-152's Fit drew.
const plain = fitPixels({ width: 3840, height: 2160 }, out, DEFAULT_FIT_LAYOUT);

beforeEach(() => {
  mockDraws.length = 0;
  mockWritten.length = 0;
  mockDisposed.length = 0;
});

describe('composeFit (D-152)', () => {
  it('rounded corners with a border (D-154): the border box under, then the photo clipped to the inner curve', async () => {
    // Medium black border (36), small corners (36 on the photo, 72 outside), at 0.6 size moved (0.1, 0.2):
    // box 892 × 534 at (418, 1077), photo 820 × 462 at (454, 1113) (crop.test works these out).
    const place = fitPixels({ width: 3840, height: 2160 }, out, {
      ...DEFAULT_FIT_LAYOUT,
      scale: 0.6,
      x: 0.1,
      y: 0.2,
      border: 'medium',
      corners: 'small',
    });
    await composeFit('file:///cache/photo.png', place, { frame: 'cream', borderColor: 'black' }, out);
    expect(mockDraws).toEqual([
      ['drawColor', 'color(#f3ecdc)'],
      ['drawRRect', { x: 418, y: 1077, width: 892, height: 534, rx: 72, ry: 72 }, 'color(#000000)', true],
      ['save'],
      ['clipRRect', { x: 454, y: 1113, width: 820, height: 462, rx: 36, ry: 36 }, 'intersect', true],
      ['drawImage', true, 454, 1113],
      ['restore'],
    ]);
  });

  it('a border with square corners: a plain box under the photo, no clip', async () => {
    const place = fitPixels({ width: 3840, height: 2160 }, out, { ...DEFAULT_FIT_LAYOUT, scale: 0.5, border: 'thin' });
    await composeFit('file:///cache/photo.png', place, { frame: 'black', borderColor: 'white' }, out);
    expect(mockDraws.map((d) => d[0])).toEqual(['drawColor', 'drawRRect', 'drawImage']);
    expect(mockDraws[1]?.[1]).toMatchObject({ rx: 0, ry: 0 });
    expect(mockDraws[1]?.[2]).toBe('color(#ffffff)');
    expect(mockDraws[2]).toEqual(['drawImage', true, place.photo.originX, place.photo.originY]);
  });

  it('rounded corners without a border: the photo clipped to them, no box drawn', async () => {
    const place = fitPixels({ width: 3840, height: 2160 }, out, { ...DEFAULT_FIT_LAYOUT, corners: 'large' });
    await composeFit('file:///cache/photo.png', place, { frame: 'white', borderColor: 'white' }, out);
    // Large: 60 / 480 × 1440 = 180 on the photo's corners.
    expect(mockDraws).toEqual([
      ['drawColor', 'color(#ffffff)'],
      ['save'],
      ['clipRRect', { x: 0, y: 555, width: 1440, height: 810, rx: 180, ry: 180 }, 'intersect', true],
      ['drawImage', true, 0, 555],
      ['restore'],
    ]);
  });

  it('a colour frame: fills the frame with the token colour, then draws the photo 1:1 at its box', async () => {
    const uri = await composeFit('file:///cache/photo.png', plain, { frame: 'cream', borderColor: 'white' }, out);
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
    await composeFit('file:///cache/photo.png', plain, { frame, borderColor: 'white' }, out);
    expect(mockDraws[0]).toEqual(['drawColor', `color(${hex})`]);
  });

  it('blur: the photo cropped to cover the frame (its centred 3:4), blurred at sigma 0.035 × 1440, under the photo', async () => {
    await composeFit('file:///cache/photo.png', plain, { frame: 'blur', borderColor: 'white' }, out);
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
