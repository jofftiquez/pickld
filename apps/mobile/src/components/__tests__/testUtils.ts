import { StyleSheet, type Insets, type ViewStyle } from 'react-native';
import type { screen } from '@testing-library/react-native';

import { sizes } from '@/theme/tokens';

export type Element = ReturnType<typeof screen.getByRole>;

export function flatStyle(el: Element): ViewStyle {
  return StyleSheet.flatten(el.props.style) ?? {};
}

/** Asserts the visual box plus hitSlop is at least 44 × 44 in both directions. */
export function expectMinTapArea(el: Element): void {
  const style = flatStyle(el);
  const slop: Insets = el.props.hitSlop ?? {};
  const height = Number(style.height ?? style.minHeight ?? 0);
  const width = Number(style.width ?? style.minWidth ?? 0);
  expect(height + (slop.top ?? 0) + (slop.bottom ?? 0)).toBeGreaterThanOrEqual(sizes.minTap);
  expect(width + (slop.left ?? 0) + (slop.right ?? 0)).toBeGreaterThanOrEqual(sizes.minTap);
}
