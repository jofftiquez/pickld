import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthView, type AuthViewProps } from '../AuthView';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

function setup(props: Partial<AuthViewProps>) {
  const onSubmitEmail = jest.fn();
  const all: AuthViewProps = {
    mode: 'signUp',
    insets,
    email: '',
    onChangeEmail: jest.fn(),
    busy: false,
    error: null,
    onBack: jest.fn(),
    onProvider: jest.fn(),
    onSubmitEmail,
    onSwitchMode: jest.fn(),
    onLegal: jest.fn(),
    ...props,
  };
  return { onSubmitEmail, render: () => render(<AuthView {...all} />) };
}

describe('AuthView email field (M5-01: at large text Continue can sit under the keyboard)', () => {
  it('sends from the keyboard’s return key, without autocorrecting the address', async () => {
    const view = setup({ email: 'dale@pickld.test' });
    await view.render();
    const field = screen.getByTestId('auth-email');
    expect(field.props.autoCorrect).toBe(false);
    expect(field.props.returnKeyType).toBe('send');
    await fireEvent(field, 'submitEditing');
    expect(view.onSubmitEmail).toHaveBeenCalledTimes(1);
  });

  it('does nothing on return with an empty address or while a sign-in is in flight', async () => {
    const empty = setup({ email: '  ' });
    await empty.render();
    await fireEvent(screen.getByTestId('auth-email'), 'submitEditing');
    expect(empty.onSubmitEmail).not.toHaveBeenCalled();
    await screen.unmount();

    const busy = setup({ email: 'dale@pickld.test', busy: true });
    await busy.render();
    await fireEvent(screen.getByTestId('auth-email'), 'submitEditing');
    expect(busy.onSubmitEmail).not.toHaveBeenCalled();
  });
});
