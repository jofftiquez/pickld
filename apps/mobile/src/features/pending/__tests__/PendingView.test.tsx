import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { groupPending, type PendingItem } from '../pendingGroups';
import { PendingView, type PendingViewProps } from '../PendingView';

const NOW = new Date('2026-11-15T09:00:00+08:00');

const item = (over: Partial<PendingItem> & Pick<PendingItem, 'id'>): PendingItem => ({
  slot: 'morning',
  localDate: '2026-11-15',
  tz: 'Asia/Manila',
  photoUri: `file:///photo-${over.id}.webp`,
  thumbUri: null,
  state: 'queued',
  draft: false,
  editingSince: null,
  ...over,
});

const days = groupPending([
  item({ id: 1, slot: 'ootd', draft: true }),
  item({ id: 2, slot: 'whereami', state: 'uploading' }),
  item({ id: 3, localDate: '2026-11-12', slot: 'evening', state: 'failed' }),
  item({ id: 4, localDate: '2026-11-12', slot: 'selfie', state: 'conflict' }),
  item({ id: 5, localDate: '2026-11-12', slot: 'afternoon' }),
]);

async function renderPending(props: Partial<PendingViewProps> = {}) {
  const handlers = {
    onBack: jest.fn(),
    onOpen: jest.fn(),
    onRetry: jest.fn(),
    onReplace: jest.fn(),
    onDiscard: jest.fn(),
  };
  await render(
    <PendingView days={days} now={NOW} insets={{ top: 47, bottom: 34, left: 0, right: 0 }} {...handlers} {...props} />,
  );
  return handlers;
}

describe('PendingView', () => {
  it('lists every pending moment under its day, with the status and one main action each', async () => {
    const h = await renderPending();
    const today = within(screen.getByTestId('pending-day-2026-11-15'));
    expect(today.getByText('Today')).toBeTruthy();
    expect(today.getByText('Draft, not uploaded')).toBeTruthy();
    expect(within(screen.getByTestId('pending-day-2026-11-12')).getByText('Thu, Nov 12')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pending-finish-1'));
    expect(h.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 1, status: 'draft' }));
    await fireEvent.press(screen.getByTestId('pending-retry-3'));
    expect(h.onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
    await fireEvent.press(screen.getByTestId('pending-replace-4'));
    expect(h.onReplace).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
    // Waiting to upload: it uploads on its own, so it has no main action, only Discard.
    expect(screen.queryByTestId('pending-finish-5')).toBeNull();
    expect(screen.queryByTestId('pending-retry-5')).toBeNull();
    expect(screen.getByTestId('pending-discard-5')).toBeTruthy();
  });

  it('leaves a moment mid-upload alone: no actions and the row does not open', async () => {
    const h = await renderPending();
    expect(screen.getByText('Uploading…')).toBeTruthy();
    expect(screen.queryByTestId('pending-discard-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('pending-open-2'));
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('discards only after the confirm', async () => {
    const h = await renderPending();
    await fireEvent.press(screen.getByTestId('pending-discard-3'));
    expect(h.onDiscard).not.toHaveBeenCalled();
    expect(screen.getByText('Discard this photo?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pending-discard-confirm'));
    expect(h.onDiscard).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('shows the empty state when nothing is pending', async () => {
    await renderPending({ days: [] });
    expect(screen.getByTestId('pending-empty')).toBeTruthy();
    expect(screen.getByText('All uploaded')).toBeTruthy();
  });
});
