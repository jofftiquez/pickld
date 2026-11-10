import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Avatar, initialsOf } from '../Avatar';
import { BottomSheet } from '../BottomSheet';
import { Card } from '../Card';
import { DangerButton } from '../DangerButton';
import { Dialog } from '../Dialog';
import { colors, motion, radius, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

// The real module needs native worklets; these components only read Reduce Motion from it.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

type SheetProps = {
  onClose: () => void;
  handleComponent: () => ReactNode;
  backdropComponent: (props: { style: object }) => ReactNode;
  animationConfigs?: { duration?: number };
  accessible?: boolean;
  children: ReactNode;
};
const mockSheetProps: { last?: SheetProps } = {};
const mockBackdropProps: { last?: Record<string, unknown> } = {};

// The library mock skips the handle and never fires onClose; this one renders both and closes for real.
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, SheetProps>(function Sheet(props, ref) {
    mockSheetProps.last = props;
    useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
    return (
      <>
        {props.backdropComponent({ style: {} })}
        {props.handleComponent()}
        {props.children}
      </>
    );
  });
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: (props: Record<string, unknown>) => {
      mockBackdropProps.last = props;
      return null;
    },
    useBottomSheetTimingConfigs: (config: { duration: number }) => config,
  };
});

describe('Card', () => {
  it('is the white 24-radius Settings card', async () => {
    await render(
      <Card testID="card">
        <Text>Account</Text>
      </Card>,
    );
    expect(flatStyle(screen.getByTestId('card'))).toMatchObject({
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: sizes.cardPadding,
    });
  });
});

describe('Avatar', () => {
  it('is labelled with the name and falls back to initials', async () => {
    await render(<Avatar name="Mika Reyes" size="lg" />);
    const avatar = screen.getByLabelText('Mika Reyes');
    expect(avatar.props.accessibilityRole).toBe('image');
    expect(flatStyle(avatar)).toMatchObject({ width: sizes.avatarLg, height: sizes.avatarLg });
    expect(screen.getByText('MR')).toBeTruthy();
  });

  it('is hidden from screen readers when decorative', async () => {
    await render(<Avatar name="Dale" decorative testID="a" />);
    expect(screen.queryByLabelText('Dale')).toBeNull();
    expect(screen.getByTestId('a', { includeHiddenElements: true }).props.accessible).toBe(false);
  });

  it('takes initials from the first two words', () => {
    expect(initialsOf('  dale  david cruz ')).toBe('DD');
    expect(initialsOf('Ñino')).toBe('Ñ');
  });
});

describe('BottomSheet', () => {
  beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  it('keeps rows reachable and closes from an accessible Close button', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible onClose={onClose} accessibilityLabel="Moment options">
        <Text>Edit caption</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Edit caption')).toBeTruthy();
    // gorhom would otherwise group the whole sheet into one element.
    expect(mockSheetProps.last?.accessible).toBe(false);
    expect(mockBackdropProps.last?.accessible).toBe(false);
    expect(mockBackdropProps.last?.pressBehavior).toBe('close');

    const close = screen.getByRole('button', { name: 'Close' });
    expectMinTapArea(close);
    await fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without calling onClose when the parent hides it', async () => {
    const onClose = jest.fn();
    const view = await render(
      <BottomSheet visible onClose={onClose} accessibilityLabel="Report">
        <Text>Spam or scam</Text>
      </BottomSheet>,
    );
    await act(async () =>
      view.rerender(
        <BottomSheet visible={false} onClose={onClose} accessibilityLabel="Report">
          <Text>Spam or scam</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.queryByText('Spam or scam')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses a short timing slide under Reduce Motion and the default spring otherwise', async () => {
    await render(
      <BottomSheet visible onClose={jest.fn()} accessibilityLabel="Report">
        <Text>x</Text>
      </BottomSheet>,
    );
    expect(mockSheetProps.last?.animationConfigs).toBeUndefined();

    jest.mocked(useReducedMotion).mockReturnValue(true);
    await render(
      <BottomSheet visible onClose={jest.fn()} accessibilityLabel="Report">
        <Text>x</Text>
      </BottomSheet>,
    );
    expect(mockSheetProps.last?.animationConfigs?.duration).toBe(motion.fast);
  });
});

describe('Dialog', () => {
  beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  function renderBlock(onClose = jest.fn(), onBlock = jest.fn()) {
    return render(
      <Dialog
        visible
        onClose={onClose}
        title="Block Mika Reyes?"
        message="She won’t be able to see your days."
        media={<Avatar name="Mika Reyes" size="lg" decorative />}
      >
        <DangerButton label="Block" onPress={onBlock} />
      </Dialog>,
    );
  }

  it('matches Block: header title, main action, then Cancel', async () => {
    const onClose = jest.fn();
    const onBlock = jest.fn();
    await renderBlock(onClose, onBlock);
    expect(screen.getByRole('header', { name: 'Block Mika Reyes?' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Block' }));
    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(Number(flatStyle(cancel).minHeight)).toBeGreaterThanOrEqual(sizes.minTap); // full width
    await fireEvent.press(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps screen readers: the card is modal and the scrim is not a target', async () => {
    await renderBlock();
    const card = screen.getByRole('header').parent;
    expect(card?.props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByTestId('dialog-scrim', { includeHiddenElements: true }).props.accessible).toBe(false);
  });

  it('skips the fade under Reduce Motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderBlock();
    expect(screen.getByTestId('dialog-modal', { includeHiddenElements: true }).props.animationType).toBe('none');
  });
});
