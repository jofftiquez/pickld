import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { buildTodayGrid, type QueuedMoment, type ServerMoment } from '@/features/jar/todayGrid';

import { buildPreviewItems } from '../momentPreview';
import { MomentPreviewView, type MomentPreviewViewProps } from '../MomentPreviewView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

const live = (slot: ServerMoment['slot'], over: Partial<ServerMoment> = {}): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-08T23:30:00Z', // 7:30 AM on Mon, Nov 9 in Manila
  added_at: '2026-11-08T23:30:00Z',
  thumbUrl: `https://photos.test/${slot}.webp`,
  ...over,
});
const queued = (id: number, slot: QueuedMoment['slot'], state: QueuedMoment['state']): QueuedMoment => ({
  id,
  slot,
  state,
  localDate: '2026-11-09',
  photoUri: `file:///q/${slot}.webp`,
  thumbUri: null,
  capturedAt: '2026-11-09T04:30:00Z',
  visibility: 'only_me',
});

const moments = [live('whereami'), live('ootd', { visibility: 'only_me', is_backfilled: true })];
const queue = [queued(21, 'selfie', 'queued'), queued(22, 'evening', 'uploading')];
const items = buildPreviewItems({
  tiles: buildTodayGrid({ localDate: '2026-11-09', moments, queue, nowSlot: null, jarTz: 'Asia/Manila' }),
  queue,
  jarId: 'jar-1',
});

async function setup(props: Partial<MomentPreviewViewProps> = {}) {
  const handlers = {
    onClose: jest.fn(),
    onEdit: jest.fn(),
    onShare: jest.fn(),
    onVisibility: jest.fn(),
    onMore: jest.fn(),
    onDelete: jest.fn(),
  };
  const view = await render(
    <MomentPreviewView
      items={items}
      startSlot="whereami"
      tz="Asia/Manila"
      insets={insets}
      locale="en-US"
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, view };
}

const swipeTo = async (page: number) =>
  fireEvent(screen.getByTestId('preview-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: Dimensions.get('window').width * page, y: 0 } },
  });

afterEach(() => {
  Dimensions.set({ window: { ...Dimensions.get('window'), fontScale: 1 } });
});

describe('MomentPreviewView', () => {
  it('a live moment: slot, time, visibility and the bar with Edit, Share, Visibility and More', async () => {
    const h = await setup();
    expect(screen.getByTestId('preview-when')).toHaveTextContent('7:30 AM · Mon, Nov 9');
    expect(screen.getByLabelText('Visibility: Readers')).toBeTruthy();
    expect(screen.getByTestId('preview-position')).toHaveTextContent('Moment 1 of 4 · swipe for the next');
    expect(screen.queryByTestId('preview-delete')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Visibility' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    for (const fn of [h.onEdit, h.onShare, h.onVisibility, h.onMore]) {
      expect(fn.mock.calls.map(([item]) => item.key)).toEqual(['m-whereami']);
    }
  });

  it('offers the owner Set as cover in the bar, and shows Cover instead on the jar’s cover (D-98)', async () => {
    const onSetCover = jest.fn();
    const withCover = items.map((i) => (i.slot === 'ootd' ? { ...i, isCover: true } : i));
    await setup({ items: withCover, onSetCover });
    await fireEvent.press(screen.getByRole('button', { name: 'Set as cover' }));
    expect(onSetCover.mock.calls.map(([item]) => item.key)).toEqual(['m-whereami']);
    expect(screen.queryByTestId('preview-cover-action')).toBeNull();

    await swipeTo(1);
    const cover = screen.getByTestId('preview-cover-action');
    expect(cover).toBeDisabled();
    expect(cover.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.queryByTestId('preview-set-cover')).toBeNull();
    await fireEvent.press(cover);
    expect(onSetCover).toHaveBeenCalledTimes(1);
  });

  it('leaves Set as cover out of the bar when the screen can’t set it', async () => {
    await setup();
    expect(screen.queryByTestId('preview-set-cover')).toBeNull();
    expect(screen.queryByTestId('preview-cover-action')).toBeNull();
  });

  it('an Only me moment keeps Share but it is disabled and says why', async () => {
    const h = await setup({ startSlot: 'ootd' });
    const share = screen.getByTestId('preview-share');
    expect(share).toBeDisabled();
    expect(share.props.accessibilityHint).toBe('Only you can see this moment, so it can’t be shared');
    await fireEvent.press(share);
    expect(h.onShare).not.toHaveBeenCalled();
    expect(screen.getByTestId('preview-added-later')).toHaveTextContent('Added later');
  });

  it('a photo still on the phone has only Edit and Delete; while it uploads, no actions', async () => {
    const h = await setup({ startSlot: 'selfie' });
    expect(screen.getByTestId('preview-note')).toHaveTextContent(/not uploaded yet/);
    expect(screen.queryByTestId('preview-share')).toBeNull();
    expect(screen.queryByTestId('preview-visibility-action')).toBeNull();
    expect(screen.queryByTestId('preview-more')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(h.onDelete.mock.calls.map(([item]) => item.key)).toEqual(['queue:21']);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(h.onEdit.mock.calls.map(([item]) => item.target)).toEqual([{ kind: 'queued', queueId: 21 }]);

    await swipeTo(3);
    expect(screen.getByTestId('preview-note')).toHaveTextContent('Uploading… You can change it once it’s up.');
    expect(screen.queryByTestId('preview-actions')).toBeNull();
  });

  it('swipes and screen-reader adjusts through today’s moments in slot order', async () => {
    await setup();
    const photo = () => screen.getByTestId('preview-photo');
    expect(photo().props.accessibilityLabel).toBe('#whereami photo, moment 1 of 4');
    expect(photo().props.accessibilityRole).toBe('adjustable');

    await swipeTo(1);
    expect(photo().props.accessibilityLabel).toBe('#ootd photo, moment 2 of 4');
    await fireEvent(photo(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(photo().props.accessibilityLabel).toBe('#selfie photo, moment 3 of 4');
    await fireEvent(photo(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId('preview-position')).toHaveTextContent('Moment 4 of 4');
    // Past the end nothing moves.
    await fireEvent(photo(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(photo().props.accessibilityLabel).toBe('#evening photo, moment 4 of 4');
    await fireEvent(photo(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(photo().props.accessibilityLabel).toBe('#selfie photo, moment 3 of 4');
  });

  it('when the moment on screen goes away it shows the next one; with none left it says so', async () => {
    const { view } = await setup({ startSlot: 'ootd' });
    const props = {
      startSlot: 'ootd' as const,
      tz: 'Asia/Manila',
      insets,
      locale: 'en-US',
      onClose: jest.fn(),
      onEdit: jest.fn(),
      onShare: jest.fn(),
      onVisibility: jest.fn(),
      onMore: jest.fn(),
      onDelete: jest.fn(),
    };
    await view.rerender(<MomentPreviewView items={items.filter((i) => i.slot !== 'ootd')} {...props} />);
    expect(screen.getByTestId('preview-photo').props.accessibilityLabel).toBe('#selfie photo, moment 2 of 3');
    await view.rerender(<MomentPreviewView items={[]} {...props} />);
    expect(screen.getByTestId('preview-not-available')).toBeTruthy();
  });

  it('at 200% text the bar puts two actions per row', async () => {
    Dimensions.set({ window: { ...Dimensions.get('window'), fontScale: 2 } });
    await setup();
    expect(screen.getByTestId('preview-actions')).toHaveStyle({ flexWrap: 'wrap' });
  });
});
