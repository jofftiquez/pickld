import { renderHook } from '@testing-library/react-native';

import { prefetchPhotos } from '../photoCache';
import { upcomingPhotos, usePhotoPrefetch } from '../usePhotoPrefetch';

jest.mock('../photoCache', () => ({
  ...jest.requireActual('../photoCache'),
  prefetchPhotos: jest.fn(async () => undefined),
}));
const prefetch = jest.mocked(prefetchPhotos);

const link = (n: number) => `https://photos.pickld.me/moments/u1/upload-${n}/medium.jpg?exp=1&sig=s${n}`;
type Row = { photo: string | null };
const rows: Row[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ photo: n === 3 ? null : link(n) }));
const photoOf = (r: Row) => r.photo;
const seen = (...indexes: number[]) => ({
  viewableItems: indexes.map((index) => ({ index, item: rows[index], key: String(index), isViewable: true })),
  changed: [],
});

beforeEach(() => prefetch.mockClear());

describe('upcomingPhotos (NFR-PERF-02)', () => {
  it('takes the photos of the rows after the last one on screen, skipping rows without one', () => {
    expect(upcomingPhotos(rows, 0, photoOf, 4)).toEqual([link(1), link(2), link(4)]);
  });

  it('stops at the end of the loaded list', () => {
    expect(upcomingPhotos(rows, 6, photoOf, 4)).toEqual([link(7)]);
    expect(upcomingPhotos(rows, 7, photoOf, 4)).toEqual([]);
  });
});

describe('usePhotoPrefetch (NFR-PERF-02)', () => {
  it('prefetches ahead of the furthest visible row, and each photo only once', async () => {
    const { result } = await renderHook(() => usePhotoPrefetch(rows, photoOf));
    result.current(seen(1, 0)); // visible rows arrive in any order
    expect(prefetch).toHaveBeenLastCalledWith([link(2), link(4), link(5)]);

    result.current(seen(2));
    expect(prefetch).toHaveBeenLastCalledWith([link(6)]); // 4 and 5 are already loading
    result.current(seen(2));
    expect(prefetch).toHaveBeenCalledTimes(2);
  });

  it('a re-signed link for a photo already fetched is not fetched again', async () => {
    const { result, rerender } = await renderHook(({ list }: { list: Row[] }) => usePhotoPrefetch(list, photoOf), {
      initialProps: { list: rows },
    });
    result.current(seen(0));
    const resigned = rows.map((r) => ({ photo: r.photo?.replace(/sig=\w+/, 'sig=new') ?? null }));
    await rerender({ list: resigned });
    result.current(seen(0));
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('uses the latest list after more pages load', async () => {
    const { result, rerender } = await renderHook(({ list }: { list: Row[] }) => usePhotoPrefetch(list, photoOf), {
      initialProps: { list: rows.slice(0, 2) },
    });
    result.current(seen(1));
    expect(prefetch).not.toHaveBeenCalled();
    await rerender({ list: rows });
    result.current(seen(1));
    expect(prefetch).toHaveBeenLastCalledWith([link(2), link(4), link(5)]);
  });
});
