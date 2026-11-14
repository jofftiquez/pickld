import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState } from '../EmptyState';
import { expectMinTapArea } from './testUtils';

jest.mock('../JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));

describe('EmptyState (D-87)', () => {
  it('shows a title, one line and the action', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        illustration="bell"
        title="No notifications yet"
        body="Likes show up here."
        action={{ label: 'Find people', onPress, testID: 'empty-action' }}
        testID="empty"
      />,
    );
    expect(screen.getByRole('header', { name: 'No notifications yet' })).toBeTruthy();
    expect(screen.getByText('Likes show up here.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Find people' });
    expectMinTapArea(button);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    // No hint unless the list refreshes when pulled.
    expect(screen.queryByText('Pull down to refresh')).toBeNull();
  });

  it('adds the pull-to-refresh hint on a refreshable list', async () => {
    await render(
      <EmptyState illustration="jar" title="No jars yet" body="They show up here." refreshable testID="empty" />,
    );
    expect(screen.getByTestId('empty-refresh-hint')).toHaveTextContent('Pull down to refresh');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
