import { act, render } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { HelpScreen } from '../HelpScreen';
import type { HelpViewProps } from '../HelpView';

const mockView: { props: HelpViewProps | null } = { props: null };
jest.mock('../HelpView', () => ({
  HelpView: (props: HelpViewProps) => {
    mockView.props = props;
    return null;
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), canGoBack: () => true, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.0.0' } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const props = () => mockView.props!;

describe('Help & feedback', () => {
  it.each([
    ['onContact', 'Pickld support'],
    ['onFeedback', 'Pickld feedback'],
  ] as const)('%s emails support with the app version in the body', async (action, subject) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<HelpScreen />);
    await act(async () => props()[action]());
    const url = open.mock.calls[0]![0];
    expect(url.startsWith(`mailto:support@pickld.me?subject=${encodeURIComponent(subject)}&body=`)).toBe(true);
    expect(decodeURIComponent(url.split('body=')[1]!)).toContain('Pickld 2.0.0');
    expect(props().noMail).toBeNull();
    open.mockRestore();
  });

  it('without a mail app it shows the address to write to', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    await render(<HelpScreen />);
    await act(async () => props().onContact());
    expect(props().noMail).toBe('No email app is set up. Write to support@pickld.me.');
    open.mockRestore();
  });
});
