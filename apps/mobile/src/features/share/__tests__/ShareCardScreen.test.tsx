import { act, render } from '@testing-library/react-native';

import { track } from '@/lib/analytics';

import { saveImage, shareImage } from '../shareActions';
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
jest.mock('../shareCard', () => ({ buildShareCard: () => ({}) }));
jest.mock('@/features/jar/shareJar', () => ({ jarTitle: () => 'Tuesday' }));
jest.mock('@/features/jar/useJarPage', () => ({
  useJarPage: () => ({
    data: {
      jar: { id: 'jar-10', local_date: '2026-11-10', tz: 'Asia/Manila' },
      author: { display_name: 'Dale Cruz' },
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
    await act(async () => props().onAction('more'));
    expect(track).not.toHaveBeenCalled();
  });
});
