import { fireEvent, render, screen } from '@testing-library/react-native';

import { formFrom } from '../editProfileModel';
import { EditProfileView, type EditProfileViewProps } from '../EditProfileView';

// Reanimated needs native worklets; JarGraphic only uses it to animate a new layer.
jest.mock('react-native-reanimated', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
  };
});

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const form = formFrom({ display_name: 'Dale Santos', username: 'dale', bio: 'coffee', lid_color: '#7fad33' });

async function renderView(props: Partial<EditProfileViewProps>) {
  const handlers = {
    onChange: jest.fn(),
    onCancel: jest.fn(),
    onSave: jest.fn(),
    onChangeAvatar: jest.fn(),
    onChangeCover: jest.fn(),
  };
  await render(
    <EditProfileView
      form={form}
      usernameStatus="unchanged"
      avatarUri={null}
      coverUri={null}
      uploading={{ avatar: false, cover: false }}
      canSave={false}
      saving={false}
      saveError={null}
      insets={insets}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('EditProfileView', () => {
  it('keeps Save off until there is something valid to save', async () => {
    const { onSave } = await renderView({});
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    expect(onSave).not.toHaveBeenCalled();
    await renderView({ canSave: true });
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    expect(screen.getByTestId('edit-profile-save')).toHaveTextContent('Save');
  });

  it.each([
    ['available', 'dale.s', '@dale.s is available'],
    ['taken', 'mika', '@mika is taken'],
    ['reserved', 'settings', '@settings isn’t available'],
    ['invalid', 'd!', '3–20 letters, numbers, dots or underscores'],
    ['checking', 'dal', 'Checking…'],
  ] as const)('says %s under the username', async (status, username, text) => {
    await renderView({ form: { ...form, username }, usernameStatus: status });
    expect(screen.getByTestId(`edit-profile-username-${status}`)).toHaveTextContent(text);
  });

  it('says why a name can’t be saved', async () => {
    await renderView({ form: { ...form, displayName: 'x'.repeat(41) } });
    expect(screen.getByTestId('edit-profile-name-problem')).toHaveTextContent('Up to 40 characters');
    await renderView({ form: { ...form, displayName: ' ' } });
    expect(screen.getByTestId('edit-profile-name-problem')).toHaveTextContent('Add your name');
  });

  it('shows the bio counter and picks a lid colour', async () => {
    const { onChange } = await renderView({});
    expect(screen.getByText('6 / 120')).toBeTruthy();
    expect(screen.getByTestId('edit-profile-lid-pickle').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId('edit-profile-lid-sky'));
    expect(onChange).toHaveBeenCalledWith({ lidColor: '#4a9ad4' });
  });

  it('changes the photos and explains a refused save', async () => {
    const { onChangeAvatar, onChangeCover } = await renderView({ saveError: 'taken' });
    await fireEvent.press(screen.getByTestId('edit-profile-change-avatar'));
    await fireEvent.press(screen.getByTestId('edit-profile-change-cover'));
    expect(onChangeAvatar).toHaveBeenCalled();
    expect(onChangeCover).toHaveBeenCalled();
    expect(screen.getByTestId('edit-profile-error')).toHaveTextContent('Someone just took that username. Try another.');
  });
});
