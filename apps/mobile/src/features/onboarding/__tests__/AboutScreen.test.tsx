import { act, render } from '@testing-library/react-native';

import type { AboutViewProps } from '../AboutView';
import { AboutScreen } from '../AboutScreen';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import type { Session } from '@supabase/supabase-js';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// The view is tested on the simulator (Maestro); here its props drive the screen's decisions.
const mockView: { props: AboutViewProps | null } = { props: null };
jest.mock('../AboutView', () => ({
  AboutView: (props: AboutViewProps) => {
    mockView.props = props;
    return null;
  },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, canGoBack: () => false }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/profile/useUsernameAvailability', () => ({ useUsernameAvailability: () => 'available' }));
const mockUpload = jest.fn();
jest.mock('@/features/profile/uploadProfileImage', () => ({
  pickProfileImage: jest.fn(),
  uploadProfileImage: (...a: unknown[]) => mockUpload(...a),
}));
jest.mock('@/features/jar/useToday', () => ({ phoneTimeZone: () => 'Asia/Manila' }));
const mockSaveStep = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('../setupFlow', () => ({
  ...jest.requireActual('../setupFlow'),
  saveSetupStep: (...a: unknown[]) => mockSaveStep(...a),
}));
const mockSetQueryData = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: mockSetQueryData }) }));

const mockInvoke = jest.fn();
const mockInsert = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    auth: { signOut: () => mockSignOut() },
    from: () => ({ insert: (row: unknown) => mockInsert(row) }),
  }),
}));

const props = () => mockView.props!;
const fill = async (year: number, month: number, day: number) => {
  await act(async () => props().onChange({ displayName: 'Dale', username: 'dale' }));
  await act(async () => props().onChange({ birthday: { year, month, day } }));
};

describe('About you', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-12T04:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    jest.clearAllMocks();
    useAuthStore.getState().setSession({ user: { id: 'u-1', user_metadata: {} } } as unknown as Session);
  });
  afterEach(() => jest.useRealTimers());

  it('under 13: purges the account before writing anything, then shows Under 13 and signs out', async () => {
    mockInvoke.mockResolvedValue({ data: { data: { purged: true } }, error: null });
    await render(<AboutScreen />);
    await fill(2013, 11, 13); // turns 13 tomorrow (12 Nov in Manila)
    expect(props().canContinue).toBe(true);
    await act(async () => props().onContinue());
    expect(mockInvoke).toHaveBeenCalledWith('account-purge', { method: 'POST' });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/setup/under13');
    expect(mockSignOut).toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('a failed purge stays here with an error, without showing Under 13', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
    await render(<AboutScreen />);
    await fill(2015, 1, 1);
    await act(async () => props().onContinue());
    expect(props().error).toBe('failed');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('13 today: saves the profile with the birthday and phone zone, then goes on to Your day', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await render(<AboutScreen />);
    await fill(2013, 11, 12);
    await act(async () => props().onContinue());
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith({
      id: 'u-1',
      username: 'dale',
      display_name: 'Dale',
      birthday: '2013-11-12',
      home_tz: 'Asia/Manila',
    });
    expect(mockSetQueryData).toHaveBeenCalledWith(['hasProfile', 'u-1'], true);
    // Setup continues at Your day, and a relaunch would resume there.
    expect(mockSaveStep).toHaveBeenCalledWith('u-1', '/setup/day');
    expect(mockReplace).toHaveBeenCalledWith('/setup/day');
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'about' }]]);
  });

  it('a username taken meanwhile is reported and nothing moves on', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await render(<AboutScreen />);
    await fill(1990, 3, 14);
    await act(async () => props().onContinue());
    expect(props().error).toBe('taken');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
