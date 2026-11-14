import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';

import { BURST_PIECES } from '../confettiPhysics';
import { LikeButton } from '../LikeButton';
import { buildTodayGrid, type ServerMoment } from '../todayGrid';
import { TodayView } from '../TodayView';

// D-58: the tiles' pop, the publish burst and the like's heart, with and without Reduce Motion. Animations
// land at once in the stand-in; which treatment plays shows in the views (pop or fade).
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('@/features/edit/__tests__/reanimatedStandIn'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

const live = (slot: ServerMoment['slot']): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-09T23:30:00Z',
  added_at: '2026-11-09T23:31:00Z',
  thumbUrl: null,
});

async function renderToday(props: { poppingSlots?: ReadonlySet<'whereami' | 'ootd'>; celebratePublish?: boolean }) {
  await render(
    <TodayView
      now={new Date('2026-11-10T08:15:00+08:00')}
      tz="Asia/Manila"
      tiles={buildTodayGrid({
        localDate: '2026-11-10',
        moments: [live('whereami'), live('ootd')],
        queue: [],
        nowSlot: 'morning',
      })}
      hasAnyJar
      displayName="Dale Cruz"
      avatarUrl={null}
      readerCount={3}
      insets={{ top: 47, bottom: 34 }}
      onCapture={jest.fn()}
      onPublish={jest.fn()}
      {...props}
    />,
  );
}

const confetti = () => screen.queryAllByTestId('confetti-piece', { includeHiddenElements: true });

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(Haptics.impactAsync).mockClear();
});

describe('Today animations (D-58)', () => {
  it('a plain visit pops nothing and has no confetti', async () => {
    await renderToday({});
    expect(screen.getByTestId('tile-whereami-still')).toBeTruthy();
    expect(screen.getByTestId('tile-ootd-still')).toBeTruthy();
    expect(screen.queryByTestId('publish-burst')).toBeNull();
    expect(confetti()).toHaveLength(0);
  });

  it('pops only the newly filled tile, which stays a working button', async () => {
    await renderToday({ poppingSlots: new Set(['ootd']) });
    expect(screen.getByTestId('tile-ootd-pop')).toBeTruthy();
    expect(screen.getByTestId('tile-whereami-still')).toBeTruthy();
    expect(screen.getByTestId('tile-ootd').props.accessibilityLabel).toMatch(/^#ootd/);
  });

  it('a publish brings confetti, which screen readers skip', async () => {
    await renderToday({ celebratePublish: true });
    expect(screen.getByTestId('publish-burst')).toBeTruthy();
    expect(confetti()).toHaveLength(BURST_PIECES);
    expect(screen.queryAllByTestId('confetti-piece')).toHaveLength(0);
  });

  it('with Reduce Motion the tile fades in instead and the publish has no confetti', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderToday({ poppingSlots: new Set(['ootd']), celebratePublish: true });
    expect(screen.getByTestId('tile-ootd-fade')).toBeTruthy();
    expect(screen.queryByTestId('tile-ootd-pop')).toBeNull();
    expect(screen.queryByTestId('publish-burst')).toBeNull();
    expect(confetti()).toHaveLength(0);
  });
});

describe('LikeButton animation (D-58)', () => {
  it('liking plays a light haptic; unliking does not', async () => {
    const onPress = jest.fn();
    const view = await render(<LikeButton count={2} liked={false} height={44} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    await view.rerender(<LikeButton count={3} liked height={44} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('the heart pops once liked, or fades in with Reduce Motion', async () => {
    const view = await render(<LikeButton count={2} liked={false} height={44} onPress={jest.fn()} />);
    expect(screen.getByTestId('like-heart')).toBeTruthy();
    await view.rerender(<LikeButton count={3} liked height={44} onPress={jest.fn()} />);
    expect(screen.getByTestId('like-heart-pop')).toBeTruthy();

    jest.mocked(useReducedMotion).mockReturnValue(true);
    await view.rerender(<LikeButton count={3} liked height={44} onPress={jest.fn()} />);
    expect(screen.getByTestId('like-heart-fade')).toBeTruthy();
  });
});
