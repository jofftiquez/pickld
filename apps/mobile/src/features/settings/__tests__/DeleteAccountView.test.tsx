import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeleteAccountView, type DeleteAccountViewProps } from '../DeleteAccountView';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

async function setup(over: Partial<DeleteAccountViewProps> = {}) {
  const props: DeleteAccountViewProps = {
    insets,
    counts: { jars: 128, moments: 1 },
    exportCard: { kind: 'none' },
    exportBusy: false,
    deleting: false,
    error: null,
    onBack: jest.fn(),
    onRequestExport: jest.fn(),
    onOpenExport: jest.fn(),
    onDelete: jest.fn(),
    ...over,
  };
  await render(<DeleteAccountView {...props} />);
  return props;
}

const submit = () => screen.getByTestId('delete-submit');

describe('Delete account', () => {
  it('turns the button on only after DELETE is typed', async () => {
    const props = await setup();
    expect(submit()).toBeDisabled();
    await fireEvent.press(submit());
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'delete');
    expect(submit()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELET');
    expect(submit()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    expect(submit()).toBeEnabled();
    await fireEvent.press(submit());
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('stays off while a delete is already on its way', async () => {
    await setup({ deleting: true });
    await fireEvent.changeText(screen.getByTestId('delete-confirm'), 'DELETE');
    expect(submit()).toBeDisabled();
  });

  it('names what goes, with plurals', async () => {
    await setup();
    expect(screen.getByTestId('delete-body')).toHaveTextContent(
      'Deleting your account permanently removes your 128 jars and 1 moment, your profile, readers, comments and reactions.',
    );
  });

  it('offers Download, waits while preparing, then opens the ready link', async () => {
    const first = await setup();
    await fireEvent.press(screen.getByTestId('delete-export-request'));
    expect(first.onRequestExport).toHaveBeenCalled();
    await screen.unmount();

    await setup({ exportCard: { kind: 'preparing' } });
    expect(screen.getByTestId('delete-export-request')).toBeDisabled();
    await screen.unmount();

    const ready = await setup({ exportCard: { kind: 'ready', url: 'https://x.test/e.zip', expiresAt: null } });
    await fireEvent.press(screen.getByTestId('delete-export-open'));
    expect(ready.onOpenExport).toHaveBeenCalledWith('https://x.test/e.zip');
  });
});
