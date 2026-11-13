import type { Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';

import { JarLidScreen } from '../JarLidScreen';
import type { JarLidViewProps } from '../JarLidView';
import { PeopleScreen } from '../PeopleScreen';
import type { PeopleViewProps } from '../PeopleView';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// The views are checked on the simulator; here their props drive what the screens save.
const mockViews: { people: PeopleViewProps | null; lid: JarLidViewProps | null } = { people: null, lid: null };
jest.mock('../PeopleView', () => ({
  PeopleView: (p: PeopleViewProps) => {
    mockViews.people = p;
    return null;
  },
}));
jest.mock('../JarLidView', () => ({
  JarLidView: (p: JarLidViewProps) => {
    mockViews.lid = p;
    return null;
  },
}));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    canDismiss: () => false,
    dismissAll: jest.fn(),
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => false,
    back: jest.fn(),
  }),
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
const mockWrites: unknown[][] = [];
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      upsert: async (row: unknown) => {
        mockWrites.push([table, 'upsert', row]);
        return { error: null };
      },
      update: (row: unknown) => ({
        eq: async (col: string, val: string) => {
          mockWrites.push([table, 'update', row, col, val]);
          return { error: null };
        },
      }),
    }),
  }),
}));

describe('Your people and Pick your jar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrites.length = 0;
    useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);
  });

  it('Your people saves the chosen answers privately, then goes to Pick your jar', async () => {
    await render(<PeopleScreen />);
    const p = () => mockViews.people!;
    await act(async () => p().onToggle('whoamiwith', 'pets'));
    await act(async () => p().onToggle('mebusywith', 'school'));
    await act(async () => p().onToggle('ootd', 'uniform'));
    await act(async () => p().onContinue());
    expect(mockWrites).toEqual([
      [
        'onboarding_answers',
        'upsert',
        { user_id: 'u-1', whoamiwith: ['pets'], mebusywith: ['school'], ootd: 'uniform' },
      ],
    ]);
    expect(mockSaveStep).toHaveBeenCalledWith('u-1', '/setup/jar-lid');
    expect(mockPush).toHaveBeenCalledWith('/setup/jar-lid');
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'people' }]]);
  });

  it('Skip writes nothing and still moves on', async () => {
    await render(<PeopleScreen />);
    await act(async () => mockViews.people!.onToggle('whoamiwith', 'pets'));
    await act(async () => mockViews.people!.onSkip());
    expect(mockWrites).toEqual([]);
    expect(mockPush).toHaveBeenCalledWith('/setup/jar-lid');
  });

  it('Pick your jar starts on Pickle and saves the picked lid to the profile', async () => {
    await render(<JarLidScreen />);
    expect(mockViews.lid!.lid).toBe('pickle');
    await act(async () => mockViews.lid!.onPick('mango'));
    await act(async () => mockViews.lid!.onContinue());
    expect(mockWrites).toEqual([['profiles', 'update', { lid_color: '#f2b632' }, 'id', 'u-1']]);
    expect(jest.mocked(track).mock.calls).toEqual([['signup_step_completed', { step: 'jar_lid' }]]);
  });
});
