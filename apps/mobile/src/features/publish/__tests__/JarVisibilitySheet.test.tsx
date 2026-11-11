import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { JarVisibilitySheet, type JarVisibilitySheetProps } from '../JarVisibilitySheet';

// The jar's visibility menu on Today (M3-02, FR-PUB-03) inside the real kit sheet; Today applies the change.

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, { onClose: () => void; children: ReactNode }>(
    function Sheet(props, ref) {
      useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
      return <>{props.children}</>;
    },
  );
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});

async function renderSheet(props: Partial<JarVisibilitySheetProps> = {}) {
  const onChange = jest.fn();
  const onClose = jest.fn();
  await render(
    <JarVisibilitySheet
      visible
      visibility="readers"
      readerCount={312}
      busy={false}
      error={null}
      onChange={onChange}
      onClose={onClose}
      {...props}
    />,
  );
  return { onChange, onClose };
}

describe('JarVisibilitySheet', () => {
  it('lists the three choices with the current one checked; a different one is applied, the current one isn’t', async () => {
    const { onChange } = await renderSheet({ visibility: 'everyone' });
    expect(screen.getByText('Who can see this jar')).toBeTruthy();
    const checked = (name: RegExp) => screen.getByRole('radio', { name }).props.accessibilityState.checked;
    expect(checked(/^Readers, 312 people/)).toBe(false);
    expect(checked(/^Everyone/)).toBe(true);
    expect(checked(/^Only me/)).toBe(false);

    await fireEvent.press(screen.getByRole('radio', { name: /^Everyone/ }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: /^Only me/ }));
    expect(onChange).toHaveBeenCalledWith('only_me');
  });

  it('while a change is saving, taps are ignored', async () => {
    const { onChange } = await renderSheet({ busy: true });
    await fireEvent.press(screen.getByRole('radio', { name: /^Everyone/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows why a change failed', async () => {
    await renderSheet({ error: 'failed' });
    expect(screen.getByText('Couldn’t change it. Check your connection and try again.')).toBeTruthy();
  });
});
