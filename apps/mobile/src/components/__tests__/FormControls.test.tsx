import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Chip } from '../Chip';
import { ListRow } from '../ListRow';
import { RadioRow } from '../RadioRow';
import { SegmentedControl } from '../SegmentedControl';
import { TextField } from '../TextField';
import { Toggle } from '../Toggle';
import { colors, radius, sizes } from '@/theme/tokens';
import { expectMinTapArea, flatStyle, type Element } from './testUtils';

/** 200% text: the control must size with minHeight, never a fixed height that clips scaled text. */
function expectGrowsWithText(el: Element) {
  const style = flatStyle(el);
  expect(style.height).toBeUndefined();
  expect(Number(style.minHeight)).toBeGreaterThan(0);
}

describe('TextField', () => {
  it('is labelled, matches EditProfile and counts characters', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Bio" value="Quezon City." onChangeText={onChangeText} maxLength={120} multiline />);
    const input = screen.getByLabelText('Bio');
    expect(flatStyle(input)).toMatchObject({
      borderColor: colors.border,
      borderRadius: radius.input,
      minHeight: sizes.textArea,
    });
    expect(input.props.maxLength).toBe(120);
    expect(screen.getByText('12 / 120').props.accessibilityLabel).toBe('12 of 120 characters');
    await fireEvent.changeText(input, 'Hi');
    expect(onChangeText).toHaveBeenCalledWith('Hi');
    expectGrowsWithText(input);
  });

  it('is 50 px tall single-line and has no counter without maxLength', async () => {
    await render(<TextField label="Name" value="Dale David" onChangeText={jest.fn()} />);
    expect(flatStyle(screen.getByLabelText('Name')).minHeight).toBe(sizes.textField);
    expect(screen.queryByText(/ \/ /)).toBeNull();
  });
});

