import { act, renderHook } from '@testing-library/react-native';

import { isNetworkError, reportNetworkResult, trackNetwork, useIsOffline } from '../connectivity';

beforeEach(() => reportNetworkResult(null));

describe('isNetworkError', () => {
  it.each([
    new TypeError('Network request failed'), // React Native fetch
    'TypeError: Network request failed', // supabase-js PostgREST error message
    'Failed to send a request to the Edge Function', // supabase-js FunctionsFetchError
    Object.assign(new Error('whatever'), { name: 'FunctionsFetchError' }),
    'The Internet connection appears to be offline.', // iOS upload task
    'Unable to resolve host "r2.example": No address associated with hostname', // Android
    'The request timed out.',
  ])('%p is a network error', (error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  it.each([
    'photo upload answered 403',
    'slot already has a moment',
    new Error('duplicate key value violates unique constraint'),
    { message: 'JWT expired', code: 'PGRST301' },
    null,
    undefined,
    42,
  ])('%p is not', (error) => {
    expect(isNetworkError(error)).toBe(false);
  });
});

describe('useIsOffline', () => {
  it('starts online, goes offline on a network error, and back online on any server answer', async () => {
    const { result } = await renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
    await act(() => reportNetworkResult('Network request failed'));
    expect(result.current).toBe(true);
    // The server answered, even with an error: it is reachable.
    await act(() => reportNetworkResult(new Error('photo upload answered 500')));
    expect(result.current).toBe(false);
    await act(() => reportNetworkResult(new TypeError('Network request failed')));
    await act(() => reportNetworkResult(null));
    expect(result.current).toBe(false);
  });

  it('trackNetwork reports the outcome and passes results and errors through', async () => {
    const { result } = await renderHook(() => useIsOffline());
    const offline = new TypeError('Network request failed');
    await act(() => expect(trackNetwork(Promise.reject(offline))).rejects.toBe(offline));
    expect(result.current).toBe(true);
    await act(() => expect(trackNetwork(Promise.resolve('jar'))).resolves.toBe('jar'));
    expect(result.current).toBe(false);
  });
});
