import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { JarMoment } from '@/features/jar/jarPage';
import { slots } from '@/theme/tokens';

import { safeArea } from '../storyLayout';

import { ShareCardScreen } from '../ShareCardScreen';

// Share jar, picture first (D-62; QA item 21): the layout row follows the number of moments on the card,
// picking one moves the photos, and Format and Include captions live in the Options sheet. The real screen,
// view and card; the jar, the phone's share actions and the photo renderer are fakes.

const mockJar: { moments: JarMoment[] } = { moments: [] };
const moment = (i: number, over: Partial<JarMoment> = {}): JarMoment => ({
  id: `m${i}`,
  slot: slots[i]!,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  caption: null,
  captured_at: null,
  added_at: `2026-11-08T0${i}:00:00Z`,
  edits: null,
  like_count: 0,
  thumbUrl: `https://cdn/t${i}.jpg`,
  fullUrl: `https://cdn/f${i}.jpg`,
  ...over,
});
const setMoments = (count: number, extra: JarMoment[] = []) => {
  mockJar.moments = [...Array.from({ length: count }, (_, i) => moment(i)), ...extra];
};

jest.mock('@/features/jar/useJarPage', () => ({
  useJarPage: () => ({
    data: {
      viewerId: 'dale-id',
      jar: { id: 'jar-10', user_id: 'dale-id', local_date: '2026-11-08', tz: 'Asia/Manila' },
      author: { display_name: 'Dale Cruz', username: 'dale', lid_color: null },
      moments: mockJar.moments,
    },
  }),
}));
jest.mock('@/features/jar/shareJar', () => ({ jarTitle: () => 'Dale’s Sunday' }));
jest.mock('@/features/moment/MomentCover', () => ({ MomentCover: () => null }));
jest.mock('../shareActions', () => ({
  renderCardImage: jest.fn(async () => 'file:///cache/card.png'),
  saveImage: jest.fn(async () => 'saved'),
  shareImage: jest.fn(async () => undefined),
  copyLink: jest.fn(async () => undefined),
  messageLink: jest.fn(async () => undefined),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
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

const layoutNames = () => screen.getAllByRole('radio', { name: /^Layout: / }).map((r) => r.props.accessibilityLabel);
const checked = (name: string) => screen.getByRole('radio', { name }).props.accessibilityState.checked;
const cellBox = (slot: string) => {
  const { left, top, width, height } = StyleSheet.flatten(screen.getByTestId(`share-card-${slot}`).props.style);
  return { left, top, width, height };
};

const boxOf = (testID: string) => {
  const { left, top, bottom, width, height } = StyleSheet.flatten(screen.getByTestId(testID).props.style);
  return { left, top, bottom, width, height };
};
// The card is drawn at its export size times `unit` (1 / pixel ratio).
const unitOf = () => StyleSheet.flatten(screen.getByTestId('share-card').props.style).width / 1080;

describe('Share jar layouts (D-62)', () => {
  it('offers the layouts for the number of moments on the card, the default picked', async () => {
    setMoments(1);
    const view = await render(<ShareCardScreen jarId="jar-10" />);
    expect(layoutNames()).toEqual(['Layout: Full']);
    expect(checked('Layout: Full')).toBe(true);

    setMoments(2);
    await view.rerender(<ShareCardScreen jarId="jar-10" />);
    expect(layoutNames()).toEqual(['Layout: Side by side', 'Layout: Stacked']);

    setMoments(3);
    await view.rerender(<ShareCardScreen jarId="jar-10" />);
    expect(layoutNames()).toEqual(['Layout: One large and two small', 'Layout: Two and one']);

    setMoments(8);
    await view.rerender(<ShareCardScreen jarId="jar-10" />);
    expect(layoutNames()).toEqual(['Layout: 3 by 3 grid', 'Layout: One large and a grid below']);
    expect(checked('Layout: 3 by 3 grid')).toBe(true);
  });

  it('counts only the moments on the card: a private one changes nothing', async () => {
    setMoments(2, [moment(5, { visibility: 'only_me' })]);
    await render(<ShareCardScreen jarId="jar-10" />);
    expect(layoutNames()).toEqual(['Layout: Side by side', 'Layout: Stacked']);
    expect(screen.queryByTestId(`share-card-${slots[5]}`)).toBeNull();
  });

  it('moves the photos when another layout is picked, and starts over on the default when the count changes', async () => {
    setMoments(4);
    const view = await render(<ShareCardScreen jarId="jar-10" />);
    const before = cellBox(slots[0]!);
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Layout: One large and three small' })));
    expect(checked('Layout: One large and three small')).toBe(true);
    expect(checked('Layout: 2 by 2 grid')).toBe(false);
    const after = cellBox(slots[0]!);
    expect(after.width).toBeGreaterThan(before.width);

    setMoments(5);
    await view.rerender(<ShareCardScreen jarId="jar-10" />);
    expect(checked('Layout: One large and a strip below')).toBe(true);
  });

  it('shares one moment in the single full layout', async () => {
    setMoments(6);
    await render(<ShareCardScreen jarId="jar-10" momentId="m2" />);
    expect(layoutNames()).toEqual(['Layout: Full']);
    expect(screen.getByTestId(`share-card-${slots[2]}`)).toBeTruthy();
    expect(screen.queryByTestId(`share-card-${slots[0]}`)).toBeNull();
  });

  it('keeps Format and Include captions in the Options sheet, and the four actions in the panel', async () => {
    setMoments(3, []);
    mockJar.moments[0] = moment(0, { caption: 'Early night.' });
    await render(<ShareCardScreen jarId="jar-10" />);
    expect(screen.queryByTestId('share-format')).toBeNull();
    expect(screen.queryByTestId('share-captions')).toBeNull();
    for (const name of ['Save image', 'Copy link', 'Message', 'Share to…']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Options' })));
    expect(screen.getByTestId('share-format')).toBeTruthy();
    expect(screen.getByText('Include captions')).toBeTruthy();
    expect(screen.getByTestId('share-caption')).toBeTruthy();

    await act(async () => fireEvent(screen.getByTestId('share-captions'), 'valueChange', false));
    expect(screen.queryByTestId('share-caption')).toBeNull();

    const story = cellBox(slots[0]!);
    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Post 4:5' })));
    expect(StyleSheet.flatten(screen.getByTestId('share-card').props.style).height).toBeLessThan(
      StyleSheet.flatten(screen.getByTestId('share-card').props.style).width * 1.5,
    );
    expect(cellBox(slots[0]!)).not.toEqual(story);
  });
});

describe('Story card keeps clear of Instagram’s bars (D-90)', () => {
  it('draws one moment whole at 3:4, centred in the part of a Story that Instagram leaves uncovered', async () => {
    setMoments(1);
    await render(<ShareCardScreen jarId="jar-10" />);
    const unit = unitOf();
    const safe = safeArea('story');
    const cell = cellBox(slots[0]!);
    expect(cell.width / cell.height).toBeCloseTo(3 / 4);
    expect((cell.left + cell.width / 2) / unit).toBeCloseTo(540);
    expect(cell.top / unit).toBeGreaterThanOrEqual(safe.y - 1e-6);
  });

  it('puts the caption, title and link under the photos, inside the uncovered part', async () => {
    setMoments(3);
    mockJar.moments[0] = moment(0, { caption: 'Early night.' });
    await render(<ShareCardScreen jarId="jar-10" />);
    const unit = unitOf();
    const safe = safeArea('story');
    const text = boxOf('share-card-text');
    const bottomOfPhotos = Math.max(...[0, 1, 2].map((i) => cellBox(slots[i]!)).map((c) => c.top + c.height));
    expect(text.top).toBeGreaterThanOrEqual(bottomOfPhotos);
    expect((text.top + text.height) / unit).toBeLessThanOrEqual(safe.y + safe.height + 1e-6);
    expect((text.top + text.height) / unit).toBeLessThanOrEqual(1920 - 250 + 1e-6);
    expect(screen.getByText('“Early night.”')).toBeTruthy();
    expect(screen.getByText('Dale’s Sunday')).toBeTruthy();
    expect(screen.getByText('pickld.me/dale')).toBeTruthy();
  });
});
