import { act, render, screen } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import { useToastStore } from '@/lib/toast';

import { renderCardImage, saveImage, shareImage } from '../shareActions';
import { ShareCardScreen } from '../ShareCardScreen';
import type { ShareCardViewProps } from '../ShareCardView';

// share_card_exported (NFR-ANL-01): Save image and Share to… send it once each, only when they worked.
// The view is replaced by its props; the jar, the card model and the phone's share actions are fakes.

const mockView: { props: ShareCardViewProps | null } = { props: null };
jest.mock('../ShareCardView', () => ({
  ShareCardView: (p: ShareCardViewProps) => {
    mockView.props = p;
    return null;
  },
}));
jest.mock('../shareActions', () => ({
  renderCardImage: jest.fn(async () => 'file:///cache/card.png'),
  saveImage: jest.fn(async () => 'saved'),
  shareImage: jest.fn(async () => undefined),
  copyLink: jest.fn(async () => undefined),
  messageLink: jest.fn(async () => undefined),
  shareLink: jest.fn(async () => undefined),
}));
jest.mock('../shareCard', () => ({
  buildShareCard: () => ({ moments: [] }),
  onCard: (m: { status: string; visibility: string }) => m.status === 'live' && m.visibility !== 'only_me',
}));
jest.mock('@/features/jar/shareJar', () => ({ jarTitle: () => 'Tuesday' }));
jest.mock('@/features/jar/useJarPage', () => ({
  useJarPage: () => ({
    data: {
      jar: { id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila' },
      author: { display_name: 'Dale Cruz' },
      moments: [
        { id: 'ootd', slot: 'ootd', status: 'live', visibility: 'readers' },
        { id: 'selfie', slot: 'selfie', status: 'live', visibility: 'only_me' },
      ],
    },
  }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const props = () => mockView.props!;

beforeEach(() => jest.clearAllMocks());

describe('Share jar card analytics', () => {
  it('Save image sends save once it is saved; a refused Photos permission sends nothing', async () => {
    await render(<ShareCardScreen jarId="jar-10" />);
    jest.mocked(saveImage).mockResolvedValueOnce('denied');
    await act(async () => props().onAction('save'));
    expect(track).not.toHaveBeenCalled();
    await act(async () => props().onAction('save'));
    expect(jest.mocked(track).mock.calls).toEqual([['share_card_exported', { destination: 'save' }]]);
  });

  it('Share to… sends share once the share sheet is done; a failure sends nothing', async () => {
    await render(<ShareCardScreen jarId="jar-10" />);
    jest.mocked(shareImage).mockRejectedValueOnce(new Error('no sharing'));
    await act(async () => props().onShareTo());
    expect(track).not.toHaveBeenCalled();
    await act(async () => props().onShareTo());
    expect(jest.mocked(track).mock.calls).toEqual([['share_card_exported', { destination: 'share' }]]);
  });

  it('the link actions are not card exports', async () => {
    await render(<ShareCardScreen jarId="jar-10" />);
    await act(async () => props().onAction('copy'));
    await act(async () => props().onAction('message'));
    expect(track).not.toHaveBeenCalled();
  });

  it('Save image and Copy link confirm with a toast; a refused Photos permission says so on the page', async () => {
    useToastStore.setState({ current: null });
    await render(<ShareCardScreen jarId="jar-10" />);
    jest.mocked(saveImage).mockResolvedValueOnce('denied');
    await act(async () => props().onAction('save'));
    expect(useToastStore.getState().current).toBeNull();
    expect(props().notice).toEqual({ text: 'Pickld can’t save to Photos. Turn it on in Settings.', error: true });
    await act(async () => props().onAction('save'));
    expect(useToastStore.getState().current?.key).toBe('imageSaved');
    expect(props().notice).toBeNull();
    await act(async () => props().onAction('copy'));
    expect(useToastStore.getState().current?.key).toBe('linkCopied');
  });
});

describe('Share a moment (T-509)', () => {
  beforeEach(() => {
    mockView.props = null;
  });

  it('shares the chosen moment, saved under its own file name', async () => {
    await render(<ShareCardScreen jarId="jar-10" momentId="ootd" />);
    expect(props().heading).toBe('Share moment');
    expect(props().story.moment?.id).toBe('ootd');
    expect(props().story.background).toBe('blur');
    await act(async () => props().onAction('save'));
    expect(jest.mocked(renderCardImage).mock.calls[0]?.[1]).toBe('pickld-moment-ootd');
  });

  it('never shows a private moment, even to its owner', async () => {
    await render(<ShareCardScreen jarId="jar-10" momentId="selfie" />);
    expect(mockView.props).toBeNull();
    expect(screen.getByText('This moment isn’t available to share.')).toBeTruthy();
  });
});
