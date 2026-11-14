import { Stack, router, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import Under13Route from '../../../../app/setup/under13';

// Under 13 (D-85): the account is already gone and the phone signed out (AboutScreen, FR-ACC-04).
// Go back starts over at How it works page 1, with no history back into setup.

jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

function IntroStub() {
  const { step } = useLocalSearchParams<{ step: string }>();
  return <Text>{`Intro ${step}`}</Text>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  welcome: () => <Text>Welcome</Text>,
  'intro/[step]': IntroStub,
  'setup/about': () => <Text>About you</Text>,
  'setup/under13': Under13Route,
};

async function openUnder13() {
  await act(async () => router.push('/setup/about'));
  expect(await screen.findByText('About you')).toBeTruthy();
  await act(async () => router.push('/setup/under13'));
  expect(await screen.findByTestId('under13-screen')).toBeTruthy();
}

async function expectFirstIntroOnly() {
  expect(await screen.findByText('Intro 1')).toBeTruthy();
  expect(screen).toHavePathname('/intro/1');
  // Nothing below it: not Under 13, not About you, not Welcome.
  expect(router.canGoBack()).toBe(false);
}

it('Under 13: both Go back buttons reset to the first intro page', async () => {
  await renderRouter(routes, { initialUrl: '/welcome' });
  expect(await screen.findByText('Welcome')).toBeTruthy();

  await openUnder13();
  await act(async () => fireEvent.press(screen.getByTestId('under13-back')));
  await expectFirstIntroOnly();

  await openUnder13();
  await act(async () => fireEvent.press(screen.getByTestId('under13-start')));
  await expectFirstIntroOnly();
});
