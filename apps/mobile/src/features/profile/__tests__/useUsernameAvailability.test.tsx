import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { USERNAME_DEBOUNCE_MS, useUsernameAvailability } from '../useUsernameAvailability';

const mockRpc = jest.fn<Promise<{ data: string; error: null }>, [string, { candidate: string }]>();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useUsernameAvailability', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRpc.mockReset();
    mockRpc.mockImplementation(async (_fn, { candidate }) => ({
      data: candidate === 'mika' ? 'taken' : 'available',
      error: null,
    }));
  });
  afterEach(() => jest.useRealTimers());

  it('asks once typing pauses and answers well within 500 ms of the last key', async () => {
    const { result, rerender } = await renderHook(
      ({ name }: { name: string }) => useUsernameAvailability(name, 'dale'),
      { initialProps: { name: 'mi' }, wrapper },
    );
    await rerender({ name: 'mik' });
    await act(() => jest.advanceTimersByTime(100));
    await rerender({ name: 'mika' }); // last key
    expect(result.current).toBe('checking');
    await act(() => jest.advanceTimersByTime(USERNAME_DEBOUNCE_MS - 1));
    expect(mockRpc).not.toHaveBeenCalled();
    // The debounce ends and the (instant) reply is delivered: 300 ms after the last key, under 500.
    await act(() => jest.advanceTimersByTimeAsync(1));
    for (let i = 0; i < 3; i += 1) await act(() => jest.advanceTimersByTimeAsync(0));
    expect(USERNAME_DEBOUNCE_MS).toBeLessThan(500);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('username_available', { candidate: 'mika' });
    expect(result.current).toBe('taken');
  });

  it('needs no request for the current name or a malformed one', async () => {
    const { result, rerender } = await renderHook(
      ({ name }: { name: string }) => useUsernameAvailability(name, 'dale'),
      { initialProps: { name: 'Dale' }, wrapper },
    );
    expect(result.current).toBe('unchanged');
    await rerender({ name: 'd!' });
    expect(result.current).toBe('invalid');
    await act(() => jest.advanceTimersByTime(1000));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
