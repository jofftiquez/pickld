import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ProfileMoment } from '../profileModel';
import { buildProfileJars } from '../profileModel';
import type { ProfilePage } from '../useProfile';
import { ProfileView, type ProfileViewProps } from '../ProfileView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

function moment(over: Partial<ProfileMoment> & Pick<ProfileMoment, 'id' | 'jar_id' | 'slot'>): ProfileMoment {
  return {
    status: 'live',
    visibility: 'readers',
    is_backfilled: false,
    caption: null,
    captured_at: null,
    added_at: '2026-11-08T01:00:00Z',
    edits: {},
    like_count: 0,
    thumbUrl: null,
    fullUrl: null,
    ...over,
  };
}

const mikaJar = {
  id: 'jar-1',
  user_id: 'mika-id',
  local_date: '2026-11-08',
  tz: 'Asia/Manila',
  moment_count: 8,
  visible_count: 7,
  like_count: 0,
  comment_count: 0,
};

function page(viewerId: string, readsYou: boolean): ProfilePage {
  return {
    profile: {
      id: 'mika-id',
      username: 'mikareyes',
      display_name: 'Mika Reyes',
      bio: 'Nurse, plant parent.',
      lid_color: '#7fad33',
      reader_count: 1234,
      author_count: 203,
      jar_count: 1,
    },
    relationship: { reading: false, readsYou },
    viewerId,
    jars: buildProfileJars([mikaJar], [moment({ id: 'm1', jar_id: 'jar-1', slot: 'evening' })], viewerId),
  };
}

async function renderView(props: Partial<ProfileViewProps> & Pick<ProfileViewProps, 'data'>) {
  const handlers = { onBack: jest.fn(), onOpenJar: jest.fn(), onOpenMoment: jest.fn(), onShare: jest.fn() };
  await render(<ProfileView insets={insets} onRetry={jest.fn()} locale="en-US" {...handlers} {...props} />);
  return handlers;
}

describe('ProfileView', () => {
  it('shows the header, compact counts and the visible jar count to another viewer', async () => {
    await renderView({ data: page('dale-id', true) });
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Mika Reyes');
    expect(screen.getByTestId('profile-username')).toHaveTextContent('@mikareyes');
    expect(screen.getByTestId('profile-reads-you')).toHaveTextContent('Reads you');
    expect(screen.getByTestId('profile-count-readers')).toHaveTextContent('1.2kReaders');
    expect(screen.getByLabelText('1234 readers')).toBeTruthy();
    // Another viewer's count is the moments they are shown (D-50), here the one evening moment.
    expect(screen.getByTestId('profile-jar-2026-11-08')).toHaveTextContent('Nov 81/8');
    expect(screen.queryByTestId('profile-edit')).toBeNull();
  });

  it('never tags the owner with "Reads you" and shows them their full count', async () => {
    await renderView({ data: page('mika-id', true), onEditProfile: jest.fn() });
    expect(screen.queryByTestId('profile-reads-you')).toBeNull();
    expect(screen.getByTestId('profile-jar-2026-11-08')).toHaveTextContent('Nov 88/8');
    expect(screen.getByTestId('profile-edit')).toBeTruthy();
  });

  it('opens a jar from the Jars tab and a moment from the Moments tab', async () => {
    const { onOpenJar, onOpenMoment } = await renderView({ data: page('dale-id', false) });
    await fireEvent.press(screen.getByTestId('profile-jar-2026-11-08'));
    expect(onOpenJar).toHaveBeenCalledWith('jar-1');
    await fireEvent.press(screen.getByText('Moments'));
    await fireEvent.press(screen.getByTestId('profile-moment-m1'));
    expect(onOpenMoment).toHaveBeenCalledWith('m1', 'jar-1');
  });

  it('shows Read back to someone who reads you, Reading once you read them, and opens the lists', async () => {
    const onToggleReading = jest.fn();
    const onOpenList = jest.fn();
    await renderView({ data: page('dale-id', true), onToggleReading, onOpenList });
    expect(screen.getByTestId('profile-follow')).toHaveTextContent('Read back');
    await fireEvent.press(screen.getByTestId('profile-follow'));
    expect(onToggleReading).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('profile-count-authors'));
    expect(onOpenList).toHaveBeenCalledWith('authors');
    const reading = page('dale-id', true);
    await renderView({ data: { ...reading, relationship: { reading: true, readsYou: true } }, onToggleReading });
    expect(screen.getByTestId('profile-follow')).toHaveTextContent('Reading');
  });

  it('has a Stickers row on your own profile only (D-61)', async () => {
    const onOpenStickers = jest.fn();
    await renderView({ data: page('mika-id', false), onOpenStickers });
    await fireEvent.press(screen.getByRole('button', { name: 'Stickers' }));
    expect(onOpenStickers).toHaveBeenCalledTimes(1);
    await renderView({ data: page('dale-id', false), onOpenStickers });
    expect(screen.queryByRole('button', { name: 'Stickers' })).toBeNull();
  });

  it('has no follow button on your own profile', async () => {
    await renderView({ data: page('mika-id', false), onToggleReading: jest.fn() });
    expect(screen.queryByTestId('profile-follow')).toBeNull();
  });

  it('says so when another person has shared nothing', async () => {
    await renderView({ data: { ...page('dale-id', false), jars: [] } });
    expect(screen.getByTestId('profile-empty')).toHaveTextContent('Mika Reyes hasn’t shared any jars with you yet.');
  });

  it('says the profile is not available when RLS returns nothing', async () => {
    await renderView({ data: null });
    expect(screen.getByText('This profile isn’t available')).toBeTruthy();
  });
});
