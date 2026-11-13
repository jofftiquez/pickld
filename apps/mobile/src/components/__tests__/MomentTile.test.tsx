import { fireEvent, render, screen } from '@testing-library/react-native';

import { processColor } from 'react-native';

import { MomentTile, momentTileStates, type MomentTileProps } from '../MomentTile';
import { PhotoTile } from '../PhotoTile';
import { colors, photo, radius, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle } from './testUtils';

const URI = 'file:///queue/ootd.jpg';
const hidden = { includeHiddenElements: true } as const;

async function renderTile(props: Partial<MomentTileProps> = {}) {
  const onPress = jest.fn();
  const onRetry = jest.fn();
  await render(
    <MomentTile slot="ootd" state="filled" uri={URI} time="7:30 AM" onPress={onPress} onRetry={onRetry} {...props} />,
  );
  return { onPress, onRetry };
}

function overlayColor() {
  const overlay = screen.queryByTestId('photo-tile-overlay', hidden);
  return overlay ? flatStyle(overlay).backgroundColor : undefined;
}

describe('PhotoTile', () => {
  it('hides a decorative photo from screen readers and keeps the 3:4 shape by default', async () => {
    await render(<PhotoTile uri={URI} label="#ootd" testID="tile" />);
    expect(screen.queryByRole('image')).toBeNull();
    const image = screen.getByTestId('photo-tile-image', hidden);
    expect(image.props.accessibilityElementsHidden).toBe(true);
    expect(image.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(flatStyle(screen.getByTestId('tile'))).toMatchObject({
      aspectRatio: photo.aspect,
      borderRadius: radius.tile,
    });
    expect(screen.getByText('#ootd')).toBeTruthy();
  });

  it('announces the photo when given alt text', async () => {
    await render(<PhotoTile uri={URI} alt="City buildings" />);
    expect(screen.getByRole('image', { name: 'City buildings' })).toBeTruthy();
  });

  it('draws the dark bottom fade at the token height and honors a fixed height', async () => {
    await render(<PhotoTile uri={URI} height={sizes.momentTile} testID="tile" />);
    const fade = screen.getByTestId('photo-tile-fade', hidden);
    expect(fade.props.colors).toEqual([processColor(colors.photoFadeClear), processColor(colors.photoFade)]);
    expect(flatStyle(fade)).toMatchObject({ height: sizes.momentTileFade, bottom: 0 });
    const style = flatStyle(screen.getByTestId('tile'));
    expect(style.minHeight).toBe(sizes.momentTile);
    expect(style.aspectRatio).toBeUndefined();
  });

  it('blurs only when asked and shows the placeholder without a photo', async () => {
    await render(<PhotoTile uri={URI} blurred />);
    expect(screen.getByTestId('photo-tile-image', hidden).props.blurRadius).toBe(photo.checkingBlur);
    await render(<PhotoTile uri={URI} />);
    expect(screen.getByTestId('photo-tile-image', hidden).props.blurRadius).toBeUndefined();
    await render(<PhotoTile uri={null} testID="tile" />);
    expect(screen.queryByTestId('photo-tile-image', hidden)).toBeNull();
    expect(flatStyle(screen.getByTestId('tile')).backgroundColor).toBe(colors.photoPlaceholder);
  });
});

describe('MomentTile', () => {
  it('lists every state for the gallery', () => {
    expect(momentTileStates).toEqual([
      'filled',
      'empty',
      'now',
      'waiting',
      'uploading',
      'failed',
      'checking',
      'removed',
    ]);
  });

  it('filled: reads "#slot, time, added", shows photo, time and tag, and opens on press', async () => {
    const { onPress } = await renderTile();
    const tile = screen.getByRole('button', { name: '#ootd, 7:30 AM, added' });
    expect(screen.getByText('7:30 AM')).toBeTruthy();
    expect(screen.getByText('#ootd')).toBeTruthy();
    expect(screen.getByTestId('photo-tile-image', hidden).props.source).toEqual([{ uri: URI }]);
    expect(screen.queryByTestId('tile-lock', hidden)).toBeNull();
    expect(screen.queryByText('Added later')).toBeNull();
    expect(overlayColor()).toBeUndefined();
    expect(flatStyle(tile)).toMatchObject({ minHeight: sizes.momentTile, borderRadius: radius.tile });
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('private: shows a lock icon and says "private" (not color alone)', async () => {
    await renderTile({ visibility: 'only_me' });
    expect(screen.getByRole('button', { name: '#ootd, 7:30 AM, private' })).toBeTruthy();
    expect(screen.getByTestId('tile-lock', hidden)).toBeTruthy();
    expect(screen.getByTestId('icon-lock', hidden).props.stroke).toBe(colors.surface);
  });

  it.each([
    ['readers', 'readers can see it', 'icon-readers'],
    ['everyone', 'everyone can see it', 'icon-globe'],
  ] as const)('%s: shows its visibility badge and says who can see it (D-48)', async (visibility, words, icon) => {
    await renderTile({ visibility });
    expect(screen.getByRole('button', { name: `#ootd, 7:30 AM, ${words}` })).toBeTruthy();
    expect(screen.getByTestId(`tile-visibility-${visibility}`, hidden)).toBeTruthy();
    expect(screen.getByTestId(icon, hidden)).toBeTruthy();
    expect(screen.queryByTestId('tile-lock', hidden)).toBeNull();
  });

  it('added later: shows the badge and says it', async () => {
    await renderTile({ addedLater: true });
    expect(screen.getByRole('button', { name: '#ootd, 7:30 AM, added later' })).toBeTruthy();
    expect(screen.getByText('Added later')).toBeTruthy();
    expect(flatStyle(screen.getByTestId('tile-added-later')).backgroundColor).toBe(colors.badge);
  });

  it('private and added later together keep both markers', async () => {
    await renderTile({ visibility: 'only_me', addedLater: true });
    expect(screen.getByRole('button', { name: '#ootd, 7:30 AM, private, added later' })).toBeTruthy();
    expect(screen.getByTestId('tile-lock', hidden)).toBeTruthy();
    expect(screen.getByText('Added later')).toBeTruthy();
  });

  it('empty: dashed white tile with slot icon and +, reads "#slot, empty"', async () => {
    const { onPress } = await renderTile({ slot: 'whoamiwith', state: 'empty', uri: null, time: undefined });
    const tile = screen.getByRole('button', { name: '#whoamiwith, empty' });
    expect(flatStyle(tile)).toMatchObject({
      borderStyle: 'dashed',
      borderColor: colors.dashed,
      borderWidth: sizes.tileBorder,
      backgroundColor: colors.surface,
      minHeight: sizes.momentTile,
    });
    expect(screen.getByTestId('icon-whoamiwith', hidden)).toBeTruthy();
    expect(screen.getByTestId('tile-plus', hidden)).toBeTruthy();
    expect(screen.queryByTestId('photo-tile-image', hidden)).toBeNull();
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalled();
  });

  it('empty ignores private and added-later flags (nothing to mark yet)', async () => {
    await renderTile({ state: 'empty', uri: null, time: undefined, visibility: 'only_me', addedLater: true });
    expect(screen.getByRole('button', { name: '#ootd, empty' })).toBeTruthy();
    expect(screen.queryByTestId('tile-lock', hidden)).toBeNull();
  });

  it('now: dark ink tile with "Now" and "Tap to capture"', async () => {
    await renderTile({ slot: 'afternoon', state: 'now', uri: null, time: undefined });
    const tile = screen.getByRole('button', { name: '#afternoon, now, tap to capture' });
    expect(flatStyle(tile).backgroundColor).toBe(colors.ink);
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Tap to capture')).toBeTruthy();
    expect(screen.getByText('#afternoon')).toBeTruthy();
    expect(screen.getByTestId('icon-afternoon', hidden)).toBeTruthy();
    expect(screen.queryByTestId('tile-plus', hidden)).toBeNull();
  });

  it('waiting: clock icon and "Waiting for connection"', async () => {
    await renderTile({ slot: 'whereami', state: 'waiting', time: '12:30 PM' });
    expect(screen.getByRole('button', { name: '#whereami, 12:30 PM, waiting for connection' })).toBeTruthy();
    expect(screen.getByText('Waiting for connection')).toBeTruthy();
    expect(screen.getByTestId('icon-clock', hidden)).toBeTruthy();
    expect(overlayColor()).toBe(colors.glass);
  });

  it('uploading: shows the percentage as text and as the ring', async () => {
    await renderTile({ slot: 'selfie', state: 'uploading', time: '11:05 AM', progress: 0.6 });
    expect(screen.getByRole('button', { name: '#selfie, 11:05 AM, uploading 60%' })).toBeTruthy();
    expect(screen.getByText('Uploading 60%')).toBeTruthy();
    const arc = screen.getByTestId('tile-progress-arc', hidden);
    const circumference = Number([arc.props.strokeDasharray].flat()[0]);
    expect(Number(arc.props.strokeDashoffset)).toBeCloseTo(circumference * 0.4);
    expect(overlayColor()).toBe(colors.glass);
  });

  it.each([
    [0.666, 'Uploading 67%'],
    [1.4, 'Uploading 100%'],
    [-0.2, 'Uploading 0%'],
  ])('uploading: progress %p shows "%s"', async (progress, text) => {
    await renderTile({ state: 'uploading', progress });
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('uploading without known progress: a spinner and "Uploading", no percentage', async () => {
    await renderTile({ slot: 'selfie', state: 'uploading', time: '11:05 AM' });
    expect(screen.getByRole('button', { name: '#selfie, 11:05 AM, uploading' })).toBeTruthy();
    expect(screen.getByText('Uploading')).toBeTruthy();
    expect(screen.getByTestId('tile-spinner', hidden)).toBeTruthy();
    expect(screen.queryByTestId('tile-progress-ring', hidden)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('failed: warning icon, "Didn’t upload" text and a labelled Retry with a 44 pt target', async () => {
    const { onPress, onRetry } = await renderTile({ slot: 'morning', state: 'failed', time: '6:48 AM' });
    expect(screen.getByRole('button', { name: '#morning, 6:48 AM, didn’t upload' })).toBeTruthy();
    expect(screen.getByText('Didn’t upload')).toBeTruthy();
    expect(screen.getByTestId('icon-warning', hidden)).toBeTruthy();
    expect(overlayColor()).toBe(colors.failedOverlay);
    const retry = screen.getByRole('button', { name: 'Retry #morning' });
    expect(screen.getByText('Retry')).toBeTruthy();
    expectMinTapArea(retry);
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('failed: screen readers can retry from the tile itself', async () => {
    const { onRetry } = await renderTile({ state: 'failed' });
    const tile = screen.getByRole('button', { name: '#ootd, 7:30 AM, didn’t upload' });
    expect(tile.props.accessibilityActions).toEqual(expect.arrayContaining([{ name: 'retry', label: 'Retry' }]));
    await fireEvent(tile, 'accessibilityAction', { nativeEvent: { actionName: 'retry' } });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('failed without onRetry shows no Retry button', async () => {
    await render(<MomentTile slot="ootd" state="failed" uri={URI} time="7:30 AM" />);
    expect(screen.queryByRole('button', { name: 'Retry #ootd' })).toBeNull();
    expect(screen.getByText('Didn’t upload')).toBeTruthy();
  });

  it('checking: blurs the photo and says "Checking"', async () => {
    await renderTile({ state: 'checking', visibility: 'only_me' });
    expect(screen.getByRole('button', { name: '#ootd, 7:30 AM, checking, private' })).toBeTruthy();
    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.getByTestId('photo-tile-image', hidden).props.blurRadius).toBe(photo.checkingBlur);
    expect(screen.getByTestId('tile-lock', hidden)).toBeTruthy();
  });

  it('removed: blurs the photo, says "Removed" and opens the notice when tapped', async () => {
    const { onPress } = await renderTile({ state: 'removed', time: undefined });
    const tile = screen.getByRole('button', { name: '#ootd, removed, tap to see why' });
    expect(screen.getByText('Removed')).toBeTruthy();
    expect(screen.getByTestId('photo-tile-image', hidden).props.blurRadius).toBe(photo.checkingBlur);
    expect(overlayColor()).toBe(colors.glass);
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('only the checking and removed states blur the photo', async () => {
    for (const state of ['filled', 'waiting', 'uploading', 'failed'] as const) {
      await renderTile({ state });
      expect(screen.getByTestId('photo-tile-image', hidden).props.blurRadius).toBeUndefined();
    }
  });

  it('a read-only tile is an image, not a button', async () => {
    await render(<MomentTile slot="evening" state="filled" uri={URI} time="8:10 PM" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('image', { name: '#evening, 8:10 PM, added' })).toBeTruthy();
  });
});
