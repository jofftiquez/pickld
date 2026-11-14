// Sticker art that isn't bundled (D-131): the catalog offers it once its size is known, the art is downloaded once
// from the photo Worker by asset path and art version and kept on the phone, and a sticker the Worker doesn't have
// draws nothing instead of failing. The Worker, Supabase, the file system and the key-value store are stand-ins.
import { buildCatalog } from '../stickers/catalog';
import {
  pngSize,
  rememberStickerArt,
  requestStickerArt,
  resetRemoteStickerArt,
  settleStickerArt,
  stickerArtSize,
  useRemoteStickerArt,
} from '../stickers/remoteStickerArt';

const mockFiles = new Map<string, Uint8Array>();
const mockInvoke = jest.fn();
const mockSelectIn = jest.fn();

jest.mock('expo-file-system', () => {
  const join = (parent: { uri: string } | string, ...names: string[]) =>
    [typeof parent === 'string' ? parent : parent.uri, ...names].join('/');
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, ...names: string[]) {
      this.uri = join(parent, ...names);
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, ...names: string[]) {
      this.uri = join(parent, ...names);
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    get parentDirectory() {
      return new Directory(this.uri.split('/').slice(0, -1).join('/'));
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    write(bytes: Uint8Array) {
      mockFiles.set(this.uri, bytes);
    }
    move(to: { uri: string }) {
      mockFiles.set(to.uri, mockFiles.get(this.uri) ?? new Uint8Array());
      mockFiles.delete(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    async bytes() {
      return mockFiles.get(this.uri) ?? new Uint8Array();
    }
  }
  return { File, Directory, Paths: { document: { uri: 'file:///docs' } } };
});

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: mockInvoke },
    from: () => ({ select: () => ({ in: mockSelectIn }) }),
  }),
}));

/** A PNG's first 24 bytes: signature, then the IHDR chunk with width and height. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const fetchMock = jest.fn();
const ART = 'stickers/test-pack/hello.png';
const BUNDLED = 'stickers/everyday/kape-muna.png';

beforeEach(() => {
  resetRemoteStickerArt();
  mockFiles.clear();
  mockInvoke
    .mockReset()
    .mockResolvedValue({ data: { data: { stickerArtBase: 'https://photos.example.com' } }, error: null });
  mockSelectIn.mockReset().mockResolvedValue({ data: [], error: null });
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function respond(status: number, body: Uint8Array = new Uint8Array()) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => body.buffer });
}

describe('catalog', () => {
  const pack = {
    id: 'p1',
    slug: 'test-pack',
    name: 'Test pack',
    sort: 1,
    tier: 'free',
    store_product_id: null,
    available_from: null,
    available_to: null,
    pack_usable: true,
  };
  const sticker = (id: string, asset: string, size: { art_width: number | null; art_height: number | null }) => ({
    id,
    pack_id: 'p1',
    label: id.slice(0, 8),
    asset_path: asset,
    tags: [],
    slot_hint: null,
    stamp: null,
    milestone_key: null,
    sort: 1,
    sticker_usable: true,
    ...size,
  });

  it('offers art that is uploaded but not bundled, and only once its size is known', () => {
    const uploaded = sticker('11111111-1111-4111-8111-111111111111', ART, { art_width: 600, art_height: 240 });
    const notYet = sticker('22222222-2222-4222-8222-222222222222', 'stickers/test-pack/later.png', {
      art_width: null,
      art_height: null,
    });
    const catalog = buildCatalog([pack], [uploaded, notYet], null);
    expect(catalog.packs.flatMap((p) => p.stickers).map((s) => s.asset)).toEqual([ART]);
  });

  it('remembers the size of unbundled art from catalog rows, and keeps bundled art its own', () => {
    rememberStickerArt([
      { asset_path: ART, art_width: 600, art_height: 240, art_version: 3 },
      { asset_path: BUNDLED, art_width: 1, art_height: 1, art_version: 9 },
    ]);
    expect(stickerArtSize(ART)).toEqual({ width: 600, height: 240 });
    expect(useRemoteStickerArt.getState().meta[BUNDLED]).toBeUndefined();
    expect(stickerArtSize(BUNDLED)).not.toEqual({ width: 1, height: 1 });
  });
});

describe('download', () => {
  it('fetches the art once by asset path and art version, keeps it on the phone and reuses it', async () => {
    rememberStickerArt([{ asset_path: ART, art_width: 600, art_height: 240, art_version: 2 }]);
    respond(200, png(600, 240));
    await Promise.all([requestStickerArt(ART), requestStickerArt(ART)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://photos.example.com/stickers/test-pack/hello.png?v=2');
    expect(useRemoteStickerArt.getState().files[ART]).toBe('file:///docs/sticker-art/test-pack/hello@2.png');

    // A later app run finds the file on disk and doesn't download again.
    resetRemoteStickerArt();
    rememberStickerArt([{ asset_path: ART, art_width: 600, art_height: 240, art_version: 2 }]);
    await requestStickerArt(ART);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useRemoteStickerArt.getState().files[ART]).toBe('file:///docs/sticker-art/test-pack/hello@2.png');
  });

  it('looks up the size of a sticker seen only on a moment, or reads it from the art', async () => {
    mockSelectIn.mockResolvedValue({
      data: [{ asset_path: ART, art_width: 500, art_height: 200, art_version: 4 }],
      error: null,
    });
    respond(200, png(500, 200));
    await requestStickerArt(ART);
    expect(mockSelectIn).toHaveBeenCalledWith('asset_path', [ART]);
    expect(fetchMock).toHaveBeenCalledWith('https://photos.example.com/stickers/test-pack/hello.png?v=4');

    resetRemoteStickerArt();
    mockFiles.clear();
    mockSelectIn.mockResolvedValue({ data: [], error: null });
    respond(200, png(320, 160));
    await requestStickerArt(ART);
    expect(stickerArtSize(ART)).toEqual({ width: 320, height: 160 });
  });

  it('draws nothing for art the Worker does not have or that is not a PNG', async () => {
    respond(404);
    await requestStickerArt(ART);
    expect(useRemoteStickerArt.getState().missing[ART]).toBe(true);

    const other = 'stickers/test-pack/broken.png';
    respond(200, new TextEncoder().encode('<html>not art</html>'));
    await requestStickerArt(other);
    expect(useRemoteStickerArt.getState().missing[other]).toBe(true);
    expect(useRemoteStickerArt.getState().files[other]).toBeUndefined();

    await requestStickerArt('stickers/../secrets.png');
    expect(useRemoteStickerArt.getState().missing['stickers/../secrets.png']).toBe(true);
  });

  it('keeps the placeholder while offline and tries again later', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await requestStickerArt(ART);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useRemoteStickerArt.getState().missing[ART]).toBeUndefined();

    respond(200, png(600, 240));
    await requestStickerArt(ART);
    expect(useRemoteStickerArt.getState().files[ART]).toBeDefined();
  });

  it('never downloads bundled art, and tells the share card when it had to wait', async () => {
    expect(await settleStickerArt([BUNDLED])).toBe(false);
    respond(200, png(600, 240));
    expect(await settleStickerArt([BUNDLED, ART, ART])).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await settleStickerArt([ART])).toBe(false);
  });
});

describe('pngSize', () => {
  it('reads width and height from the header and refuses other bytes', () => {
    expect(pngSize(png(1200, 480))).toEqual({ width: 1200, height: 480 });
    expect(pngSize(new Uint8Array(10))).toBeNull();
    expect(pngSize(png(0, 10))).toBeNull();
  });
});
