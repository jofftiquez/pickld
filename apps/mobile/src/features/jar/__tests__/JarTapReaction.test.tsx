import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';

import { JarCard } from '../JarCard';

// D-131: tapping the jar on Today plays a reaction with a light haptic, and never Publish or the visibility menu.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

const burst = (kind: 'sparkle' | 'heart') =>
  screen.queryAllByTestId(`jar-burst-${kind}`, { includeHiddenElements: true });

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(Haptics.impactAsync).mockClear();
});

describe('Jar tap reaction (D-131)', () => {
  it('a tap gives a light haptic and leaves Publish alone', async () => {
    const onPublish = jest.fn();
    await render(<JarCard count={4} readerCount={3} firstDay={false} onPublish={onPublish} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Jar' }));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onPublish).not.toHaveBeenCalled();
    expect(burst('sparkle')).toHaveLength(0);
    expect(burst('heart')).toHaveLength(0);
  });

  it('a full jar sparkles', async () => {
    await render(<JarCard count={8} readerCount={3} firstDay={false} onPublish={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('jar-tap'));
    expect(burst('sparkle')).toHaveLength(3);
  });

  it('a published jar floats a heart and does not open the visibility menu', async () => {
    const onOpenVisibility = jest.fn();
    await render(
      <JarCard
        count={6}
        readerCount={3}
        firstDay={false}
        onPublish={null}
        published={{ visibility: 'readers', likeCount: 2, time: '10:10 PM' }}
        onOpenVisibility={onOpenVisibility}
      />,
    );
    await fireEvent.press(screen.getByTestId('jar-tap'));
    expect(burst('heart')).toHaveLength(1);
    expect(onOpenVisibility).not.toHaveBeenCalled();
  });

  it('with Reduce Motion the jar only fades and the heart stays in place', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await render(
      <JarCard
        count={6}
        readerCount={3}
        firstDay={false}
        onPublish={null}
        published={{ visibility: 'readers', likeCount: 2, time: '10:10 PM' }}
      />,
    );
    await fireEvent.press(screen.getByTestId('jar-tap'));
    const [heart] = burst('heart');
    expect(heart).toHaveStyle({ transform: undefined });
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });
});
