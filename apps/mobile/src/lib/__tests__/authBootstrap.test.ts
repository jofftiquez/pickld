import type { Session } from '@supabase/supabase-js';

import { startAuth } from '../authBootstrap';
import { useAuthStore } from '../authStore';

type Listener = (event: string, session: Session | null) => void;

function fakeClient(stored: Session | null) {
  let listener: Listener = () => {};
  const unsubscribe = jest.fn();
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: stored }, error: null })),
    onAuthStateChange: jest.fn((cb: Listener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    }),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };
  return { client: { auth } as never, auth, emit: (s: Session | null) => listener('SIGNED_IN', s), unsubscribe };
}

const session = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

beforeEach(() => useAuthStore.setState({ status: 'loading', session: null, error: null }));

describe('auth bootstrap', () => {
  it('restores a stored session on start', async () => {
    const { client } = fakeClient(session);
    const stop = startAuth(() => client);
    expect(useAuthStore.getState().status).toBe('loading');
    await Promise.resolve();
    await Promise.resolve();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', session });
    stop();
  });

  it('follows sign-in and sign-out events and unsubscribes on cleanup', async () => {
    const { client, emit, unsubscribe } = fakeClient(null);
    const stop = startAuth(() => client);
    await Promise.resolve();
    await Promise.resolve();
    expect(useAuthStore.getState().status).toBe('signedOut');
    emit(session);
    expect(useAuthStore.getState().status).toBe('signedIn');
    emit(null);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', session: null });
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('records a configuration error instead of crashing', () => {
    startAuth(() => {
      throw new Error('Invalid app environment');
    });
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', error: 'Invalid app environment' });
  });
});
