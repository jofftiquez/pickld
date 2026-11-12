import type { Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';

import { DayScreen } from '../DayScreen';
import type { DayViewProps } from '../DayView';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// The view is checked on the simulator; here its props drive what the screen saves.
const mockView: { props: DayViewProps | null } = { props: null };
jest.mock('../DayView', () => ({
  DayView: (props: DayViewProps) => {
    mockView.props = props;
    return null;
  },
}));
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
const mockSaveStep = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('../setupFlow', () => ({
  ...jest.requireActual('../setupFlow'),
  saveSetupStep: (...a: unknown[]) => mockSaveStep(...a),
}));
const mockUpsert = jest.fn(async (..._a: unknown[]) => ({ error: null as unknown }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: (table: string) => ({ upsert: (rows: unknown) => mockUpsert(table, rows) }) }),
}));

const props = () => mockView.props!;

describe('Your day', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);
  });

  it('a preset, then one time changed by hand, is what gets saved', async () => {
    await render(<DayScreen />);
    expect(props().dayType).toBe('coffee_first');
    await act(async () => props().onPick('night_owl'));
    await act(async () => props().onChangeTime('evening', 22 * 60 + 15));
    await act(async () => props().onContinue());
    expect(mockUpsert.mock.calls).toEqual([
      ['onboarding_answers', { user_id: 'u-1', day_type: 'night_owl' }],
      [
        'reminder_settings',
        [
          { user_id: 'u-1', slot: 'morning', local_time: '10:00', enabled: true },
          { user_id: 'u-1', slot: 'afternoon', local_time: '15:00', enabled: true },
          { user_id: 'u-1', slot: 'evening', local_time: '22:15', enabled: true },
        ],
      ],
    ]);
    // Setup continues at Your people, and a relaunch would resume there.
    expect(mockSaveStep).toHaveBeenCalledWith('u-1', '/setup/people');
    expect(mockPush).toHaveBeenCalledWith('/setup/people');
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'day' }]]);
  });

  it('a failed save stays here, keeping the step for a relaunch', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'offline' } });
    await render(<DayScreen />);
    await act(async () => props().onContinue());
    expect(props().failed).toBe(true);
    expect(mockSaveStep).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
