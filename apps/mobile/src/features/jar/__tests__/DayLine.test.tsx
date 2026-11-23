import { fireEvent, render, screen } from '@testing-library/react-native';

import { DayLine } from '../DayLine';

describe('DayLine', () => {
  it('adds a line: the field opens in place and Save hands over what was typed', async () => {
    const onSave = jest.fn().mockResolvedValue('Moved into the new flat');
    await render(<DayLine line={null} onSave={onSave} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a line for the day' }));
    await fireEvent.changeText(screen.getByLabelText('Line for the day'), 'Moved into the new flat');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Moved into the new flat');
    expect(screen.queryByTestId('day-line-editor')).toBeNull();
  });

  it('edits an existing line from its current text, and Cancel leaves it unsaved', async () => {
    const onSave = jest.fn();
    await render(<DayLine line="Rainy Sunday" onSave={onSave} />);
    expect(screen.getByTestId('day-line-text')).toHaveTextContent('“Rainy Sunday”');
    await fireEvent.press(screen.getByRole('button', { name: 'Line for the day: Rainy Sunday' }));
    expect(screen.getByLabelText('Line for the day').props.value).toBe('Rainy Sunday');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('day-line-text')).toHaveTextContent('“Rainy Sunday”');
  });

  it('keeps the draft open with an error when saving fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('offline'));
    await render(<DayLine line={null} onSave={onSave} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a line for the day' }));
    await fireEvent.changeText(screen.getByLabelText('Line for the day'), 'Long day');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save your line.', { exact: false });
    expect(screen.getByLabelText('Line for the day').props.value).toBe('Long day');
  });
});
