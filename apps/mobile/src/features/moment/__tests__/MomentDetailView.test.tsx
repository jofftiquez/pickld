import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import type { JarMoment, JarPageData } from '@/features/jar/jarPage';

import { MomentDetailView, type MomentDetailViewProps } from '../MomentDetailView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const READER = 'reader-id';

function moment(over: Partial<JarMoment> & Pick<JarMoment, 'id' | 'slot'>): JarMoment {
  return {
    status: 'live',
    is_private: false,
    is_backfilled: false,
    caption: null,
    captured_at: '2026-11-08T23:30:00Z', // 7:30 AM on Mon, Nov 9 in Manila
    added_at: '2026-11-08T23:30:00Z',
    edits: {},
    like_count: 0,
    thumbUrl: null,
    fullUrl: `https://photos.test/${over.id}.webp`,
    ...over,
  };
}

// Slot order: whereami, mebusywith, whoamiwith, ootd, selfie, morning, afternoon, evening.
const jar: JarPageData = {
  jar: {
    id: 'jar-1',
    user_id: 'dale-id',
    local_date: '2026-11-09',
    tz: 'Asia/Manila',
    moment_count: 6,
    visible_count: 3,
    like_count: 0,
    comment_count: 3,
  },
  author: { username: 'dale', display_name: 'Dale Santos' },
  moments: [
    moment({ id: 'evening', slot: 'evening' }),
    moment({ id: 'ootd', slot: 'ootd', caption: 'Green shirt day.', like_count: 12, is_backfilled: true }),
    moment({ id: 'private', slot: 'selfie', is_private: true }),
    moment({ id: 'checking', slot: 'morning', status: 'checking' }),
    moment({ id: 'removed', slot: 'afternoon', status: 'removed' }),
    moment({ id: 'whereami', slot: 'whereami' }),
  ],
  viewerId: READER,
};

async function setup(props: Partial<MomentDetailViewProps> = {}) {
  const handlers = { onClose: jest.fn(), onShare: jest.fn(), onRetry: jest.fn() };
  await render(<MomentDetailView data={jar} momentId="ootd" insets={insets} locale="en-US" {...handlers} {...props} />);
  return handlers;
}

const swipeTo = async (page: number) =>
  fireEvent(screen.getByTestId('moment-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: Dimensions.get('window').width * page, y: 0 } },
  });

describe('MomentDetailView', () => {
  it('opens on the moment with its slot, time, caption, likes, comments and Added later', async () => {
    await setup();
    expect(screen.getByTestId('moment-when')).toHaveTextContent('7:30 AM · Mon, Nov 9');
    expect(screen.getByTestId('moment-caption')).toHaveTextContent('Green shirt day.');
    expect(screen.getByTestId('moment-added-later')).toHaveTextContent('Added later');
    expect(screen.getByLabelText('12 likes')).toBeTruthy();
    expect(screen.getByLabelText('3 comments')).toBeTruthy();
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 2 of 3 · swipe for the next');
    expect(screen.getByText('Dale')).toBeTruthy();
  });

  it('swipes through visible moments only, with the progress bars following', async () => {
    await setup();
    expect(screen.getAllByTestId('moment-progress-done', { includeHiddenElements: true })).toHaveLength(2);
    // The reader's pages are whereami, ootd, evening: the private, checking and removed ones aren't there.
    expect(screen.queryByTestId('moment-page-selfie')).toBeNull();
    expect(screen.queryByTestId('moment-page-morning')).toBeNull();
    await swipeTo(2);
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 3 of 3');
    expect(screen.queryByTestId('moment-caption')).toBeNull();
    expect(screen.getAllByTestId('moment-progress-done', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getAllByTestId('moment-progress-todo', { includeHiddenElements: true })).toHaveLength(5);
    await swipeTo(0);
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 1 of 3 · swipe for the next');
  });

  it('moves between moments with screen reader adjust actions', async () => {
    await setup();
    const photo = screen.getByRole('adjustable');
    expect(photo).toHaveProp('accessibilityLabel', '#ootd photo, moment 2 of 3');
    await fireEvent(photo, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 3 of 3');
    await fireEvent(photo, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 3 of 3');
  });

  it('never opens a private moment for a reader, but does for its owner', async () => {
    await setup({ momentId: 'private' });
    expect(screen.getByTestId('moment-not-available')).toBeTruthy();
    expect(screen.queryByTestId('moment-sheet')).toBeNull();

    await setup({ momentId: 'private', data: { ...jar, viewerId: 'dale-id' } });
    expect(screen.getByTestId('moment-private')).toBeTruthy();
    expect(screen.getByTestId('moment-position')).toHaveTextContent('Moment 3 of 4 · swipe for the next');
  });

  it('closes and shares', async () => {
    const { onClose, onShare } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
