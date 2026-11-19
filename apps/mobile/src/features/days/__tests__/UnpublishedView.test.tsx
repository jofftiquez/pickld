import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { UnpublishedJar } from '../unpublishedJars';
import { UnpublishedView, type UnpublishedViewProps } from '../UnpublishedView';

const jar = (localDate: string, momentCount: number): UnpublishedJar => ({
  id: `j-${localDate}`,
  localDate,
  momentCount,
  coverMomentId: null,
  coverUrl: null,
});

const WED = jar('2026-11-18', 6);
const MON = jar('2026-11-16', 3);
const JARS = [WED, MON];

async function renderList(props: Partial<UnpublishedViewProps> = {}) {
  const handlers = { onBack: jest.fn(), onOpen: jest.fn(), onPublish: jest.fn(), onKeep: jest.fn() };
  await render(
    <UnpublishedView
      jars={JARS}
      insets={{ top: 47, bottom: 34, left: 0, right: 0 }}
      locale="en-US"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('UnpublishedView', () => {
  it('lists each day with its count; Publish, Keep and the row act on that day only', async () => {
    const h = await renderList();
    const row = within(screen.getByTestId('unpublished-row-2026-11-16'));
    expect(row.getByText('Mon, Nov 16')).toBeTruthy();
    expect(row.getByText('3 of 8 moments')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Publish Mon, Nov 16' }));
    expect(h.onPublish).toHaveBeenCalledWith(MON);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep Wed, Nov 18 to myself' }));
    expect(h.onKeep).toHaveBeenCalledWith(['j-2026-11-18']);
    await fireEvent.press(screen.getByTestId('unpublished-open-2026-11-18'));
    expect(h.onOpen).toHaveBeenCalledWith(WED);
  });

  it('keeps every day only after the confirm', async () => {
    const h = await renderList();
    await fireEvent.press(screen.getByTestId('unpublished-keep-all'));
    expect(h.onKeep).not.toHaveBeenCalled();
    expect(screen.getByText('Keep 2 days to yourself?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unpublished-keep-all-confirm'));
    expect(h.onKeep).toHaveBeenCalledWith(['j-2026-11-18', 'j-2026-11-16']);
  });

  it('has no Keep all for a single day, and shows the empty state when nothing waits', async () => {
    await renderList({ jars: [WED] });
    expect(screen.queryByTestId('unpublished-keep-all')).toBeNull();
    await renderList({ jars: [] });
    expect(screen.getByText('All caught up')).toBeTruthy();
  });
});
