import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, sizes } from '@/theme/tokens';

export type CardProps = {
  children: ReactNode;
  /** Layout tweaks only (e.g. smaller vertical padding for a list of rows). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** White rounded card from Settings: 24 radius, 14 padding, soft shadow. */
export function Card({ children, style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: sizes.cardPadding,
    ...shadow.card,
  },
});
