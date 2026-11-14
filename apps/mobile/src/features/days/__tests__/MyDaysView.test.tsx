import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { buildMonthGrid, earliestMonth, monthNav, monthsBetween, type MonthJar } from '../monthGrid';
import { MyDaysView, type MyDaysViewProps } from '../MyDaysView';

// The month picker opens in the real kit sheet; gorhom's native sheet is a plain pass-through here.
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
    BottomSheetScrollView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});

const TODAY = '2026-11-09';

function jar(localDate: string, count: number, coverUrl: string | null): MonthJar {
  return {
    jar_id: `j-${localDate}`,
    local_date: localDate,
    tz: 'Asia/Manila',
    moment_count: count,
    is_full: count === 8,
    cover_moment_id: coverUrl ? `m-${localDate}` : null,
    cover_thumb_path: coverUrl ? `thumbs/${localDate}.webp` : null,
    coverUrl,
  };
}

const JARS = [
  jar('2026-11-06', 3, 'https://photos.example/6.webp'),
  // An empty jar (no cover) and a jar whose cover URL couldn't be signed (offline or fn failure).
  jar('2026-11-07', 0, null),
  { ...jar('2026-11-08', 5, null), cover_moment_id: 'm-8', cover_thumb_path: 'thumbs/8.webp' },
  jar('2026-11-09', 2, 'https://photos.example/9.webp'),
];

async function renderMyDays(props: Partial<MyDaysViewProps> = {}) {
  const handlers = { onPrevious: jest.fn(), onNext: jest.fn(), onSelectDay: jest.fn() };
  await render(
    <MyDaysView
      grid={buildMonthGrid({ month: '2026-11', today: TODAY, jars: JARS })}
      momentCount={10}
      nav={monthNav('2026-11', '2026-11', '2026-09')}
      selectedDate={null}
      insets={{ top: 47, bottom: 34 }}
      locale="en-US"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('MyDaysView', () => {
  it('shows the title, month and moment count', async () => {
    await renderMyDays();
    expect(screen.getByTestId('screen-title').props.children).toBe('My days');
    expect(screen.getByText('November 2026 · 10 moments')).toBeTruthy();
  });

  it('announces Next month as disabled on the current month, and does not call it', async () => {
    const { onNext } = await renderMyDays();
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(next);
    expect(onNext).not.toHaveBeenCalled();
    const previous = screen.getByRole('button', { name: 'Previous month' });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('enables Next month on a past month and Previous stops 12 months back', async () => {
    const { onNext, onPrevious } = await renderMyDays({
      grid: buildMonthGrid({ month: '2025-11', today: TODAY }),
      nav: monthNav('2025-11', '2026-11', '2026-09'),
    });
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(next.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    const previous = screen.getByRole('button', { name: 'Previous month' });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(previous);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('labels days with their moment count, today, and future days as not yet (disabled)', async () => {
    const { onSelectDay } = await renderMyDays();
    expect(screen.getByRole('button', { name: 'November 6, 3 of 8 moments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'November 1, 0 of 8 moments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'November 9, today, 2 of 8 moments' })).toBeTruthy();
    const future = screen.getByRole('button', { name: 'November 10, not yet' });
    expect(future.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(future);
    expect(onSelectDay).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('day-2026-11-06'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-11-06');
  });

  it('draws covers only where there is a URL and fill bars only for jars with moments', async () => {
    await renderMyDays();
    // Covers: the 6th and the 9th. The empty jar and the unsigned cover show no photo.
    expect(screen.getAllByTestId('day-cover')).toHaveLength(2);
    expect(screen.getByTestId('day-2026-11-07')).toBeTruthy();
    // Fill bars: 6th, 8th (no photo but 5 moments) and 9th.
    expect(screen.getAllByTestId('day-fill')).toHaveLength(3);
  });

  it('draws weekday letters in the grid order, hidden from screen readers', async () => {
    await renderMyDays({ grid: buildMonthGrid({ month: '2026-11', today: TODAY, weekStart: 1 }) });
    expect(screen.queryByText('M')).toBeNull();
    const letters = screen
      .getAllByText(/^[SMTWF]$/, { includeHiddenElements: true })
      .map((n) => n.props.children as string);
    expect(letters).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  describe('month picker', () => {
    // My days on 2026-02 (current month) with the range from monthGrid, as app/my-days.tsx passes it.
    async function renderPicker(currentMonth: string, firstJarMonth: string | null, shown = currentMonth) {
      const onPickMonth = jest.fn();
      await renderMyDays({
        grid: buildMonthGrid({ month: shown, today: `${currentMonth}-10` }),
        nav: monthNav(shown, currentMonth, firstJarMonth),
        pickableMonths: monthsBetween(earliestMonth(currentMonth, firstJarMonth), currentMonth),
        onPickMonth,
      });
      return { onPickMonth };
    }
    const radioNames = () => screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel as string);

    it('labels the month line as a button that opens the month picker', async () => {
      await renderPicker('2026-02', null);
      const button = screen.getByRole('button', { name: 'February 2026, 10 moments' });
      expect(button.props.accessibilityHint).toBe('Opens the month picker');
      expect(screen.getByText('February 2026 · 10 moments')).toBeTruthy();
      expect(screen.queryByRole('radio')).toBeNull();
    });

    it('lists only the months Previous and Next reach, across a year boundary', async () => {
      await renderPicker('2026-02', null);
      await fireEvent.press(screen.getByTestId('my-days-month'));
      expect(screen.getByText('Choose a month')).toBeTruthy();
      expect(radioNames()).toEqual([
        'January 2026',
        'February 2026',
        'February 2025',
        'March 2025',
        'April 2025',
        'May 2025',
        'June 2025',
        'July 2025',
        'August 2025',
        'September 2025',
        'October 2025',
        'November 2025',
        'December 2025',
      ]);
      // Out of range: not offered at all, so they can't be chosen.
      expect(screen.queryByRole('radio', { name: 'January 2025' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'March 2026' })).toBeNull();
      expect(screen.queryByTestId('month-picker-2025-01')).toBeNull();
      expect(screen.getByRole('radio', { name: 'February 2026' }).props.accessibilityState).toMatchObject({
        checked: true,
      });
    });

    it('goes back to an older first jar beyond 12 months', async () => {
      await renderPicker('2026-02', '2024-11');
      await fireEvent.press(screen.getByTestId('my-days-month'));
      const names = radioNames();
      expect(names).toHaveLength(16);
      expect(names).toContain('November 2024');
      expect(names).toContain('December 2024');
      expect(names).not.toContain('October 2024');
    });

    it('jumps to the chosen month and closes', async () => {
      const { onPickMonth } = await renderPicker('2026-02', null);
      await fireEvent.press(screen.getByTestId('my-days-month'));
      await fireEvent.press(screen.getByRole('radio', { name: 'March 2025' }));
      expect(onPickMonth).toHaveBeenCalledWith('2025-03');
      expect(onPickMonth).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('radio')).toBeNull();
    });
  });

  it('keeps the month line plain text without a month picker', async () => {
    await renderMyDays();
    expect(screen.queryByTestId('my-days-month')).toBeNull();
    expect(screen.getByText('November 2026 · 10 moments')).toBeTruthy();
  });
});
