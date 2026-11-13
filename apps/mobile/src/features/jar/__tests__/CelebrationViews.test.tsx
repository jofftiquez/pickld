import { fireEvent, render, screen } from '@testing-library/react-native';

import { expectMinTapArea } from '@/components/__tests__/testUtils';

import { FullJarView } from '../FullJarView';
import { StickerUnlockedView } from '../StickerUnlockedView';

// Minimal Reanimated stand-in: animations land at once.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (fn: () => object) => fn(),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
    withDelay: (_ms: number, value: number) => value,
  };
});

const insets = { top: 47, bottom: 34, left: 0, right: 0 };

describe('FullJarView', () => {
  it('an unpublished jar offers Publish jar first, and Done still closes (M3-01)', async () => {
    const onDone = jest.fn();
    const onPublish = jest.fn();
    await render(
      <FullJarView localDate="2026-11-09" jarNumber={129} reduceMotion onDone={onDone} onPublish={onPublish} />,
    );
    const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(buttons).toEqual(['Publish jar', 'Done']);
    await fireEvent.press(screen.getByRole('button', { name: 'Publish jar' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('without onPublish (already published) there is only Done', async () => {
    await render(<FullJarView localDate="2026-11-09" jarNumber={129} reduceMotion onDone={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Publish jar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('shows the weekday, the jar number and confetti', async () => {
    const onDone = jest.fn();
    await render(<FullJarView localDate="2026-11-09" jarNumber={129} reduceMotion={false} onDone={onDone} />);
    expect(screen.getByRole('header', { name: 'Your Monday is complete' })).toBeTruthy();
    expect(screen.getByText('Eight moments, one real day. That’s jar number 129.')).toBeTruthy();
    expect(screen.getAllByTestId('confetti-piece', { includeHiddenElements: true })).toHaveLength(8);
    expect(screen.getByTestId('celebration-pop')).toBeTruthy();
    const done = screen.getByRole('button', { name: 'Done' });
    expectMinTapArea(done);
    await fireEvent.press(done);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with Reduce Motion fades in with no confetti', async () => {
    await render(<FullJarView localDate="2026-11-09" jarNumber={129} reduceMotion onDone={jest.fn()} />);
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryAllByTestId('confetti-piece', { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.getByTestId('celebration-fade')).toBeTruthy();
    expect(screen.queryByTestId('celebration-pop')).toBeNull();
  });

  it('leaves the number out when it is unknown', async () => {
    await render(<FullJarView localDate="2026-11-10" jarNumber={null} reduceMotion={false} onDone={jest.fn()} />);
    expect(screen.getByTestId('full-jar-body')).toHaveTextContent('Eight moments, one real day.');
    expect(screen.getByRole('header', { name: 'Your Tuesday is complete' })).toBeTruthy();
  });
});

describe('StickerUnlockedView', () => {
  it('shows the milestone sticker art, name and progress', async () => {
    const onClose = jest.fn();
    await render(
      <StickerUnlockedView
        milestone="first_full_jar"
        earned={1}
        reduceMotion={false}
        insets={insets}
        onClose={onClose}
      />,
    );
    const art = screen.getByTestId('sticker-unlocked-art');
    expect(art.props.accessibilityLabel).toBe('First full jar sticker');
    expect(screen.getByRole('header', { name: 'Your first full jar!' })).toBeTruthy();
    expect(
      screen.getByText('All 8 moments, one real day. You earned the “First full jar” sticker. Next up: 7 jars.'),
    ).toBeTruthy();
    expect(screen.getByText('1 of 10 earned')).toBeTruthy();
    expect(screen.getAllByTestId('confetti-piece', { includeHiddenElements: true })).toHaveLength(8);
    expectMinTapArea(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('uses each milestone’s own art', async () => {
    const view = await render(
      <StickerUnlockedView milestone="first_full_jar" earned={1} reduceMotion insets={insets} onClose={jest.fn()} />,
    );
    const firstSource: unknown = screen.getByTestId('sticker-unlocked-art').props.source;
    await view.rerender(
      <StickerUnlockedView milestone="one_year" earned={10} reduceMotion insets={insets} onClose={jest.fn()} />,
    );
    expect(screen.getByTestId('sticker-unlocked-art').props.source).not.toEqual(firstSource);
    expect(screen.getByText('10 of 10 earned')).toBeTruthy();
    expect(screen.getByText('A whole year of real days. You earned the “1 year of jars” sticker.')).toBeTruthy();
  });

  it('with Reduce Motion fades in with no confetti', async () => {
    await render(
      <StickerUnlockedView milestone="full_jars_7" earned={2} reduceMotion insets={insets} onClose={jest.fn()} />,
    );
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('celebration-fade')).toBeTruthy();
  });
});
