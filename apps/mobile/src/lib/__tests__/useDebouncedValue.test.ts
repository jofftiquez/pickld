import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('settles only after the value stops changing for the delay', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'm' },
    });
    await rerender({ v: 'mi' });
    await act(() => jest.advanceTimersByTime(200));
    await rerender({ v: 'mik' });
    await act(() => jest.advanceTimersByTime(200));
    // 400 ms since the first change, but only 200 since the last: still the first value.
    expect(result.current).toBe('m');
    await act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe('mik');
  });
});
