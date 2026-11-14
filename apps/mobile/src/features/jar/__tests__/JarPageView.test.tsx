import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { JarMoment, JarPageData } from '../jarPage';
import { JarPageView, type JarPageViewProps } from '../JarPageView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const hidden = { includeHiddenElements: true } as const;

function moment(over: Partial<JarMoment> & Pick<JarMoment, 'id' | 'slot'>): JarMoment {
  return {
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    caption: null,
    captured_at: null,
    added_at: '2026-11-07T22:48:00Z', // 6:48 AM in Manila on Nov 8
    edits: {},
    like_count: 0,
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
    moment({ id: 'm-private', slot: 'ootd', visibility: 'only_me' }),
  ],
  viewerId: 'reader-id',
};

async function setup(props: Partial<JarPageViewProps> = {}) {
  const handlers = { onBack: jest.fn(), onShare: jest.fn(), onRetry: jest.fn() };
  await render(<JarPageView data={daleJar} insets={insets} locale="en-US" {...handlers} {...props} />);
  return handlers;
}

describe('JarPageView', () => {
  it('has a plain header with the author, day title, date, count and Full jar tag, and no cover band (D-97)', async () => {
    // The owner's count is every moment (D-9), so their full jar says so.
    const onOpenAuthor = jest.fn();
    await setup({ data: { ...daleJar, viewerId: 'dale-id' }, onOpenAuthor });
    expect(screen.getByRole('header', { name: 'Dale’s Sunday' })).toBeTruthy();
    expect(screen.getByTestId('jar-subtitle')).toHaveTextContent('Nov 8, 2026 · 8 of 8 moments');
    expect(screen.getByTestId('jar-full-tag')).toHaveTextContent('Full jar');
    expect(screen.queryByTestId('jar-highlight')).toBeNull();
    expect(screen.queryByTestId('jar-cover-photo')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Dale Santos' }));
    expect(onOpenAuthor).toHaveBeenCalledTimes(1);
    // Without a signed avatar, the author's initials.
    expect(within(screen.getByTestId('jar-avatar', hidden)).getByText('DS', hidden)).toBeTruthy();
  });

  it('shows the author’s signed profile photo, not initials, in the header (D-93)', async () => {
    await setup({ authorAvatarUrl: 'https://photos.test/avatars/dale.webp' });
    const avatar = within(screen.getByTestId('jar-avatar', hidden));
    expect(avatar.queryByText('DS', hidden)).toBeNull();
  });

  it('shows every visible moment in slot order in two columns, the cover badged and never a private one for a reader', async () => {
    await setup();
    const tiles = screen.getAllByTestId(/^jar-tile-[a-z]+$/).map((node) => node.props.testID as string);
    expect(tiles).toEqual(['jar-tile-whereami', 'jar-tile-mebusywith', 'jar-tile-morning']);
    expect(screen.getByLabelText('#whereami, added later')).toBeTruthy();
    expect(screen.getByTestId('jar-tile-whereami-added-later')).toHaveTextContent('Added later');
    expect(screen.getByLabelText('#mebusywith')).toBeTruthy();
    expect(screen.queryByTestId('jar-tile-mebusywith-added-later')).toBeNull();
    expect(screen.queryByTestId('jar-tile-ootd')).toBeNull();
    // The newest caption is the cover (D-56): badged "Cover" in the grid (D-98), not a header band.
    expect(screen.getByTestId('jar-tile-morning-cover')).toHaveTextContent('Cover');
    expect(screen.getByLabelText('#morning, cover')).toBeTruthy();
    expect(screen.queryByTestId('jar-tile-whereami-cover')).toBeNull();
    // Two 3:4 columns, as on Today (D-97): never cropped (D-89).
    expect(screen.getByTestId('jar-tile-morning').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: (750 - 2 * 20 - 12) / 2 })]),
    );
  });

  it('badges the owner’s pick and keeps Added later on a backfilled cover', async () => {
    const moments = daleJar.moments.map((m) => (m.slot === 'mebusywith' ? { ...m, is_backfilled: true } : m));
    await setup({ data: { ...daleJar, moments, jar: { ...daleJar.jar, resolved_cover_id: 'm-busy' } } });
    expect(screen.getByLabelText('#mebusywith, cover, added later')).toBeTruthy();
    expect(screen.queryByTestId('jar-tile-morning-cover')).toBeNull();
  });

  it('opens a tile with the moment’s id', async () => {
    const onOpenMoment = jest.fn();
    await setup({ onOpenMoment });
    await fireEvent.press(screen.getByTestId('jar-tile-morning'));
    expect(onOpenMoment).toHaveBeenCalledWith('m-morning');
  });

  it('shows the owner their private moment with a lock', async () => {
    await setup({ data: { ...daleJar, viewerId: 'dale-id' } });
    expect(screen.getByLabelText('#ootd, private')).toBeTruthy();
    expect(screen.getByTestId('jar-tile-ootd-lock')).toBeTruthy();
  });

  it('leaves out the Full jar tag below 8 and counts only the moments the reader is shown (D-50)', async () => {
    await setup();
    expect(screen.queryByTestId('jar-full-tag')).toBeNull();
    expect(screen.getByTestId('jar-subtitle')).toHaveTextContent('Nov 8, 2026 · 3 of 8 moments');
  });

  it('shows a reader likes and comments but no Share: only the owner shares (D-83)', async () => {
    const { onBack } = await setup();
    expect(screen.getByLabelText('48 likes')).toBeTruthy();
    expect(screen.getByLabelText('6 comments')).toBeTruthy();
    expect(screen.queryByTestId('jar-share')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share jar' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('lets the owner share their jar', async () => {
    const { onShare, onBack } = await setup({ data: { ...daleJar, viewerId: 'dale-id' } });
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
