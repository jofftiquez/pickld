import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { InviteView, type InviteViewProps } from '../InviteView';
import type { InviteCode, Invites } from '../invites';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const slots = ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'] as const;

/** Set `setNo` of 8 codes like "S1C0".."S1C7"; the listed slots are used. */
function set(setNo: number, used: Partial<Record<(typeof slots)[number], InviteCode['invitee']>> = {}): InviteCode[] {
  return slots.map((slot, i) => ({
    code: `S${setNo}C${i}`,
    setNo,
    slot,
    used: slot in used,
    invitee: used[slot] ?? null,
  }));
}

const mia = {
  joinedAt: '2026-11-12T03:00:00Z',
  profile: { id: 'm', username: 'mia', displayName: 'Mia Cruz', avatarPath: null },
};
// A friend hidden by a block (or who left): only the join shows.
const hidden = { joinedAt: '2026-11-13T03:00:00Z', profile: null };

const openInvites: Invites = {
  state: 'open',
  link: { id: 'LINK42', enabled: true },
  codes: set(1, { ootd: mia, selfie: hidden }),
};

async function setup(over: Partial<InviteViewProps> = {}) {
  const props: InviteViewProps = {
    invites: openInvites,
    insets,
    onBack: jest.fn(),
    onRetry: jest.fn(),
    onShareUrl: jest.fn(),
    onCopyUrl: jest.fn(),
    onLinkEnabled: jest.fn(),
    onResetLink: jest.fn(),
    onOpenProfile: jest.fn(),
    onAddMoment: jest.fn(),
    onHelp: jest.fn(),
    locale: 'en-US',
    ...over,
  };
  await render(<InviteView {...props} />);
  return props;
}

describe('InviteView', () => {
  it('lists unused codes hidden, shows one at a time, and shares a code as its own link', async () => {
    const props = await setup();
    expect(screen.getByText('Available (6)')).toBeTruthy();
    expect(screen.getByText('Invited (2)')).toBeTruthy();
    expect(screen.getByText('6 of 8')).toBeTruthy();
    // Used codes aren't on the Available tab.
    expect(screen.queryByTestId('invite-card-S1C3')).toBeNull();
    expect(screen.queryByText('S1C0')).toBeNull();

    await fireEvent.press(screen.getByTestId('invite-eye-S1C0'));
    expect(screen.getByText('S1C0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('invite-eye-S1C1'));
    expect(screen.queryByText('S1C0')).toBeNull();
    expect(screen.getByText('S1C1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('invite-share-S1C7'));
    expect(props.onShareUrl).toHaveBeenCalledWith('https://pickld.me/i/S1C7');
  });

  it('copies and shares the link, switches it off, and resets it only after confirming', async () => {
    const props = await setup();
    expect(screen.getByText('pickld.me/i/LINK42 · uses your next code')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Copy invite link'));
    expect(props.onCopyUrl).toHaveBeenCalledWith('https://pickld.me/i/LINK42');
    await fireEvent(screen.getByTestId('invite-link-switch'), 'valueChange', false);
    expect(props.onLinkEnabled).toHaveBeenCalledWith(false);

    await fireEvent.press(screen.getByTestId('invite-link-reset'));
    expect(props.onResetLink).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('invite-reset-confirm'));
    expect(props.onResetLink).toHaveBeenCalledTimes(1);
  });

  it('opens a code’s QR sheet', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('invite-qr-S1C5'));
    expect(screen.getByText('Scan to join Pickld')).toBeTruthy();
    expect(screen.getByLabelText('QR code for invite S 1 C 5')).toBeTruthy();
  });

  it('lists friends who joined; a hidden friend shows only as Joined, not by name', async () => {
    const props = await setup({ initialTab: 'invited' });
    expect(screen.getByText('Friends who joined with your codes. You read each other.')).toBeTruthy();
    const miaCard = screen.getByTestId('invite-card-S1C3');
    expect(within(miaCard).getByText('Mia Cruz')).toBeTruthy();
    expect(within(miaCard).getByText('Joined Nov 12')).toBeTruthy();
    await fireEvent.press(miaCard);
    expect(props.onOpenProfile).toHaveBeenCalledWith('mia');

    const hiddenCard = screen.getByTestId('invite-card-S1C4');
    expect(within(hiddenCard).getByText('Joined')).toBeTruthy();
    expect(within(hiddenCard).queryByText(/Nov 13/)).toBeNull();
    expect(screen.getByText('2 of 8 friends joined')).toBeTruthy();
    expect(screen.getByText('A used code never comes back, even if your friend leaves Pickld.')).toBeTruthy();
  });

  it('while locked, hides the link and points to the first moment', async () => {
    const props = await setup({ invites: { state: 'locked', link: { id: 'LINK42', enabled: true }, codes: set(1) } });
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.getByRole('header', { name: 'Add your first moment to unlock your invites' })).toBeTruthy();
    // Locked cards can't be shown, scanned or shared.
    expect(screen.queryByTestId('invite-eye-S1C0')).toBeNull();
    expect(screen.getAllByText('Locked')).toHaveLength(8);
    await fireEvent.press(screen.getByTestId('invite-add-moment'));
    expect(props.onAddMoment).toHaveBeenCalled();
  });

  it('while paused, hides the link and the codes can’t be given', async () => {
    const props = await setup({ invites: { ...openInvites, state: 'paused' } });
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.getByRole('header', { name: 'Invites paused' })).toBeTruthy();
    expect(screen.queryByTestId('invite-share-S1C0')).toBeNull();
    expect(screen.getAllByText('Paused')).toHaveLength(6);
    await fireEvent.press(screen.getByTestId('invite-help'));
    expect(props.onHelp).toHaveBeenCalled();
  });

  it('with two sets, heads each set and drops a set that’s all given', async () => {
    const allUsed = Object.fromEntries(slots.map((s) => [s, hidden]));
    await setup({ invites: { ...openInvites, codes: [...set(1, allUsed), ...set(2, { morning: mia })] } });
    expect(screen.getByText('7 of 16')).toBeTruthy();
    expect(screen.queryByTestId('invite-set-1')).toBeNull();
    expect(screen.getByText('Set 2 · 7 of 8 left')).toBeTruthy();
  });

  it('offers Try again when the page can’t load', async () => {
    const props = await setup({ invites: undefined, failed: true });
    await fireEvent.press(screen.getByTestId('invite-retry'));
    expect(props.onRetry).toHaveBeenCalled();
  });
});
