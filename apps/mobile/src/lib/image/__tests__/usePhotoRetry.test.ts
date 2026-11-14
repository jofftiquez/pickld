import { act, renderHook } from '@testing-library/react-native';

import { PHOTO_RETRY_DELAYS_MS, usePhotoRetry } from '../usePhotoRetry';

// A photo that fails to load is tried again a few times, later each time; expo-image never does it itself.

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function fail(result: { current: { onError: () => void } }) {
  await act(async () => result.current.onError());
}

async function wait(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

it('tries again after each delay in turn, then gives up', async () => {
  const { result } = await renderHook(() => usePhotoRetry('u1/m1/thumb.webp'));
  expect(result.current.attempt).toBe(0);

  for (const [i, delay] of PHOTO_RETRY_DELAYS_MS.entries()) {
    await fail(result);
    await wait(delay - 1);
    expect(result.current.attempt).toBe(i);
    await wait(1);
    expect(result.current.attempt).toBe(i + 1);
  }

  await fail(result);
  await wait(60_000);
  expect(result.current.attempt).toBe(PHOTO_RETRY_DELAYS_MS.length);
});

it('two failures of the same try wait for one retry, not two', async () => {
  const { result } = await renderHook(() => usePhotoRetry('u1/m1/thumb.webp'));
  await fail(result);
  await fail(result);
  await wait(PHOTO_RETRY_DELAYS_MS[0]);
  expect(result.current.attempt).toBe(1);
  await wait(60_000);
  expect(result.current.attempt).toBe(1);
});

it('a new photo starts counting from zero and drops the old photo’s pending retry', async () => {
  const { result, rerender } = await renderHook(({ id }: { id: string }) => usePhotoRetry(id), {
    initialProps: { id: 'u1/m1/thumb.webp' },
  });
  await fail(result);
  await wait(PHOTO_RETRY_DELAYS_MS[0]);
  await fail(result);
  expect(result.current.attempt).toBe(1);

  await rerender({ id: 'u1/m2/thumb.webp' });
  expect(result.current.attempt).toBe(0);
  await wait(60_000);
  expect(result.current.attempt).toBe(0);
});
