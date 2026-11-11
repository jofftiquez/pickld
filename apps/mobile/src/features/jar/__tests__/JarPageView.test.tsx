import { fireEvent, render, screen } from '@testing-library/react-native';

import type { JarMoment, JarPageData } from '../jarPage';
import { JarPageView, type JarPageViewProps } from '../JarPageView';

// Reanimated needs native worklets; JarGraphic only uses it to animate a new layer.
jest.mock('react-native-reanimated', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
  };
});

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

function moment(over: Partial<JarMoment> & Pick<JarMoment, 'id' | 'slot'>): JarMoment {
  return {
    status: 'live',
    is_private: false,
    is_backfilled: false,
    caption: null,
    captured_at: null,
    added_at: '2026-11-07T22:48:00Z', // 6:48 AM in Manila on Nov 8
    edits: {},
    thumbUrl: `https://photos.test/${over.id}.webp`,
    fullUrl: null,
    ...over,
  };
}

const daleJar: JarPageData = {
  jar: {
    id: 'jar-1',
    user_id: 'dale-id',
    local_date: '2026-11-08',
    tz: 'Asia/Manila',
    moment_count: 8,
    visible_count: 8,
    like_count: 48,
    comment_count: 6,
  },
  author: { username: 'dale', display_name: 'Dale Santos' },
  moments: [
    moment({ id: 'm-morning', slot: 'morning', caption: 'Rain again. Coffee first.' }),
    moment({ id: 'm-where', slot: 'whereami', is_backfilled: true }),
    moment({ id: 'm-busy', slot: 'mebusywith' }),
    moment({ id: 'm-private', slot: 'ootd', is_private: true }),
  ],
  viewerId: 'reader-id',
};

async function setup(props: Partial<JarPageViewProps> = {}) {
  const handlers = { onBack: jest.fn(), onShare: jest.fn(), onRetry: jest.fn() };
  await render(<JarPageView data={daleJar} insets={insets} locale="en-US" {...handlers} {...props} />);
  return handlers;
}

describe('JarPageView', () => {
  it('shows the cover title, date, count, Full jar tag and the cover caption with its slot and time', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Dale’s Sunday' })).toBeTruthy();
    expect(screen.getByTestId('jar-subtitle')).toHaveTextContent('Nov 8, 2026 · 8 of 8 moments');
    expect(screen.getByTestId('jar-full-tag')).toHaveTextContent('Full jar');
    expect(screen.getByTestId('jar-highlight')).toHaveTextContent('“Rain again. Coffee first.” — #morning, 6:48 AM');
    expect(screen.getByLabelText('8 of 8 moments')).toBeTruthy();
  });

  it('lists the other visible moments with Added later badges, and never a private one for a reader', async () => {
    await setup();
    expect(screen.getByLabelText('#whereami, added later')).toBeTruthy();
    expect(screen.getByTestId('jar-tile-whereami-added-later')).toHaveTextContent('Added later');
    expect(screen.getByLabelText('#mebusywith')).toBeTruthy();
    expect(screen.queryByTestId('jar-tile-mebusywith-added-later')).toBeNull();
    expect(screen.queryByTestId('jar-tile-ootd')).toBeNull();
    // The cover isn't repeated in the grid.
    expect(screen.queryByTestId('jar-tile-morning')).toBeNull();
  });

  it('keeps Added later visible when the backfilled moment is the cover', async () => {
    const moments = daleJar.moments.map((m) => (m.slot === 'morning' ? { ...m, is_backfilled: true } : m));
    await setup({ data: { ...daleJar, moments } });
    expect(screen.getByTestId('jar-highlight')).toHaveTextContent(
      '“Rain again. Coffee first.” — #morning, 6:48 AM · Added later',
    );
    expect(screen.getByLabelText('Cover photo, #morning, added later')).toBeTruthy();
  });

  it('shows the owner their private moment with a lock', async () => {
    await setup({ data: { ...daleJar, viewerId: 'dale-id' } });
    expect(screen.getByLabelText('#ootd, private')).toBeTruthy();
    expect(screen.getByTestId('jar-tile-ootd-lock')).toBeTruthy();
  });

  it('leaves out the Full jar tag below 8 and shows the reader count', async () => {
    await setup({ data: { ...daleJar, jar: { ...daleJar.jar, visible_count: 5 } } });
    expect(screen.queryByTestId('jar-full-tag')).toBeNull();
    expect(screen.getByTestId('jar-subtitle')).toHaveTextContent('Nov 8, 2026 · 5 of 8 moments');
  });

  it('shows likes and comments and shares the jar', async () => {
    const { onShare, onBack } = await setup();
    expect(screen.getByLabelText('48 likes')).toBeTruthy();
    expect(screen.getByLabelText('6 comments')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Share jar' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('says the jar isn’t available when the viewer may not see it', async () => {
    await setup({ data: null });
    expect(screen.getByRole('header', { name: 'This jar isn’t available' })).toBeTruthy();
    expect(screen.queryByTestId('jar-bar')).toBeNull();
  });

  it('offers a retry when loading failed', async () => {
    const { onRetry } = await setup({ data: undefined, failed: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
