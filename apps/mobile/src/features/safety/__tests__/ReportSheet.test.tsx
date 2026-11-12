import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ReportSheet, type ReportSheetProps } from '../ReportSheet';

// Report and Report sent (M3-21, FR-SAF-01) inside the real kit sheet, with submit_report mocked.

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
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
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});

async function renderSheet(props: Partial<ReportSheetProps> = {}) {
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ReportSheet
        visible
        subject={{ target: 'jar', targetId: 'jar-1' }}
        name="Mika Reyes"
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => mockRpc.mockReset());

describe('ReportSheet', () => {
  it('sends the chosen reason for the subject, then shows Report sent', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await renderSheet();
    expect(screen.getByText('Mika won’t know who reported this.')).toBeTruthy();
    const submit = screen.getByTestId('report-submit');
    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Harassment or bullying' }));
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(mockRpc).toHaveBeenCalledWith('submit_report', { target: 'jar', target_id: 'jar-1', reason: 'harassment' });
    expect(await screen.findByText('Thanks for telling us')).toBeTruthy();
    expect(screen.getByText('We’ll review this jar. Mika won’t know who reported it.')).toBeTruthy();
  });

  it('says why when the server refuses, and stays on the form', async () => {
    mockRpc.mockResolvedValue({ error: { code: '42501', message: 'not visible' } });
    await renderSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam or scam' }));
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByText('This isn’t available any more.')).toBeTruthy();
    expect(screen.queryByTestId('report-sent')).toBeNull();
  });

  it('hides Block and Also block until blocking is wired', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await renderSheet();
    expect(screen.queryByTestId('report-block-tab')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByText('Thanks for telling us')).toBeTruthy();
    expect(screen.queryByTestId('report-also-block')).toBeNull();
  });

  it('Also block closes the sheet and hands over to Block', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const onBlock = jest.fn();
    const { onClose } = await renderSheet({ onBlock });
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    await fireEvent.press(screen.getByTestId('report-submit'));
    await fireEvent.press(await screen.findByTestId('report-also-block'));
    expect(onClose).toHaveBeenCalled();
    expect(onBlock).toHaveBeenCalled();
  });
});
