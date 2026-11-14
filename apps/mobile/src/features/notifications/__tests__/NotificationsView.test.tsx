import { fireEvent, render, screen } from '@testing-library/react-native';

import type { NotificationRow } from '../notificationsModel';
import { NotificationsView, type NotificationsViewProps } from '../NotificationsView';
import type { NotificationsData } from '../useNotifications';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOW = new Date('2026-11-12T07:00:00Z');
const mika = { id: 'm', username: 'mika', display_name: 'Mika Reyes' };
const aya = { id: 'a', username: 'aya', display_name: 'Aya' };
const jun = { id: 'j', username: 'jun', display_name: 'Jun' };

function row(over: Partial<NotificationRow> & Pick<NotificationRow, 'id' | 'type'>): NotificationRow {
  return {
    read_at: null,
    created_at: '2026-11-12T06:48:00Z',
    jar_id: null,
    moment_id: null,
    comment_id: null,
    actor: null,
    jar: null,
    comment: null,
    ...over,
  };
}

async function setup(over: Partial<NotificationsViewProps> = {}, data: Partial<NotificationsData> = {}) {
  const props: NotificationsViewProps = {
    data: {
      rows: [
        row({ id: '1', type: 'new_reader', actor: mika }),
        row({ id: '2', type: 'like', actor: aya, jar_id: 'j1', jar: { local_date: '2026-11-08' } }),
        row({ id: '3', type: 'like', actor: jun, jar_id: 'j1', jar: { local_date: '2026-11-08' } }),
      ],
      avatars: {},
      thumbs: {},
      jarMoment: {},
      reading: [],
      ...data,
    },
    reminderSlot: 'afternoon',
    now: NOW,
    tz: 'Asia/Manila',
    insets,
    onClose: jest.fn(),
    onRefresh: jest.fn(),
    onCapture: jest.fn(),
    onOpen: jest.fn(),
    onFollow: jest.fn(),
    locale: 'en-US',
    ...over,
  };
  await render(<NotificationsView {...props} />);
  return props;
}

describe('NotificationsView', () => {
  it('opens the related screen when a row is tapped', async () => {
    const props = await setup();
    await fireEvent.press(screen.getByLabelText('Unread, Aya and Jun liked your Sunday, 12m'));
    expect(props.onOpen).toHaveBeenCalledWith({ pathname: '/jar/[id]', params: { id: 'j1' } });
    await fireEvent.press(screen.getByLabelText('Unread, Mika Reyes started reading your days, 12m'));
    expect(props.onOpen).toHaveBeenCalledWith({ pathname: '/u/[username]', params: { username: 'mika' } });
  });

  it('offers Read back to a new reader the viewer does not read yet, and not once they do', async () => {
    const props = await setup();
    await fireEvent.press(screen.getByTestId('notification-follow'));
    expect(props.onFollow).toHaveBeenCalledWith(expect.objectContaining({ type: 'new_reader' }));
    await setup({}, { reading: ['m'] });
    expect(screen.queryByTestId('notification-follow')).toBeNull();
  });

  it('says who joined with an invite, and offers to read them when the viewer does not yet (0135)', async () => {
    const props = await setup({}, { rows: [row({ id: '9', type: 'invite_joined', actor: mika })] });
    expect(screen.getByLabelText('Unread, Mika Reyes joined with your invite. Say hi?, 12m')).toBeTruthy();
    expect(screen.getByText('Be a reader')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('notification-follow'));
    expect(props.onFollow).toHaveBeenCalledWith(expect.objectContaining({ type: 'invite_joined' }));
  });

  it('pins the reminder card only while the slot is empty, and Capture opens that slot', async () => {
    const props = await setup();
    await fireEvent.press(screen.getByLabelText('Capture your #afternoon'));
    expect(props.onCapture).toHaveBeenCalledWith('afternoon');
    await setup({ reminderSlot: null });
    expect(screen.queryByTestId('notifications-reminder')).toBeNull();
  });

  it('shows the empty state, with the pull-to-refresh hint, when there is nothing (D-87)', async () => {
    await setup({}, { rows: [] });
    expect(screen.getByTestId('notifications-empty')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'No notifications yet' })).toBeTruthy();
    expect(screen.getByText('Likes, comments and new readers show up here.')).toBeTruthy();
    expect(screen.getByTestId('notifications-empty-refresh-hint')).toHaveTextContent('Pull down to refresh');
  });
});
