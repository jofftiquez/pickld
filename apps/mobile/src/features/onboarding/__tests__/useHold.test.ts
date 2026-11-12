import { act, renderHook } from '@testing-library/react-native';

import { HOLD_MS, useHold } from '../useHold';

describe('Hold to promise (FR-ONB-07)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('accepts only after a full 1.5 s hold, and only once', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => useHold(onDone));
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(HOLD_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => result.current.release());
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(HOLD_MS * 2));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('letting go early cancels; the next hold starts from zero', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => useHold(onDone));
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(1400));
    await act(async () => result.current.release());
    expect(result.current.holding).toBe(false);
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(1400));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(100));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a screen reader activation accepts without holding', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => useHold(onDone));
    await act(async () => result.current.confirm());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('after a failed save the next full hold tries again', async () => {
    const onDone = jest
      .fn(async () => false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { result } = await renderHook(() => useHold(onDone));
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(HOLD_MS));
    expect(result.current.holding).toBe(false);
    await act(async () => result.current.press());
    await act(async () => jest.advanceTimersByTime(HOLD_MS));
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
