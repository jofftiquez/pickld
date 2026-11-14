import { fetchMomentRenders, momentRender } from '../momentRenders';

const mockIn = jest.fn();
const mockSelect = jest.fn((_cols: string) => ({ in: (...a: unknown[]) => mockIn(...a) }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockFrom(t) }) }));

const sticker = {
  id: 's1',
  type: 'sticker',
  stickerId: '4fec3a86-8a82-4601-fe12-fdbf36bead43',
  asset: 'stickers/everyday/kape-muna.png',
  label: 'Kape muna',
  x: 0.3,
  y: 0.3,
  scale: 0.4,
  rotation: 0,
};
const edited = { v: 1, filter: 'merienda', overlays: [sticker] };
const row = (id: string, edits: unknown, tz: string | null = 'Asia/Manila') => ({
  id,
  edits,
  captured_at: '2026-11-08T23:30:00Z',
  added_at: '2026-11-08T23:31:00Z',
  jars: tz === null ? null : { tz },
});

beforeEach(() => {
  mockIn.mockReset();
  mockFrom.mockClear();
  mockSelect.mockClear();
});

describe('fetchMomentRenders (D-96)', () => {
  it('reads edits, capture time and the jar zone for the shown ids from moments, once per id', async () => {
    mockIn.mockResolvedValueOnce({ data: [row('m1', edited), row('m2', {}, null)], error: null });
    const renders = await fetchMomentRenders(['m1', 'm2', 'm1']);
    expect(mockFrom).toHaveBeenCalledWith('moments');
    expect(mockSelect).toHaveBeenCalledWith('id, edits, captured_at, added_at, jars(tz)');
    expect(mockIn).toHaveBeenCalledWith('id', ['m1', 'm2']);
    expect(renders.get('m1')).toEqual({
      edits: edited,
      captured_at: '2026-11-08T23:30:00Z',
      added_at: '2026-11-08T23:31:00Z',
      tz: 'Asia/Manila',
    });
    expect(renders.get('m2')?.tz).toBeNull();
  });

  it('batches ids by 100 and leaves a failed batch plain instead of failing the page', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `m${i}`);
    mockIn
      .mockResolvedValueOnce({ data: [row('m0', edited)], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const renders = await fetchMomentRenders(ids);
    expect(mockIn).toHaveBeenCalledTimes(2);
    expect((mockIn.mock.calls[0]?.[1] as string[]).length).toBe(100);
    expect((mockIn.mock.calls[1]?.[1] as string[]).length).toBe(50);
    expect([...renders.keys()]).toEqual(['m0']);
  });

  it('a thrown read gives no rows', async () => {
    mockIn.mockRejectedValueOnce(new Error('offline'));
    expect((await fetchMomentRenders(['m1'])).size).toBe(0);
  });
});

describe('momentRender', () => {
  it('is null when the viewer could not read the moment or its edits leave the photo plain', () => {
    expect(momentRender(undefined)).toBeNull();
    expect(
      momentRender({ edits: {}, captured_at: null, added_at: '2026-11-08T23:31:00Z', tz: 'Asia/Manila' }),
    ).toBeNull();
  });

  it('gives the edits and a stamp time in the jar zone, falling back to added_at', () => {
    const render = momentRender({
      edits: edited,
      captured_at: null,
      added_at: '2026-11-08T23:31:00Z',
      tz: 'Asia/Manila',
    });
    expect(render?.edits.overlays.map((o) => o.id)).toEqual(['s1']);
    expect(render?.stamp).toEqual({ capturedAt: new Date('2026-11-08T23:31:00Z'), tz: 'Asia/Manila' });
  });

  it('draws the edits without a stamp time when the jar zone is unknown', () => {
    expect(
      momentRender({ edits: edited, captured_at: null, added_at: '2026-11-08T23:31:00Z', tz: null })?.stamp,
    ).toBeNull();
  });
});