describe('Toggle', () => {
  it('is a labelled switch that announces and flips its state', async () => {
    const onValueChange = jest.fn();
    await render(<Toggle value={false} onValueChange={onValueChange} accessibilityLabel="Evening reminder" />);
    const toggle = screen.getByRole('switch', { name: 'Evening reminder' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(flatStyle(toggle).backgroundColor).toBe(colors.toggleOff);
    expectMinTapArea(toggle);
    await fireEvent.press(toggle);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('uses the brand track with the thumb on the right when on', async () => {
    await render(<Toggle value onValueChange={jest.fn()} accessibilityLabel="Morning reminder" />);
    const toggle = screen.getByRole('switch', { name: 'Morning reminder' });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    expect(flatStyle(toggle).backgroundColor).toBe(colors.brand);
    const thumb = StyleSheet.flatten(screen.getByTestId('toggle-thumb').props.style);
    expect(thumb.right).toBe(2);
    expect(thumb.left).toBeUndefined();
  });

  it('does not flip when disabled', async () => {
    const onValueChange = jest.fn();
    await render(<Toggle value onValueChange={onValueChange} accessibilityLabel="Reminder" disabled />);
    const toggle = screen.getByRole('switch');
    expect(toggle.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(toggle);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  const segments = [
    { key: 'jars', label: 'Jars' },
    { key: 'moments', label: 'Moments' },
  ] as const;

  it('renders tabs in a tablist with one selected', async () => {
    const onSelect = jest.fn();
    await render(
      <SegmentedControl
        segments={segments}
        selected="jars"
        onSelect={onSelect}
        accessibilityLabel="Profile sections"
        testID="seg"
      />,
    );
    // The tablist stays non-accessible so each tab keeps its own focus stop; it only carries role and name.
    expect(screen.getByTestId('seg').props).toMatchObject({
      accessibilityRole: 'tablist',
      accessibilityLabel: 'Profile sections',
    });
    const jars = screen.getByRole('tab', { name: 'Jars' });
    const moments = screen.getByRole('tab', { name: 'Moments' });
    expect(jars.props.accessibilityState).toMatchObject({ selected: true });
    expect(moments.props.accessibilityState).toMatchObject({ selected: false });
    expect(flatStyle(jars).backgroundColor).toBe(colors.surface);
    expect(flatStyle(moments).backgroundColor).toBeUndefined();
    expectGrowsWithText(moments);
    // 36 px tab + hitSlop meets 44 px; width comes from flex: 1.
    const slop = moments.props.hitSlop;
    expect(sizes.segment + slop.top + slop.bottom).toBeGreaterThanOrEqual(sizes.minTap);
    await fireEvent.press(moments);
    expect(onSelect).toHaveBeenCalledWith('moments');
  });
});

describe('Chip', () => {
  it('announces selected and unselected states with the design colors', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Chip label="Barkada" selected onPress={onPress} />
        <Chip label="Partner" selected={false} onPress={onPress} />
      </>,
    );
    const on = screen.getByRole('checkbox', { name: 'Barkada' });
    const off = screen.getByRole('checkbox', { name: 'Partner' });
    expect(on.props.accessibilityState).toMatchObject({ checked: true });
    expect(off.props.accessibilityState).toMatchObject({ checked: false });
    expect(flatStyle(on).backgroundColor).toBe(colors.ink);
    expect(StyleSheet.flatten(screen.getByText('Barkada').props.style).color).toBe(colors.surface);
    expect(flatStyle(off)).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.border });
    expectMinTapArea(off);
    expectGrowsWithText(off);
    await fireEvent.press(off);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ListRow', () => {
  it('reads label and value together and shows a chevron', async () => {
    const onPress = jest.fn();
    await render(<ListRow label="Default visibility" value="Readers" onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Default visibility, Readers' });
    expect(screen.getByTestId('icon-chevronRight', { includeHiddenElements: true })).toBeTruthy();
    expect(flatStyle(row)).toMatchObject({ flexDirection: 'row', borderBottomColor: colors.divider });
    expectGrowsWithText(row);
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('danger tone is red with no chevron, and the last row has no divider', async () => {
    await render(<ListRow label="Delete account" tone="danger" divider={false} onPress={jest.fn()} />);
    const row = screen.getByRole('button', { name: 'Delete account' });
    expect(StyleSheet.flatten(screen.getByText('Delete account').props.style).color).toBe(colors.danger);
    expect(screen.queryByTestId('icon-chevronRight', { includeHiddenElements: true })).toBeNull();
    expect(flatStyle(row).borderBottomWidth).toBeUndefined();
  });
});

describe('RadioRow', () => {
  it('is a radio read with its description; checked shows the brand dot, unchecked only the ring', async () => {
    const onSelect = jest.fn();
    await render(
      <>
        <RadioRow
          label="Readers"
          description="312 people who read your days"
          selected
          onSelect={jest.fn()}
          testID="a"
        />
        <RadioRow label="Only me" selected={false} onSelect={onSelect} divider={false} testID="b" />
      </>,
    );
    const on = screen.getByRole('radio', { name: 'Readers, 312 people who read your days' });
    const off = screen.getByRole('radio', { name: 'Only me' });
    expect(on.props.accessibilityState).toEqual({ checked: true });
    expect(off.props.accessibilityState).toEqual({ checked: false });
    expect(flatStyle(screen.getByTestId('a-radio')).borderColor).toBe(colors.brand);
    expect(flatStyle(screen.getByTestId('a-dot')).backgroundColor).toBe(colors.brand);
    expect(screen.queryByTestId('b-dot')).toBeNull();
    expect(flatStyle(on).borderBottomColor).toBe(colors.divider);
    expect(flatStyle(off).borderBottomWidth).toBeUndefined();
    expectGrowsWithText(on);
    expect(Number(flatStyle(on).minHeight)).toBeGreaterThanOrEqual(sizes.minTap);
    await fireEvent.press(off);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
